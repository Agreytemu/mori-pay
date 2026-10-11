import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  AuthSession,
  AuthTokens,
  AuthUser,
  DeviceInfo,
  EmailCredentialsInput,
  EmailRegisterInput,
  EmailSignInInput,
  OtpChallengeResult,
  PinSignInInput,
  PinStatus,
  RequestPasswordResetInput,
  ResetPasswordInput,
  RegisterInput,
  RequestOtpInput,
  VerifyEmailInput,
  VerifyOtpInput,
  VerifyOtpResult,
  WalletAccount,
} from '@mori-pay/contracts';

import {
  generateNumericCode,
  hashPassword,
  hashPin,
  hmacSha256,
  safeEqualHex,
  verifyPasswordHash,
  verifyPinHash,
} from '../common/crypto.js';
import { AppConfigService } from '../config/app-config.service.js';
import { LimitsService } from '../limits/limits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SMS_PROVIDER, type SmsProvider } from '../sms/sms.provider.js';
import {
  toAuthUser,
  toWalletAccount,
  type UserWithWallet,
} from '../wallet/wallet.mapper.js';
import { TokenService } from './token.service.js';
import { EmailService } from './email.service.js';

const OTP_PURPOSE_LOGIN = 'login';
const OTP_PURPOSE_PHONE_LINK = 'phone_link';
const EMAIL_PURPOSE_VERIFY = 'verify';
const EMAIL_PURPOSE_PASSWORD_RESET = 'password_reset';
const OTP_RESEND_INTERVAL_SECONDS = 30;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly limits: LimitsService,
    private readonly tokens: TokenService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    private readonly email: EmailService,
  ) {}

  async emailSignIn(input: EmailSignInInput): Promise<AuthSession> {
    const user = await this.findUserByEmail(input.email);
    if (
      !user ||
      !user.emailVerifiedAt ||
      !user.passwordHash ||
      user.status !== 'active'
    ) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (user.passwordLockedUntil && user.passwordLockedUntil > new Date()) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (!(await verifyPasswordHash(input.password, user.passwordHash))) {
      const failed = user.passwordFailedCount + 1;
      const lock = failed >= PIN_MAX_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordFailedCount: lock ? 0 : failed,
          passwordLockedUntil: lock
            ? new Date(Date.now() + PIN_LOCK_SECONDS * 1000)
            : null,
        },
      });
      throw new UnauthorizedException(
        lock
          ? 'Too many incorrect attempts. Try again later.'
          : 'Email or password is incorrect',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordFailedCount: 0, passwordLockedUntil: null },
    });
    return this.createSession(user.id, input.device);
  }

  async pinSignIn(input: PinSignInInput): Promise<AuthSession> {
    const user = await this.findUserByEmail(input.email);
    if (
      !user ||
      !user.emailVerifiedAt ||
      !user.pinHash ||
      user.status !== 'active'
    ) {
      throw new UnauthorizedException('Email or PIN is incorrect');
    }

    try {
      await this.verifyPin(user.id, input.pin);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException('Email or PIN is incorrect');
      }
      throw error;
    }
    return this.createSession(user.id, input.device);
  }

  async registerEmail(input: EmailRegisterInput): Promise<OtpChallengeResult> {
    const existing = await this.findUserByEmail(input.email);
    if (existing) {
      if (
        !existing.emailVerifiedAt &&
        existing.status === 'pending' &&
        existing.email
      ) {
        return this.createEmailChallenge(
          existing.id,
          existing.email,
          EMAIL_PURPOSE_VERIFY,
        );
      }
      throw new ConflictException('An account already exists for this email');
    }

    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            phone: null,
            email: input.email,
            fullName: input.fullName,
            firstName: input.firstName,
            dateOfBirth: input.dateOfBirth
              ? new Date(input.dateOfBirth)
              : null,
            passwordHash: await hashPassword(input.password),
            memberId: `MP${generateNumericCode(8)}`,
            status: 'pending',
          },
        });

        const wallet = await tx.wallet.create({
          data: {
            userId: user.id,
            currency: 'TZS',
            accountNumber: generateNumericCode(10),
          },
        });

        await tx.ledgerAccount.create({
          data: {
            walletId: wallet.id,
            kind: 'available',
            currency: 'TZS',
            balance: 0n,
          },
        });

        return user.id;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account already exists for this email',
        );
      }
      throw error;
    }

    this.logger.log(`Registered pending email account ${userId}`);
    return this.createEmailChallenge(
      userId,
      input.email,
      EMAIL_PURPOSE_VERIFY,
    );
  }

  async resendEmailVerification(email: string): Promise<OtpChallengeResult> {
    const user = await this.findUserByEmail(email);
    if (
      !user ||
      !user.email ||
      user.emailVerifiedAt ||
      user.status === 'restricted'
    ) {
      return {
        expiresIn: this.config.otp.ttlSeconds,
        retryAfter: OTP_RESEND_INTERVAL_SECONDS,
      };
    }
    return this.createEmailChallenge(
      user.id,
      user.email,
      EMAIL_PURPOSE_VERIFY,
    );
  }

  async verifyEmail(input: VerifyEmailInput): Promise<AuthSession> {
    const challenge = await this.getValidEmailChallenge(
      input.email,
      EMAIL_PURPOSE_VERIFY,
      input.code,
    );
    const user = await this.prisma.user.findFirst({
      where: { id: challenge.userId ?? undefined, email: input.email },
    });
    if (!user || user.status === 'restricted') {
      throw new UnauthorizedException('This verification code is invalid');
    }

    await this.prisma.$transaction([
      this.prisma.emailChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
          status: 'active',
          passwordFailedCount: 0,
          passwordLockedUntil: null,
        },
      }),
    ]);
    return this.createSession(user.id, input.device);
  }

  async setEmailCredentials(
    userId: string,
    input: EmailCredentialsInput,
  ): Promise<OtpChallengeResult> {
    const existing = await this.findUserByEmail(input.email);
    if (existing && existing.id !== userId) {
      throw new ConflictException('An account already exists for this email');
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: input.email,
          emailVerifiedAt: null,
          passwordHash: await hashPassword(input.password),
          passwordFailedCount: 0,
          passwordLockedUntil: null,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account already exists for this email',
        );
      }
      throw error;
    }

    return this.createEmailChallenge(userId, input.email, EMAIL_PURPOSE_VERIFY);
  }

  async requestPasswordReset(
    input: RequestPasswordResetInput,
  ): Promise<OtpChallengeResult> {
    const user = await this.findUserByEmail(input.email);
    if (!user || !user.email || !user.emailVerifiedAt || user.status !== 'active') {
      return {
        expiresIn: this.config.otp.ttlSeconds,
        retryAfter: OTP_RESEND_INTERVAL_SECONDS,
      };
    }
    try {
      return await this.createEmailChallenge(
        user.id,
        user.email,
        EMAIL_PURPOSE_PASSWORD_RESET,
      );
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        return {
          expiresIn: this.config.otp.ttlSeconds,
          retryAfter: OTP_RESEND_INTERVAL_SECONDS,
        };
      }
      if (error instanceof ServiceUnavailableException) {
        return {
          expiresIn: this.config.otp.ttlSeconds,
          retryAfter: OTP_RESEND_INTERVAL_SECONDS,
        };
      }
      throw error;
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const challenge = await this.getValidEmailChallenge(
      input.email,
      EMAIL_PURPOSE_PASSWORD_RESET,
      input.code,
    );
    const user = await this.prisma.user.findFirst({
      where: {
        id: challenge.userId ?? undefined,
        email: input.email,
        emailVerifiedAt: { not: null },
        status: 'active',
      },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException('This verification code is invalid');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.emailChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(input.password),
          passwordFailedCount: 0,
          passwordLockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async requestOtp(input: RequestOtpInput): Promise<OtpChallengeResult> {
    const { phone } = input;
    const now = Date.now();

    const recent = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: OTP_PURPOSE_LOGIN,
        consumedAt: null,
        createdAt: {
          gt: new Date(now - OTP_RESEND_INTERVAL_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          (recent.createdAt.getTime() +
            OTP_RESEND_INTERVAL_SECONDS * 1000 -
            now) /
            1000,
        ),
      );
      throw new HttpException(
        `Please wait ${retryAfter}s before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateNumericCode(6);
    const ttl = this.config.otp.ttlSeconds;

    await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose: OTP_PURPOSE_LOGIN,
        codeHash: this.otpHash(phone, code),
        expiresAt: new Date(now + ttl * 1000),
      },
    });

    await this.sms.send({
      to: phone,
      body: `Your Mori Pay verification code is ${code}. It expires in ${Math.round(
        ttl / 60,
      )} minutes. Never share it with anyone.`,
    });

    return {
      expiresIn: ttl,
      retryAfter: OTP_RESEND_INTERVAL_SECONDS,
      ...(this.config.isProduction ? {} : { devCode: code }),
    };
  }

    async requestPhoneLink(
      userId: string,
      input: RequestOtpInput,
    ): Promise<OtpChallengeResult> {
      const [user, owner] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { phone: true },
        }),
        this.prisma.user.findUnique({
          where: { phone: input.phone },
          select: { id: true },
        }),
      ]);
      if (user.phone) {
        throw new ConflictException('A phone number is already linked to this account');
      }
      if (owner) {
        throw new ConflictException('This phone number is already linked to an account');
      }

      const now = Date.now();
      const recent = await this.prisma.otpChallenge.findFirst({
        where: {
          phone: input.phone,
          purpose: OTP_PURPOSE_PHONE_LINK,
          consumedAt: null,
          createdAt: {
            gt: new Date(now - OTP_RESEND_INTERVAL_SECONDS * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) {
        const retryAfter = Math.max(
          1,
          Math.ceil(
            (recent.createdAt.getTime() +
              OTP_RESEND_INTERVAL_SECONDS * 1000 -
              now) /
              1000,
          ),
        );
        throw new HttpException(
          `Please wait ${retryAfter}s before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const code = generateNumericCode(6);
      const ttl = this.config.otp.ttlSeconds;
      await this.prisma.otpChallenge.create({
        data: {
          phone: input.phone,
          purpose: OTP_PURPOSE_PHONE_LINK,
          userId,
          codeHash: this.otpHash(input.phone, code),
          expiresAt: new Date(now + ttl * 1000),
        },
      });
      await this.sms.send({
        to: input.phone,
        body: `Your Mori Pay phone verification code is ${code}. It expires in ${Math.round(
          ttl / 60,
        )} minutes. Never share it with anyone.`,
      });
      return {
        expiresIn: ttl,
        retryAfter: OTP_RESEND_INTERVAL_SECONDS,
        ...(this.config.isProduction ? {} : { devCode: code }),
      };
    }

    async verifyPhoneLink(
      userId: string,
      input: VerifyOtpInput,
    ): Promise<void> {
      const challenge = await this.prisma.otpChallenge.findFirst({
        where: {
          phone: input.phone,
          purpose: OTP_PURPOSE_PHONE_LINK,
          userId,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!challenge) {
        throw new UnauthorizedException(
          'No active verification code. Request a new one.',
        );
      }
      if (challenge.attempts >= this.config.otp.maxAttempts) {
        throw new UnauthorizedException('Too many attempts. Request a new code.');
      }
      if (!safeEqualHex(this.otpHash(input.phone, input.code), challenge.codeHash)) {
        await this.prisma.otpChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
        throw new UnauthorizedException('Incorrect verification code');
      }

      const current = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { phone: true },
      });
      if (current.phone) {
        throw new ConflictException('A phone number is already linked to this account');
      }
      const owner = await this.prisma.user.findUnique({
        where: { phone: input.phone },
        select: { id: true },
      });
      if (owner && owner.id !== userId) {
        throw new ConflictException('This phone number is already linked to an account');
      }

      try {
        await this.prisma.$transaction([
          this.prisma.otpChallenge.update({
            where: { id: challenge.id },
            data: { consumedAt: new Date() },
          }),
          this.prisma.user.update({
            where: { id: userId },
            data: { phone: input.phone },
          }),
        ]);
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new ConflictException(
            'This phone number is already linked to an account',
          );
        }
        throw error;
      }
    }

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const { phone, code, device } = input;

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: OTP_PURPOSE_LOGIN,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new UnauthorizedException(
        'No active verification code. Request a new one.',
      );
    }

    if (challenge.attempts >= this.config.otp.maxAttempts) {
      throw new UnauthorizedException(
        'Too many attempts. Request a new code.',
      );
    }

    if (!safeEqualHex(this.otpHash(phone, code), challenge.codeHash)) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect verification code');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      const setup = this.tokens.createSetupToken(phone);
      return {
        registrationRequired: true,
        setupToken: setup.token,
        expiresIn: setup.expiresIn,
      };
    }

    if (user.status === 'restricted') {
      throw new ForbiddenException('This account is restricted');
    }

    return {
      registrationRequired: false,
      session: await this.createSession(user.id, device),
    };
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    let phone: string;
    try {
      phone = this.tokens.verifySetupToken(input.setupToken).sub;
    } catch {
      throw new UnauthorizedException(
        'Registration session expired. Verify your number again.',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('An account already exists for this number');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          phone,
          fullName: input.fullName,
          firstName: input.firstName,
          email: input.email ?? null,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          memberId: `MP${generateNumericCode(8)}`,
          status: 'active',
        },
      });

      const wallet = await tx.wallet.create({
        data: {
          userId: created.id,
          currency: 'TZS',
          accountNumber: generateNumericCode(10),
        },
      });

      await tx.ledgerAccount.create({
        data: {
          walletId: wallet.id,
          kind: 'available',
          currency: 'TZS',
          balance: 0n,
        },
      });

      return created;
    });

    this.logger.log(`Registered new user ${user.id}`);
    return this.createSession(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Reuse of an already-rotated token means it leaked: assume theft and
    // drop every active session for the account.
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh token reuse detected for user ${record.userId}; all sessions revoked`,
      );
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(record.userId, record.deviceId ?? undefined);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getSession(
    userId: string,
  ): Promise<{ user: AuthUser; wallet: WalletAccount }> {
    const user = await this.loadUser(userId);
    return {
      user: toAuthUser(user),
      wallet: toWalletAccount(
        user,
        await this.limits.getSummary(user.id, user.tier),
      ),
    };
  }

  async pinStatus(userId: string): Promise<PinStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      pinSet: Boolean(user.pinHash),
      lockedUntil: user.pinLockedUntil?.toISOString() ?? null,
    };
  }

  async setPin(userId: string, pin: string): Promise<PinStatus> {
    const pinHash = await hashPin(pin);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pinHash,
        pinUpdatedAt: new Date(),
        pinFailedCount: 0,
        pinLockedUntil: null,
      },
    });
    return { pinSet: true, lockedUntil: null };
  }

  async verifyPin(userId: string, pin: string): Promise<PinStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.pinHash) throw new BadRequestException('Set a PIN first');

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      throw new UnauthorizedException(
        'PIN is temporarily locked. Try again later.',
      );
    }

    if (!(await verifyPinHash(pin, user.pinHash))) {
      const failed = user.pinFailedCount + 1;
      const lock = failed >= PIN_MAX_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pinFailedCount: lock ? 0 : failed,
          pinLockedUntil: lock
            ? new Date(Date.now() + PIN_LOCK_SECONDS * 1000)
            : null,
        },
      });
      throw new UnauthorizedException(
        lock
          ? 'Too many incorrect attempts. PIN temporarily locked.'
          : 'Incorrect PIN',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { pinFailedCount: 0, pinLockedUntil: null },
    });

    return { pinSet: true, lockedUntil: null };
  }

  async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
  ): Promise<PinStatus> {
    await this.verifyPin(userId, currentPin);
    return this.setPin(userId, newPin);
  }

  private async createSession(
    userId: string,
    device?: DeviceInfo,
  ): Promise<AuthSession> {
    let deviceId: string | undefined;

    if (device) {
      const deviceData = {
        name: device.name,
        platform: device.platform,
        ...(device.pushToken === undefined ? {} : { pushToken: device.pushToken }),
        isCurrent: true,
        lastActiveAt: new Date(),
      };
      const registered = device.installationId
        ? await this.prisma.device.upsert({
            where: {
              userId_installationId: { userId, installationId: device.installationId },
            },
            create: { userId, ...deviceData, installationId: device.installationId },
            update: deviceData,
          })
        : await this.prisma.device.create({
            data: {
              userId,
              ...deviceData,
              pushToken: device.pushToken ?? null,
            },
          });
      deviceId = registered.id;
    } else {
      const existing = await this.prisma.device.findFirst({
        where: { userId },
        orderBy: { lastActiveAt: 'desc' },
      });
      deviceId = existing?.id;
    }

    const tokens = await this.issueTokens(userId, deviceId);
    const user = await this.loadUser(userId);

    return {
      user: toAuthUser(user),
      wallet: toWalletAccount(
        user,
        await this.limits.getSummary(user.id, user.tier),
      ),
      tokens,
    };
  }

  private async issueTokens(
    userId: string,
    deviceId?: string,
  ): Promise<AuthTokens> {
    const refresh = this.tokens.createRefreshToken();
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId: deviceId ?? null,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
      },
    });

    const access = this.tokens.createAccessToken(userId, record.id);

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
    };
  }

  private async loadUser(userId: string): Promise<UserWithWallet> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: { include: { ledgerAccounts: true } } },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
  }

  private async createEmailChallenge(
    userId: string,
    email: string,
    purpose: string,
  ): Promise<OtpChallengeResult> {
    const now = new Date();
    const recent = await this.prisma.emailChallenge.findFirst({
      where: {
        email,
        purpose,
        consumedAt: null,
        createdAt: {
          gt: new Date(now.getTime() - OTP_RESEND_INTERVAL_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          (recent.createdAt.getTime() +
            OTP_RESEND_INTERVAL_SECONDS * 1000 -
            now.getTime()) /
            1000,
        ),
      );
      throw new HttpException(
        `Please wait ${retryAfter}s before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateNumericCode(6);
    const ttl = this.config.otp.ttlSeconds;
    await this.prisma.emailChallenge.updateMany({
      where: { email, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await this.prisma.emailChallenge.create({
      data: {
        userId,
        email,
        purpose,
        codeHash: this.emailOtpHash(email, purpose, code),
        expiresAt: new Date(now.getTime() + ttl * 1000),
      },
    });
    await this.email.sendCode(
      email,
      code,
      purpose === EMAIL_PURPOSE_VERIFY ? 'verify' : 'password_reset',
      ttl,
    );
    return {
      expiresIn: ttl,
      retryAfter: OTP_RESEND_INTERVAL_SECONDS,
      ...(this.config.isProduction ? {} : { devCode: code }),
    };
  }

  private async getValidEmailChallenge(
    email: string,
    purpose: string,
    code: string,
  ) {
    const challenge = await this.prisma.emailChallenge.findFirst({
      where: {
        email,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new UnauthorizedException(
        'No active verification code. Request a new one.',
      );
    }
    if (challenge.attempts >= this.config.otp.maxAttempts) {
      throw new UnauthorizedException(
        'Too many attempts. Request a new code.',
      );
    }
    if (
      !safeEqualHex(
        this.emailOtpHash(email, purpose, code),
        challenge.codeHash,
      )
    ) {
      await this.prisma.emailChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect verification code');
    }
    return challenge;
  }

  private emailOtpHash(email: string, purpose: string, code: string): string {
    return hmacSha256(
      `${email}:${purpose}:${code}`,
      this.config.jwt.accessSecret,
    );
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private otpHash(phone: string, code: string): string {
    return hmacSha256(`${phone}:${code}`, this.config.jwt.accessSecret);
  }
}

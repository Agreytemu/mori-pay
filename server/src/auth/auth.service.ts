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
  UnauthorizedException,
} from '@nestjs/common';

import type {
  AuthSession,
  AuthTokens,
  AuthUser,
  DeviceInfo,
  OtpChallengeResult,
  PinStatus,
  RegisterInput,
  RequestOtpInput,
  VerifyOtpInput,
  VerifyOtpResult,
  WalletAccount,
} from '@mori-pay/contracts';

import {
  generateNumericCode,
  hashPin,
  hmacSha256,
  safeEqualHex,
  verifyPinHash,
} from '../common/crypto.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SMS_PROVIDER, type SmsProvider } from '../sms/sms.provider.js';
import {
  toAuthUser,
  toWalletAccount,
  type UserWithWallet,
} from '../wallet/wallet.mapper.js';
import { TokenService } from './token.service.js';

const OTP_PURPOSE_LOGIN = 'login';
const OTP_RESEND_INTERVAL_SECONDS = 30;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly tokens: TokenService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

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

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
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
      wallet: toWalletAccount(user),
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
      const created = await this.prisma.device.create({
        data: {
          userId,
          name: device.name,
          platform: device.platform,
          pushToken: device.pushToken ?? null,
          isCurrent: true,
        },
      });
      deviceId = created.id;
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
      wallet: toWalletAccount(user),
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

  private otpHash(phone: string, code: string): string {
    return hmacSha256(`${phone}:${code}`, this.config.jwt.accessSecret);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  changePinSchema,
  emailCredentialsSchema,
  emailOnlySchema,
  emailRegisterSchema,
  emailSignInSchema,
  pinSignInSchema,
  requestPasswordResetSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  requestOtpSchema,
  setPinSchema,
  verifyEmailSchema,
  verifyOtpSchema,
  verifyPinSchema,
  type AuthSession,
  type AuthTokens,
  type AuthUser,
  type ChangePinInput,
  type EmailCredentialsInput,
  type EmailRegisterInput,
  type EmailSignInInput,
  type OtpChallengeResult,
  type PinSignInInput,
  type PinStatus,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
  type RefreshTokenInput,
  type RegisterInput,
  type RequestOtpInput,
  type SetPinInput,
  type VerifyOtpInput,
  type VerifyOtpResult,
  type VerifyEmailInput,
  type VerifyPinInput,
  type WalletAccount,
} from '@mori-pay/contracts';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  emailSignIn(
    @Body(new ZodValidationPipe(emailSignInSchema)) input: EmailSignInInput,
  ): Promise<AuthSession> {
    return this.auth.emailSignIn(input);
  }

  @Public()
  @Post('pin/login')
  @HttpCode(HttpStatus.OK)
  pinSignIn(
    @Body(new ZodValidationPipe(pinSignInSchema)) input: PinSignInInput,
  ): Promise<AuthSession> {
    return this.auth.pinSignIn(input);
  }

  @Public()
  @Post('email/register')
  registerEmail(
    @Body(new ZodValidationPipe(emailRegisterSchema))
    input: EmailRegisterInput,
  ): Promise<OtpChallengeResult> {
    return this.auth.registerEmail(input);
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) input: VerifyEmailInput,
  ): Promise<AuthSession> {
    return this.auth.verifyEmail(input);
  }

  @Public()
  @Post('email/resend')
  @HttpCode(HttpStatus.OK)
  resendEmailVerification(
    @Body(new ZodValidationPipe(emailOnlySchema)) input: { email: string },
  ): Promise<OtpChallengeResult> {
    return this.auth.resendEmailVerification(input.email);
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetSchema))
    input: RequestPasswordResetInput,
  ): Promise<OtpChallengeResult> {
    return this.auth.requestPasswordReset(input);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema))
    input: ResetPasswordInput,
  ): Promise<void> {
    await this.auth.resetPassword(input);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(
    @Body(new ZodValidationPipe(requestOtpSchema)) input: RequestOtpInput,
  ): Promise<OtpChallengeResult> {
    return this.auth.requestOtp(input);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) input: VerifyOtpInput,
  ): Promise<VerifyOtpResult> {
    return this.auth.verifyOtp(input);
  }

  @ApiBearerAuth()
  @Post('phone/request-link')
  @HttpCode(HttpStatus.OK)
  requestPhoneLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(requestOtpSchema)) input: RequestOtpInput,
  ): Promise<OtpChallengeResult> {
    return this.auth.requestPhoneLink(user.userId, input);
  }

  @ApiBearerAuth()
  @Post('phone/verify-link')
  @HttpCode(HttpStatus.OK)
  verifyPhoneLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(verifyOtpSchema)) input: VerifyOtpInput,
  ): Promise<void> {
    return this.auth.verifyPhoneLink(user.userId, input);
  }

  @Public()
  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
  ): Promise<AuthSession> {
    return this.auth.register(input);
  }

  @ApiBearerAuth()
  @Post('email/credentials')
  @HttpCode(HttpStatus.OK)
  setEmailCredentials(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(emailCredentialsSchema))
    input: EmailCredentialsInput,
  ): Promise<OtpChallengeResult> {
    return this.auth.setEmailCredentials(user.userId, input);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) input: RefreshTokenInput,
  ): Promise<AuthTokens> {
    return this.auth.refresh(input.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(refreshTokenSchema)) input: RefreshTokenInput,
  ): Promise<void> {
    await this.auth.logout(input.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ user: AuthUser; wallet: WalletAccount }> {
    return this.auth.getSession(user.userId);
  }

  @ApiBearerAuth()
  @Get('pin/status')
  pinStatus(@CurrentUser() user: AuthenticatedUser): Promise<PinStatus> {
    return this.auth.pinStatus(user.userId);
  }

  @ApiBearerAuth()
  @Post('pin/set')
  @HttpCode(HttpStatus.OK)
  setPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(setPinSchema)) input: SetPinInput,
  ): Promise<PinStatus> {
    return this.auth.setPin(user.userId, input.pin);
  }

  @ApiBearerAuth()
  @Post('pin/verify')
  @HttpCode(HttpStatus.OK)
  verifyPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(verifyPinSchema)) input: VerifyPinInput,
  ): Promise<PinStatus> {
    return this.auth.verifyPin(user.userId, input.pin);
  }

  @ApiBearerAuth()
  @Post('pin/change')
  @HttpCode(HttpStatus.OK)
  changePin(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePinSchema)) input: ChangePinInput,
  ): Promise<PinStatus> {
    return this.auth.changePin(user.userId, input.currentPin, input.newPin);
  }
}

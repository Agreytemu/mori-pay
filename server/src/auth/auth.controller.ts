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
  refreshTokenSchema,
  registerSchema,
  requestOtpSchema,
  setPinSchema,
  verifyOtpSchema,
  verifyPinSchema,
  type AuthSession,
  type AuthTokens,
  type AuthUser,
  type ChangePinInput,
  type OtpChallengeResult,
  type PinStatus,
  type RefreshTokenInput,
  type RegisterInput,
  type RequestOtpInput,
  type SetPinInput,
  type VerifyOtpInput,
  type VerifyOtpResult,
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

  @Public()
  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
  ): Promise<AuthSession> {
    return this.auth.register(input);
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

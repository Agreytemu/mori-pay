import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  merchantAccountStatusSchema,
  merchantApplicationReviewSchema,
  merchantApplicationSchema,
  merchantFixedQrSchema,
  merchantPaymentPreviewSchema,
  merchantQrPreviewSchema,
  merchantRegistrationFeeSchema,
  merchantRegistrationPaymentSchema,
  merchantStaticQrSchema,
  payMerchantQrSchema,
  payMerchantSchema,
  type Merchant,
  type MerchantApplicationInput,
  type MerchantPaymentPreview,
  type MerchantPaymentPreviewInput,
  type MerchantRegistrationFee,
  type PayMerchantInput,
  type PayMerchantResult,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { MerchantsService, type AuditContext } from './merchants.service.js';

@ApiTags('merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get()
  list(): Promise<Merchant[]> {
    return this.merchants.list();
  }

  @Get('registration-fee')
  registrationFee(): Promise<MerchantRegistrationFee> {
    return this.merchants.registrationFee();
  }

  @Get('application')
  application(@CurrentUser() user: AuthenticatedUser) {
    return this.merchants.application(user.userId);
  }

  @Post('application')
  @HttpCode(HttpStatus.CREATED)
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(merchantApplicationSchema))
    input: MerchantApplicationInput,
  ) {
    return this.merchants.apply(user.userId, input);
  }

  @Post('application/payment')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  payRegistrationFee(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(merchantRegistrationPaymentSchema))
    input: Parameters<MerchantsService['payRegistrationFee']>[1],
  ) {
    return this.merchants.payRegistrationFee(user.userId, input);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @Body(new ZodValidationPipe(merchantPaymentPreviewSchema))
    input: MerchantPaymentPreviewInput,
  ): Promise<MerchantPaymentPreview> {
    return this.merchants.preview(input);
  }

  @Post('pay')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(payMerchantSchema)) input: PayMerchantInput,
  ): Promise<PayMerchantResult> {
    return this.merchants.pay(user.userId, input);
  }

  @Post('qr/static')
  createStaticQr(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(merchantStaticQrSchema))
    input: Parameters<MerchantsService['createStaticQr']>[1],
  ) {
    return this.merchants.createStaticQr(user.userId, input);
  }

  @Post('qr/fixed')
  createFixedQr(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(merchantFixedQrSchema))
    input: Parameters<MerchantsService['createFixedQr']>[1],
  ) {
    return this.merchants.createFixedQr(user.userId, input);
  }

  @Post('qr/preview')
  @HttpCode(HttpStatus.OK)
  previewQr(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(merchantQrPreviewSchema))
    input: Parameters<MerchantsService['previewQr']>[1],
  ) {
    return this.merchants.previewQr(user.userId, input);
  }

  @Post('qr/pay')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  payQr(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(payMerchantQrSchema))
    input: Parameters<MerchantsService['payQr']>[1],
  ) {
    return this.merchants.payQr(user.userId, input);
  }

  @Post('qr/:codeId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeQr(
    @CurrentUser() user: AuthenticatedUser,
    @Param('codeId') codeId: string,
  ): Promise<void> {
    await this.merchants.revokeQr(user.userId, codeId);
  }

  @Get('admin/applications')
  @UseGuards(AdminRoleGuard)
  adminApplications() {
    return this.merchants.adminApplications();
  }

  @Patch('admin/registration-fee')
  @UseGuards(AdminRoleGuard)
  setRegistrationFee(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(merchantRegistrationFeeSchema))
    input: { amount: number },
  ) {
    return this.merchants.setRegistrationFee(
      user.userId,
      input.amount,
      this.auditContext(request),
    );
  }

  @Patch('admin/applications/:applicationId/review')
  @UseGuards(AdminRoleGuard)
  reviewApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Body(new ZodValidationPipe(merchantApplicationReviewSchema))
    input: Parameters<MerchantsService['reviewApplication']>[2],
  ) {
    return this.merchants.reviewApplication(
      user.userId,
      applicationId,
      input,
      this.auditContext(request),
    );
  }

  @Patch('admin/accounts/:accountId/status')
  @UseGuards(AdminRoleGuard)
  setAccountStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Param('accountId') accountId: string,
    @Body(new ZodValidationPipe(merchantAccountStatusSchema))
    input: Parameters<MerchantsService['setAccountStatus']>[2],
  ) {
    return this.merchants.setAccountStatus(
      user.userId,
      accountId,
      input,
      this.auditContext(request),
    );
  }

  private auditContext(request: Request): AuditContext {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  pushDeviceRegistrationSchema,
  savePaymentMethodSchema,
  updateAccountProfileSchema,
  updateNotificationPreferencesSchema,
  type PushDeviceRegistration,
  type SavePaymentMethodInput,
  type UpdateAccountProfileInput,
  type UpdateNotificationPreferencesInput,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AccountService } from './account.service.js';

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.account.getProfile(user.userId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateAccountProfileSchema))
    input: UpdateAccountProfileInput,
  ) {
    return this.account.updateProfile(user.userId, input);
  }

  @Get('devices')
  listDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.account.listDevices(user.userId);
  }

  @Delete('devices/:id')
  removeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.account.removeDevice(user.userId, id);
  }

  @Put('push-devices')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  registerPushDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(pushDeviceRegistrationSchema))
    input: PushDeviceRegistration,
  ) {
    return this.account.registerPushDevice(user.userId, input);
  }

  @Delete('push-devices/:installationId')
  unregisterPushDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('installationId') installationId: string,
  ) {
    return this.account.unregisterPushDevice(user.userId, installationId);
  }

  @Get('payment-methods')
  listPaymentMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.account.listPaymentMethods(user.userId);
  }

  @Post('payment-methods')
  createPaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(savePaymentMethodSchema))
    input: SavePaymentMethodInput,
  ) {
    return this.account.savePaymentMethod(user.userId, input);
  }

  @Patch('payment-methods/:id')
  updatePaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(savePaymentMethodSchema))
    input: SavePaymentMethodInput,
  ) {
    return this.account.updatePaymentMethod(user.userId, id, input);
  }

  @Delete('payment-methods/:id')
  removePaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.account.removePaymentMethod(user.userId, id);
  }

  @Get('notifications')
  listNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.account.listNotifications(user.userId);
  }

  @Patch('notifications/read-all')
  markAllNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.account.markAllNotificationsRead(user.userId);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.account.markNotificationRead(user.userId, id);
  }

  @Delete('notifications')
  clearNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.account.clearNotifications(user.userId);
  }

  @Delete('notifications/:id')
  deleteNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.account.deleteNotification(user.userId, id);
  }

  @Get('notification-preferences')
  getNotificationPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.account.getNotificationPreferences(user.userId);
  }

  @Patch('notification-preferences')
  updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateNotificationPreferencesSchema))
    input: UpdateNotificationPreferencesInput,
  ) {
    return this.account.updateNotificationPreferences(user.userId, input);
  }
}

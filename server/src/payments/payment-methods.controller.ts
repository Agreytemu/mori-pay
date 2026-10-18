import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PaymentProviderSettingsService } from './payment-provider-settings.service.js';

@ApiTags('payment methods')
@ApiBearerAuth()
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(
    private readonly paymentProviderSettings: PaymentProviderSettingsService,
  ) {}

  @Get('availability')
  getAvailability() {
    return this.paymentProviderSettings.getPaymentMethodVisibility();
  }
}

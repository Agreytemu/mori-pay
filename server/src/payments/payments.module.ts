import { Global, Module } from '@nestjs/common';

import { FeesService } from './fees.service.js';
import { PaymentsService } from './payments.service.js';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { PaymentProviderSettingsService } from './payment-provider-settings.service.js';

@Global()
@Module({
  controllers: [PaymentMethodsController],
  providers: [FeesService, PaymentsService, PaymentProviderSettingsService],
  exports: [FeesService, PaymentsService, PaymentProviderSettingsService],
})
export class PaymentsModule {}

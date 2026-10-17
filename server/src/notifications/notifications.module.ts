import { Global, Module } from '@nestjs/common';

import { PushDeliveryService } from './push-delivery.service.js';

@Global()
@Module({
  providers: [PushDeliveryService],
  exports: [PushDeliveryService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';

import { TopUpsController } from './topups.controller.js';
import { TopUpsService } from './topups.service.js';

@Module({
  controllers: [TopUpsController],
  providers: [TopUpsService],
})
export class TopUpsModule {}

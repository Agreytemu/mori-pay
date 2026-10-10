import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { SmsModule } from '../sms/sms.module.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [SmsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    TokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}

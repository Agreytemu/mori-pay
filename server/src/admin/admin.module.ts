import { Module } from '@nestjs/common';

import { AdminRoleGuard } from '../merchants/admin-role.guard.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { InitialSuperAdminBootstrap } from './initial-super-admin.bootstrap.js';

@Module({
  imports: [WebhooksModule],
  controllers: [AdminController],
  providers: [AdminRoleGuard, AdminService, InitialSuperAdminBootstrap],
})
export class AdminModule {}

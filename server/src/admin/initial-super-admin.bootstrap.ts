import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { generateNumericCode, hashPassword } from '../common/crypto.js';
import type { Env } from '../config/env.validation.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const BOOTSTRAP_LOCK_CLASS = 71_920;
const BOOTSTRAP_LOCK_ID = 1;

@Injectable()
export class InitialSuperAdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitialSuperAdminBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get('INITIAL_SUPER_ADMIN_EMAIL', { infer: true });
    const password = this.config.get('INITIAL_SUPER_ADMIN_PASSWORD', { infer: true });
    if (!email || !password) return;

    const name = this.config.get('INITIAL_SUPER_ADMIN_NAME', { infer: true })
      ?? 'Mori Pay Super Admin';

    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_CLASS}, ${BOOTSTRAP_LOCK_ID})
      `;

      const existingSuperAdmin = await tx.user.findFirst({
        where: { adminStaffRole: 'super_admin' },
        select: { id: true },
      });
      if (existingSuperAdmin) return 'already-provisioned' as const;

      const matchingUser = await tx.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchingUser) {
        throw new ConflictException(
          'Initial super-admin email belongs to an existing account; no account was changed',
        );
      }

      const user = await tx.user.create({
        data: {
          email,
          emailVerifiedAt: new Date(),
          passwordHash: await hashPassword(password),
          fullName: name,
          firstName: name.split(/\s+/)[0] ?? name,
          memberId: `MP${generateNumericCode(12)}`,
          status: 'active',
          role: 'admin',
          adminStaffRole: 'super_admin',
        },
        select: { id: true },
      });
      const wallet = await tx.wallet.create({
        data: {
          userId: user.id,
          currency: 'TZS',
          accountNumber: generateNumericCode(10),
        },
        select: { id: true },
      });
      await tx.ledgerAccount.create({
        data: {
          walletId: wallet.id,
          kind: 'available',
          currency: 'TZS',
          balance: 0n,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'admin.bootstrap.initial_super_admin',
          metadata: { source: 'environment' },
        },
      });

      return 'created' as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    if (outcome === 'created') {
      this.logger.warn(
        'Initial super admin was created. Remove INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD from the deployment environment.',
      );
    } else {
      this.logger.log(
        'A super admin already exists; initial super-admin provisioning was skipped.',
      );
    }
  }
}

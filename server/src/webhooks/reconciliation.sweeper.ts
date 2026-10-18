import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReconciliationService } from './reconciliation.service.js';

const BATCH_SIZE = 100;

/**
 * Periodically settles gateway transactions that are still pending/processing
 * after the stale window. Abliner does not guarantee webhook delivery, and the
 * docs are explicit that a missing webhook must never be read as failure — so
 * any stale row is re-checked against the provider and only finalised when
 * Abliner reports a terminal status.
 */
@Injectable()
export class ReconciliationSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationSweeper.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  onModuleInit(): void {
    const { enabled, intervalSeconds } = this.config.reconciliation;
    if (!enabled) {
      this.logger.log('Reconciliation sweeper disabled');
      return;
    }
    this.timer = setInterval(
      () => void this.sweep(),
      intervalSeconds * 1000,
    );
    this.timer.unref?.();
    this.logger.log(
      `Reconciliation sweeper running every ${intervalSeconds}s`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Reconciles a batch of stale gateway transactions. Returns the batch size. */
  async sweep(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const cutoff = new Date(
        Date.now() - this.config.reconciliation.staleSeconds * 1000,
      );
      const stale = await this.prisma.transaction.findMany({
        where: {
          provider: { in: ['abliner', 'clickpesa'] },
          status: { in: ['pending', 'processing'] },
          createdAt: { lt: cutoff },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      let checked = 0;
      for (const transaction of stale) {
        try {
          await this.reconciliation.reconcile(transaction);
          checked += 1;
        } catch (error) {
          this.logger.warn(
            `Sweep reconcile failed for ${transaction.reference}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      if (checked > 0) {
        this.logger.log(`Reconciliation sweep checked ${checked} transaction(s)`);
      }
      return checked;
    } catch (error) {
      this.logger.error(
        `Reconciliation sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}

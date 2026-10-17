import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  KycOverview,
  KycSubmission,
  SubmitKycInput,
} from '@mori-pay/contracts';

import type { KycSubmission as KycSubmissionRow } from '../generated/prisma/client.js';
import { encryptField } from '../common/field-encryption.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * KYC documents reuse the shared field-encryption key. The ID number is stored
 * encrypted; only the last four characters are kept in clear for masked display.
 */
const KYC_ENCRYPTION_OPTIONS = {
  envName: 'PAYMENT_METHOD_ENCRYPTION_KEY',
  invalidMessage: 'Stored KYC data is invalid.',
} as const;

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async getOverview(userId: string): Promise<KycOverview> {
    const [user, latest] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { tier: true, kycLevel: true },
      }),
      this.prisma.kycSubmission.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      tier: user.tier,
      kycLevel: user.kycLevel,
      status: latest?.status ?? null,
      latest: latest ? this.toSubmission(latest) : null,
    };
  }

  async submit(userId: string, input: SubmitKycInput): Promise<KycOverview> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tier: true },
    });
    if (user.tier === 'Verified') {
      throw new BadRequestException('Your account is already verified.');
    }

    const pending = await this.prisma.kycSubmission.findFirst({
      where: { userId, status: 'pending' },
      select: { id: true },
    });
    if (pending) {
      throw new BadRequestException(
        'You already have a verification submission under review.',
      );
    }

    const documentNumber = input.documentNumber.trim().toUpperCase();
    await this.prisma.kycSubmission.create({
      data: {
        userId,
        documentType: input.documentType,
        documentNumber: encryptField(
          documentNumber,
          this.config.paymentMethodEncryptionKey,
          KYC_ENCRYPTION_OPTIONS,
        ),
        documentNumberLast4: documentNumber.slice(-4),
        documentImage: input.documentImage,
        status: 'pending',
      },
    });

    return this.getOverview(userId);
  }

  private toSubmission(row: KycSubmissionRow): KycSubmission {
    return {
      id: row.id,
      documentType: row.documentType,
      documentNumberLast4: row.documentNumberLast4,
      status: row.status,
      rejectionReason: row.rejectionReason,
      submittedAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      hasDocumentImage: Boolean(row.documentImage),
    };
  }
}

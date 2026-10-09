import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type {
  Paginated,
  Transaction as TransactionDto,
  WalletAccount,
} from '@mori-pay/contracts';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/constants.js';
import { WalletService } from './wallet.service.js';

function normalizeTypes(type?: string | string[]): string[] | undefined {
  if (!type) return undefined;
  const values = (Array.isArray(type) ? type : type.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getWallet(@CurrentUser() user: AuthenticatedUser): Promise<WalletAccount> {
    return this.wallet.getWallet(user.userId);
  }

  @Get('transactions')
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('type') type?: string | string[],
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<Paginated<TransactionDto>> {
    const take = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.parseInt(limit ?? '', 10) || DEFAULT_PAGE_SIZE),
    );

    return this.wallet.listTransactions(user.userId, {
      query: q?.trim() || undefined,
      types: normalizeTypes(type),
      status,
      cursor: cursor ?? null,
      limit: take,
    });
  }

  @Get('transactions/:id')
  getTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TransactionDto> {
    return this.wallet.getTransaction(user.userId, id);
  }
}

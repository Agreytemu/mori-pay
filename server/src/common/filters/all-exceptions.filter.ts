import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import type { ApiErrorBody, ApiErrorCode } from '@mori-pay/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import { DomainError } from '../errors.js';

type HttpRequest = Request & { id?: string };

/**
 * Converts every thrown value into the shared `{ error, message, details }`
 * envelope so clients never have to special-case Nest or Prisma errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<HttpRequest>();

    const { status, error, message, details } = this.describe(exception);

    const body: ApiErrorBody & {
      requestId?: string;
      timestamp: string;
      path: string;
    } = {
      error,
      message,
      ...(details ? { details } : {}),
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private describe(exception: unknown): {
    status: number;
    error: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { issues: exception.issues },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.describePrisma(exception);
    }

    if (exception instanceof DomainError) {
      return this.describeDomain(exception);
    }

    if (exception instanceof HttpException) {
      return this.describeHttp(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'APP_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private describeHttp(exception: HttpException) {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    let message = exception.message;
    let details: Record<string, unknown> | undefined;

    if (typeof payload === 'string') {
      message = payload;
    } else if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.message)) {
        message = (record.message as string[]).join(', ');
        details = { issues: record.message };
      } else if (typeof record.message === 'string') {
        message = record.message;
      }
    }

    return { status, error: this.statusToCode(status), message, details };
  }

  private describeDomain(exception: DomainError): {
    status: number;
    error: ApiErrorCode;
    message: string;
  } {
    const status =
      exception.code === 'INSUFFICIENT_FUNDS'
        ? HttpStatus.CONFLICT
        : exception.code === 'PROVIDER_ERROR'
          ? HttpStatus.BAD_GATEWAY
          : HttpStatus.BAD_REQUEST;
    return {
      status,
      error: this.statusToCode(status),
      message: exception.message,
    };
  }

  private describePrisma(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          error: 'CONFLICT' as ApiErrorCode,
          message: 'A record with these details already exists',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'NOT_FOUND' as ApiErrorCode,
          message: 'The requested resource was not found',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'VALIDATION_ERROR' as ApiErrorCode,
          message: 'Database request could not be completed',
        };
    }
  }

  private statusToCode(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.BAD_GATEWAY:
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'PROVIDER_ERROR';
      default:
        return status >= 500 ? 'APP_ERROR' : 'VALIDATION_ERROR';
    }
  }
}

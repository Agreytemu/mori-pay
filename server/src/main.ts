import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { API_PREFIX } from './common/constants.js';
import { AppConfigService } from './config/app-config.service.js';

// TZS amounts are stored as BigInt in Postgres; teach JSON how to serialise them.
// Amounts stay well within Number.MAX_SAFE_INTEGER.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(AppConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.use(helmet());

  const origins = config.corsOrigins;
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle(`${config.appName}`)
    .setDescription('Mori Pay wallet & payments API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'x-request-id', in: 'header' },
      'request-id',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');

  logger.log(
    `${config.appName} listening on http://0.0.0.0:${config.port}/${API_PREFIX} (docs at /docs)`,
  );
}

void bootstrap();

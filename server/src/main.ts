import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { API_PREFIX } from './common/constants.js';
import { installBigIntJsonSerialization } from './common/bigint-json.js';
import { AppConfigService } from './config/app-config.service.js';

// TZS amounts are stored as BigInt in Postgres; serialise them without losing
// precision (in-range values stay numbers to preserve the API contract).
installBigIntJsonSerialization();

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
  const allowsAllOrigins = origins.includes('*');
  app.enableCors({
    origin: allowsAllOrigins ? true : origins,
    // A wildcard origin must never be combined with credentials.
    credentials: !allowsAllOrigins,
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

  if (!config.isProduction) {
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
  }

  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');

  logger.log(
    `${config.appName} listening on http://0.0.0.0:${config.port}/${API_PREFIX}` +
      (config.isProduction ? '' : ' (docs at /docs)'),
  );
}

void bootstrap();

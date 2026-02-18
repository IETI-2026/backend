import { AllExceptionsFilter } from '@common/filters';
import { LoggingInterceptor } from '@common/interceptors';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api', {
    exclude: ['/', 'health'],
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Cameyo API')
    .setDescription('API de la plataforma Cameyo - Servicios bajo demanda')
    .setVersion('1.0')
    .addTag('users', 'Gestión de usuarios')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Cameyo API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css',
    ],
  });

  // Get port from config
  const port = configService.get<number>('app.port') || 3000;
  const nodeEnv = configService.get<string>('app.nodeEnv');

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`Swagger JSON: http://localhost:${port}/api/docs-json`);
}

bootstrap();

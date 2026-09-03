import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // rawBody: true dá acesso a req.rawBody nos handlers — necessário pra
  // validar a assinatura HMAC (X-Liro-Signature) do webhook do Liro CRM
  // contra os bytes exatos que ele assinou (reserializar o JSON já
  // parseado nem sempre reproduz o byte a byte original).
  const app = await NestFactory.create(AppModule, { cors: false, rawBody: true });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Plataforma de Dados — API')
    .setDescription(
      'API do CRM, Financeiro, Pós-venda e Inteligência de Dados (consulta de CNPJ, crédito, CPF, telefone e cruzamento de dados).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API rodando em http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`📘 Swagger em http://localhost:${port}/api/docs`);
}

bootstrap();

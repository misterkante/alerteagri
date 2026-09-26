import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { missingEnv } from './common/env';

export function configure(app: INestApplication): INestApplication {
  // Render adds three hops (local proxy, internal network, Cloudflare) in front of the app, and a
  // client can prepend any address it likes. Trusting exactly those hops yields the real client.
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (hops > 0) (app as NestExpressApplication).set('trust proxy', hops);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}

async function bootstrap() {
  const missing = missingEnv(process.env);
  if (missing.length)
    throw new Error(`Configuration incomplète : ${missing.join(', ')}`);
  const app = configure(await NestFactory.create(AppModule));
  const config = new DocumentBuilder()
    .setTitle('AlerteAgri API')
    .setDescription(
      'Monitoring, alerte précoce, conseil, réglementation, recettes locales et traçabilité pour les acteurs agricoles du Bénin. Les routes « marché » forment une API ouverte pour les places de marché tierces.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`AlerteAgri API sur http://localhost:${port} (docs: /docs)`);
}

if (require.main === module) void bootstrap();

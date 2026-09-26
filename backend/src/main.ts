import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { missingEnv } from './common/env';

export function configure(app: INestApplication): INestApplication {
  // Temporary diagnostic: how the host passes the client address (removed once trust proxy is set).
  app.use(
    (
      req: {
        headers: Record<string, unknown>;
        socket: { remoteAddress?: string };
        path: string;
      },
      _res: unknown,
      next: () => void,
    ) => {
      if (req.path === '/health' && req.headers['x-ip-diag'] === 'alerteagri')
        // eslint-disable-next-line no-console
        console.log(
          'IPDIAG',
          JSON.stringify({
            xff: req.headers['x-forwarded-for'],
            real: req.headers['x-real-ip'],
            cf: req.headers['cf-connecting-ip'],
            tci: req.headers['true-client-ip'],
            remote: req.socket.remoteAddress,
          }),
        );
      next();
    },
  );
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

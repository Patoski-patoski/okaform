import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

function isOriginAllowed(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
      : []),
  ];

  if (!origin) {
    return callback(null, true);
  }

  const isAllowed = allowedOrigins.some((allowed) => {
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1);
      return origin.endsWith(suffix);
    }
    return allowed === origin;
  });

  if (isAllowed) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'), false);
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: isOriginAllowed,
      credentials: true,
    },
  });
  app.use(cookieParser());
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
  console.error('Error starting the application:', err);
  process.exit(1);
});

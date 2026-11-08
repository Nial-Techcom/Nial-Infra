import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import type { Config } from './config';
import { errorMiddleware, HttpError } from './errors';
import { buildRouter } from './routes';

export function createApp(pool: Pool, cfg: Config) {
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      // No Origin header = mobile app / curl. The desktop app loads its UI from a file, so the browser engine
      // sends the literal origin "null": allowed too. Auth uses a Bearer token (no cookies), so this adds no CSRF risk.
      origin: (origin, cb) => cb(null, !origin || origin === 'null' || cfg.corsOrigins.includes('*') || cfg.corsOrigins.includes(origin)),
      allowedHeaders: ['Authorization', 'Content-Type'],
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/v1', buildRouter(pool, cfg));
  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use(errorMiddleware);
  return app;
}

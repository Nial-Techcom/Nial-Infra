import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Pool } from 'pg';
import type { Config } from './config';
import { errorMiddleware, HttpError } from './errors';
import { LicenseService } from './license/service';
import { buildRouter } from './routes';

export function createApp(pool: Pool, cfg: Config, license: LicenseService = new LicenseService(pool, cfg)) {
  const app = express();
  app.locals.license = license;
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
  // Generous global ceiling per IP (the login/account routes have much stricter ones of their own).
  app.use('/api', rateLimit({ windowMs: 60_000, limit: cfg.apiRateLimit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
  // Responses carry tokens, credentials and private network data: never let a browser or proxy cache them.
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/v1', license.gate());
  app.use('/api/v1', buildRouter(pool, cfg, license));
  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use(errorMiddleware);
  return app;
}

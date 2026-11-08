import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Wraps an async route so rejected promises reach the error middleware (Express 4). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  const e = err as { code?: string; type?: string; status?: number };
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (e?.code === '23505') return res.status(409).json({ error: 'Already exists' });
  if (e?.code === '23503') return res.status(409).json({ error: 'Referenced item does not exist' });
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

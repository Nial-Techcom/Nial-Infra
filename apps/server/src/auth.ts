import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@nial-infra/shared';
import type { Pool } from 'pg';
import type { Config } from './config';
import { HttpError } from './errors';
import { users } from './store';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * `pv` ("password version") is the time of the user's last password change (0 = never). A token is only valid while
 * it still matches, so any password change or reset cuts every older session at once, with no timing window.
 */
export function signToken(user: User, cfg: Config, passwordVersion = 0): string {
  return jwt.sign({ role: user.role, pv: passwordVersion }, cfg.jwtSecret, { algorithm: 'HS256', subject: user.id, expiresIn: '12h' });
}

/**
 * Verifies the bearer token, then reloads the user from the database on every request:
 * a deleted or demoted user loses access immediately instead of when the token expires.
 */
export function authenticate(pool: Pool, cfg: Config) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const h = req.headers.authorization;
      if (!h?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required');
      let payload: jwt.JwtPayload;
      try {
        payload = jwt.verify(h.slice(7), cfg.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      } catch {
        throw new HttpError(401, 'Invalid or expired token');
      }
      const found = payload.sub ? await users.getAuth(pool, payload.sub) : null;
      if (!found) throw new HttpError(401, 'Invalid or expired token');
      if ((typeof payload.pv === 'number' ? payload.pv : 0) !== found.passwordChangedAt) throw new HttpError(401, 'Invalid or expired token');
      req.user = found.user;
      next();
    } catch (e) {
      next(e);
    }
  };
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Insufficient permissions'));
    next();
  };

export const adminOnly = requireRole('admin');
export const canWrite = requireRole('admin', 'technician');

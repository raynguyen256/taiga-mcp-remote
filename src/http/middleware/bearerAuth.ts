import type { Request, Response, NextFunction } from 'express';
import type { InMemorySessionStore } from '../../session/sessionStore.js';
import type { UserSession } from '../../session/types.js';

declare global {
  namespace Express {
    interface Request {
      userSession?: UserSession;
    }
  }
}

export function createBearerAuth(sessionStore: InMemorySessionStore) {
  return function bearerAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }

    const token = authHeader.slice(7);
    const session = sessionStore.get(token);

    if (!session) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.userSession = session;
    next();
  };
}

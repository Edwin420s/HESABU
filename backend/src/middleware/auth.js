import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../shared/errors.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Authentication required.', 401, 'UNAUTHENTICATED');
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError('Account not found.', 401, 'UNAUTHENTICATED');
    req.user = { id: user.id, name: user.name, email: user.email };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid or expired token.', 401, 'UNAUTHENTICATED'));
  }
}

export async function requireWorkspaceRole(req, _res, next) {
  try {
    const workspaceId = req.params.workspaceId || req.params.id;
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId } }
    });
    if (!membership) throw new AppError('You do not have access to this workspace.', 403, 'FORBIDDEN');
    req.membership = membership;
    next();
  } catch (error) { next(error); }
}

export function allowRoles(...roles) {
  return (req, _res, next) => {
    if (!req.membership || !roles.includes(req.membership.role)) {
      return next(new AppError('Your workspace role cannot perform this action.', 403, 'FORBIDDEN'));
    }
    next();
  };
}

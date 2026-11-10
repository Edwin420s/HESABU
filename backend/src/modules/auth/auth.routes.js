import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
const credentials = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(10).max(128)
});
const issueToken = (user) => jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
const safeUser = ({ id, name, email, createdAt }) => ({ id, name, email, createdAt });

router.post('/register', asyncHandler(async (req, res) => {
  const data = credentials.extend({ name: z.string().trim().min(2).max(80) }).parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new AppError('An account with this email already exists.', 409);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({ data: { name: data.name, email: data.email, passwordHash } });
  res.status(201).json({ user: safeUser(user), token: issueToken(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const data = credentials.omit({ name: true }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
  }
  res.json({ user: safeUser(user), token: issueToken(user) });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, createdAt: true } });
  res.json({ user });
}));
export default router;

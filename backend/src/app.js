import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import workspaceRoutes from './modules/workspaces/workspaces.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import campaignRoutes from './modules/campaigns/campaigns.routes.js';
import reimbursementRoutes from './modules/reimbursements/reimbursements.routes.js';
import recurringRoutes from './modules/recurring/recurring.routes.js';
import anchorRoutes from './modules/anchors/anchors.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { invitationsRouter } from './modules/invitations/invitations.routes.js';
import { fxRouter } from './modules/fx/fx.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { roscaRouter } from './modules/rosca/rosca.routes.js';
import { loanRouter } from './modules/loans/loan.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

import { prisma } from './config/prisma.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map(v => v.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', async (_req, res) => {
  const start = Date.now();
  let dbStatus = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'degraded';
  }
  const dbLatencyMs = Date.now() - start;

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    service: 'hesabu-api',
    mode: env.PAYMENT_MODE,
    network: env.STELLAR_NETWORK,
    database: { status: dbStatus, latencyMs: dbLatencyMs },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', invitationsRouter);
app.use('/api', fxRouter);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', financeRoutes);
app.use('/api', campaignRoutes);
app.use('/api', reimbursementRoutes);
app.use('/api', recurringRoutes);
app.use('/api', anchorRoutes);
app.use('/api', analyticsRouter);
app.use('/api', notificationsRouter);
app.use('/api', auditRouter);
app.use('/api', roscaRouter);
app.use('/api', loanRouter);

app.use(notFound);
app.use(errorHandler);

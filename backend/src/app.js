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
import { notFound, errorHandler } from './middleware/errorHandler.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map(v => v.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'hesabu-api', mode: env.PAYMENT_MODE, network: env.STELLAR_NETWORK }));

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', financeRoutes);
app.use('/api', campaignRoutes);
app.use('/api', reimbursementRoutes);
app.use('/api', recurringRoutes);
app.use('/api', anchorRoutes);

app.use(notFound);
app.use(errorHandler);

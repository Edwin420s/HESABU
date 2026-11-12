import 'dotenv/config';
import { z } from 'zod';

const nodeEnv = process.env.NODE_ENV || 'development';
const defaultPaymentMode = nodeEnv === 'production' ? 'live' : 'development';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PAYMENT_MODE: z.enum(['development', 'live']).default(defaultPaymentMode),
  STELLAR_NETWORK: z.enum(['testnet', 'public']).default('testnet'),
  STELLAR_HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  ZA_PAYMENT_WEBHOOK_SECRET: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && data.PAYMENT_MODE === 'development') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'PAYMENT_MODE cannot be "development" when running in production (NODE_ENV=production). Must be "live".',
      path: ['PAYMENT_MODE']
    });
  }
});

export const env = schema.parse(process.env);

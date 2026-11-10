import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookRetryWorker } from '../src/jobs/webhookRetryWorker.js';

describe('Webhook Retry & Dead Letter Queue Worker', () => {
  let worker;

  beforeEach(() => {
    worker = new WebhookRetryWorker({
      maxAttempts: 3,
      initialBackoffMs: 10,
      backoffMultiplier: 2,
    });
  });

  it('enqueues a webhook job and initializes metadata correctly', () => {
    const job = worker.enqueueWebhook('payment.settled', 'https://api.example.com/webhooks', {
      amountMinor: 500000,
      currency: 'KES',
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('PENDING');
    expect(job.attempts).toBe(0);
    expect(job.headers['X-Hesabu-Event']).toBe('payment.settled');

    const metrics = worker.getMetrics();
    expect(metrics.pendingCount).toBe(1);
    expect(metrics.deadLetterCount).toBe(0);
  });

  it('delivers successfully on first attempt and removes job from queue', async () => {
    worker.enqueueWebhook('obligation.created', 'https://api.example.com/webhooks', { id: 'ob_123' });

    let called = false;
    const mockDispatcher = async (url, payload, headers) => {
      called = true;
      return { status: 200, body: { ok: true } };
    };

    const result = await worker.processQueue(mockDispatcher);
    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(1);
    expect(called).toBe(true);

    const metrics = worker.getMetrics();
    expect(metrics.totalQueued).toBe(0);
  });

  it('retries with backoff and moves to dead letter queue after max attempts', async () => {
    const job = worker.enqueueWebhook('payout.failed', 'https://api.example.com/webhooks', { id: 'p_99' });

    const failingDispatcher = async () => {
      throw new Error('Connection refused (ETIMEDOUT)');
    };

    // Attempt 1
    const r1 = await worker.processQueue(failingDispatcher);
    expect(r1.processed).toBe(1);
    expect(r1.failed).toBe(1);
    expect(job.attempts).toBe(1);
    expect(job.status).toBe('PENDING');

    // Wait for backoff
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Attempt 2
    const r2 = await worker.processQueue(failingDispatcher);
    expect(r2.processed).toBe(1);
    expect(job.attempts).toBe(2);

    // Wait for backoff
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Attempt 3 (reaches maxAttempts)
    const r3 = await worker.processQueue(failingDispatcher);
    expect(r3.processed).toBe(1);
    expect(r3.movedToDeadLetter).toBe(1);

    const metrics = worker.getMetrics();
    expect(metrics.totalQueued).toBe(0);
    expect(metrics.deadLetterCount).toBe(1);

    const dlq = worker.getDeadLetterQueue();
    expect(dlq.length).toBe(1);
    expect(dlq[0].lastError).toContain('Connection refused');
    expect(dlq[0].history.length).toBe(3);
  });

  it('allows manual replay of dead letter jobs', async () => {
    const job = worker.enqueueWebhook('anchor.settled', 'https://api.example.com/webhooks', {});
    const failingDispatcher = async () => { throw new Error('Failed'); };

    // Push into DLQ
    for (let i = 0; i < 3; i++) {
      job.nextRetryAt = new Date(0);
      await worker.processQueue(failingDispatcher);
    }

    expect(worker.getMetrics().deadLetterCount).toBe(1);

    // Replay job with successful dispatcher
    const successDispatcher = async () => ({ status: 200 });
    const replayResult = await worker.retryDeadLetter(job.id, successDispatcher);

    expect(replayResult.delivered).toBe(1);
    expect(worker.getMetrics().deadLetterCount).toBe(0);
    expect(worker.getMetrics().totalQueued).toBe(0);
  });
});

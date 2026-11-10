import crypto from 'crypto';

export class WebhookRetryWorker {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 5;
    this.initialBackoffMs = options.initialBackoffMs || 1000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.queue = new Map();
    this.deadLetterQueue = new Map();
  }

  /**
   * Enqueue a webhook job for reliable delivery
   */
  enqueueWebhook(event, targetUrl, payload, headers = {}) {
    const id = `wh_${crypto.randomBytes(12).toString('hex')}`;
    const job = {
      id,
      event,
      targetUrl,
      payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Hesabu-Event': event,
        'X-Hesabu-Delivery-Id': id,
        ...headers,
      },
      attempts: 0,
      status: 'PENDING',
      createdAt: new Date(),
      nextRetryAt: new Date(),
      lastError: null,
      history: [],
    };

    this.queue.set(id, job);
    return job;
  }

  /**
   * Process pending items in the retry queue
   * @param {Function} dispatchFn - Async callback (targetUrl, payload, headers) => Promise<{ status: number, body?: any }>
   */
  async processQueue(dispatchFn) {
    const now = new Date();
    const results = {
      processed: 0,
      delivered: 0,
      failed: 0,
      movedToDeadLetter: 0,
    };

    for (const [id, job] of this.queue.entries()) {
      if (job.status === 'PROCESSING') continue;
      if (job.nextRetryAt > now) continue;

      job.status = 'PROCESSING';
      job.attempts += 1;
      results.processed += 1;

      try {
        const response = await dispatchFn(job.targetUrl, job.payload, job.headers);

        if (response && response.status >= 200 && response.status < 300) {
          job.status = 'DELIVERED';
          job.deliveredAt = new Date();
          job.history.push({
            attempt: job.attempts,
            timestamp: new Date(),
            success: true,
            status: response.status,
          });
          results.delivered += 1;
          this.queue.delete(id);
        } else {
          throw new Error(`Endpoint returned HTTP status ${response?.status || 'UNKNOWN'}`);
        }
      } catch (err) {
        job.lastError = err.message || 'Unknown network error';
        job.history.push({
          attempt: job.attempts,
          timestamp: new Date(),
          success: false,
          error: job.lastError,
        });

        if (job.attempts >= this.maxAttempts) {
          job.status = 'DEAD_LETTER';
          job.failedAt = new Date();
          this.deadLetterQueue.set(id, job);
          this.queue.delete(id);
          results.movedToDeadLetter += 1;
        } else {
          job.status = 'PENDING';
          const delay = this.initialBackoffMs * Math.pow(this.backoffMultiplier, job.attempts - 1);
          job.nextRetryAt = new Date(Date.now() + delay);
          results.failed += 1;
        }
      }
    }

    return results;
  }

  /**
   * Replay a job from the dead letter queue
   */
  async retryDeadLetter(jobId, dispatchFn) {
    const job = this.deadLetterQueue.get(jobId);
    if (!job) {
      throw new Error(`Dead letter job ${jobId} not found`);
    }

    job.status = 'PENDING';
    job.attempts = 0;
    job.nextRetryAt = new Date();
    this.queue.set(jobId, job);
    this.deadLetterQueue.delete(jobId);

    if (dispatchFn) {
      return this.processQueue(dispatchFn);
    }
    return job;
  }

  /**
   * Inspect current worker health and queue counts
   */
  getMetrics() {
    return {
      pendingCount: Array.from(this.queue.values()).filter((j) => j.status === 'PENDING').length,
      processingCount: Array.from(this.queue.values()).filter((j) => j.status === 'PROCESSING').length,
      deadLetterCount: this.deadLetterQueue.size,
      totalQueued: this.queue.size,
    };
  }

  /**
   * Retrieve list of dead letter jobs
   */
  getDeadLetterQueue() {
    return Array.from(this.deadLetterQueue.values());
  }

  /**
   * Flush all queues (useful for testing)
   */
  clearQueue() {
    this.queue.clear();
    this.deadLetterQueue.clear();
  }
}

export const webhookWorker = new WebhookRetryWorker();

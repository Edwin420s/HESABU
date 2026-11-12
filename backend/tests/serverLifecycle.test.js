import { describe, it, expect } from 'vitest';
import http from 'http';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Production Server Lifecycle & HTTP Smoke Test', () => {
  it('starts express server on ephemeral port, answers /api/health, and shuts down gracefully', async () => {
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    expect(port).toBeGreaterThan(0);

    // Perform live HTTP request
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('hesabu-api');
    expect(body.database.status).toBe('connected');

    // Gracefully shutdown
    await new Promise((resolve) => server.close(resolve));
  });
});

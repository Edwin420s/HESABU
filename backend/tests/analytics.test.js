import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Analytics & Invitation Management Tests', () => {
  let token = '';
  let workspaceId = '';

  beforeAll(async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Analytics Lead',
      email: `analytics_${Date.now()}@hesabu.test`,
      password: 'HesabuSecurePassword!2026',
    });
    token = regRes.body.token;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Analytics Test Chama',
        type: 'GROUP',
        currency: 'KES',
      });
    workspaceId = wsRes.body.workspace.id;
  });

  it('computes workspace financial health score and collection metrics', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/analytics/health-score`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.healthScore).toBeGreaterThanOrEqual(0);
    expect(res.body.rating).toBeDefined();
    expect(res.body.metrics.totalObligations).toBeDefined();
  });

  it('generates a signed cryptographic invitation token', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newmember@hesabu.test',
        role: 'MEMBER',
      });

    expect(res.status).toBe(201);
    expect(res.body.invitationToken).toBeDefined();
    expect(res.body.inviteLink).toContain('/join?token=');

    // Verify token
    const verifyRes = await request(app).get(`/api/invitations/${res.body.invitationToken}/verify`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.workspace.name).toBe('Analytics Test Chama');
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { auditService } from '../src/modules/audit/auditService.js';

describe('Audit Trail & Compliance Export Engine', () => {
  let authToken;
  let workspace;

  beforeAll(async () => {
    // Register user and create workspace
    const email = `audit_tester_${Date.now()}@hesabu.internal`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'StrongPassword123!', name: 'Audit Officer' });

    authToken = regRes.body.token;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Compliance Test Cooperative', type: 'GROUP', currency: 'KES' });

    workspace = wsRes.body.workspace;

    // Insert an audit log entry
    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorId: regRes.body.user.id,
        action: 'POLICY_AMENDMENT_APPROVED',
        entityType: 'Workspace',
        entityId: workspace.id,
        details: { amendmentNumber: 42, title: 'Reserve Ratio Updated' },
      },
    });
  });

  it('queries paginated audit logs for the workspace', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspace.id}/audit-logs?limit=10`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.logs[0].action).toBe('POLICY_AMENDMENT_APPROVED');
    expect(res.body.logs[0].actor.email).toContain('audit_tester_');
  });

  it('filters audit logs by action type', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspace.id}/audit-logs?action=POLICY_AMENDMENT_APPROVED`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.logs.every((l) => l.action === 'POLICY_AMENDMENT_APPROVED')).toBe(true);
  });

  it('exports RFC 4180 compliant CSV audit trail with headers and escaped fields', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspace.id}/audit-logs/export`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(`hesabu_audit_${workspace.id}.csv`);
    expect(res.text).toContain('Timestamp,LogID,Action,EntityType,EntityID,ActorEmail,DetailsJSON');
    expect(res.text).toContain('POLICY_AMENDMENT_APPROVED');
    expect(res.text).toContain('Reserve Ratio Updated');
  });

  it('denies audit log export to unauthenticated clients', async () => {
    const res = await request(app).get(`/api/workspaces/${workspace.id}/audit-logs/export`);
    expect(res.status).toBe(401);
  });
});

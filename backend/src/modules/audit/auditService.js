import { prisma } from '../../config/prisma.js';

export class AuditService {
  /**
   * Query paginated audit log entries for a workspace
   */
  async getAuditLogs(workspaceId, { limit = 50, offset = 0, action = null } = {}) {
    const where = { workspaceId };
    if (action) {
      where.action = action;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        take: Math.min(Number(limit) || 50, 200),
        skip: Number(offset) || 0,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
      logs,
    };
  }

  /**
   * Format audit log records into RFC 4180 compliant CSV string
   */
  async exportCsv(workspaceId) {
    const logs = await prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            email: true,
          },
        },
      },
    });

    const headers = ['Timestamp', 'LogID', 'Action', 'EntityType', 'EntityID', 'ActorEmail', 'DetailsJSON'];
    const rows = [headers.join(',')];

    for (const log of logs) {
      const detailsStr = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
      const actorEmail = log.actor?.email || 'SYSTEM';

      const fields = [
        `"${log.createdAt.toISOString()}"`,
        `"${log.id}"`,
        `"${log.action}"`,
        `"${log.entityType}"`,
        `"${log.entityId}"`,
        `"${actorEmail}"`,
        `"${detailsStr}"`,
      ];

      rows.push(fields.join(','));
    }

    return rows.join('\r\n');
  }
}

export const auditService = new AuditService();

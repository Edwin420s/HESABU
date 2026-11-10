import crypto from 'crypto';

export class NotificationService {
  constructor() {
    this.logs = [];
  }

  /**
   * Format SMS message for dues obligation
   */
  formatObligationSms({ memberName, amountFormatted, currency, dueDate, workspaceName }) {
    return `HESABU: Hello ${memberName}, a new contribution of ${currency} ${amountFormatted} for ${workspaceName} is due on ${dueDate}. Settle via M-Pesa or Stellar to keep your account current.`;
  }

  /**
   * Format SMS message for payment confirmation
   */
  formatPaymentReceiptSms({ memberName, amountFormatted, currency, receiptNumber, workspaceName }) {
    return `HESABU: Payment received! ${currency} ${amountFormatted} confirmed for ${workspaceName}. Ref: ${receiptNumber}. Thank you for your contribution.`;
  }

  /**
   * Format SMS message for expense dual-approval request
   */
  formatApprovalRequestSms({ approverName, amountFormatted, currency, description, workspaceName }) {
    return `HESABU: Action Required. Hello ${approverName}, an expense approval of ${currency} ${amountFormatted} (${description}) in ${workspaceName} requires your secondary sign-off.`;
  }

  /**
   * Format HTML email body
   */
  formatEmailHtml({ title, preheader, contentLines, actionUrl, actionLabel, workspaceName }) {
    const linesHtml = contentLines.map((line) => `<p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">${line}</p>`).join('');
    const actionHtml = actionUrl
      ? `<div style="margin: 28px 0; text-align: center;">
          <a href="${actionUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">${actionLabel || 'View in HESABU'}</a>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px;">
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px;">
      <h2 style="margin: 0; color: #0f172a; font-size: 20px; letter-spacing: -0.5px;">HESABU | ${workspaceName}</h2>
      ${preheader ? `<span style="font-size: 13px; color: #64748b;">${preheader}</span>` : ''}
    </div>
    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 17px;">${title}</h3>
      ${linesHtml}
      ${actionHtml}
    </div>
    <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
      Secure financial operations powered by HESABU Enterprise Ledger.
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Dispatch a notification (SMS / Email)
   */
  async dispatch({ workspaceId, recipientId, recipientContact, channel, eventType, content, metadata = {} }) {
    const id = `notif_${crypto.randomBytes(12).toString('hex')}`;
    const entry = {
      id,
      workspaceId,
      recipientId,
      recipientContact,
      channel, // 'SMS' | 'EMAIL'
      eventType,
      content,
      metadata,
      status: 'SENT',
      createdAt: new Date(),
    };

    this.logs.push(entry);
    return entry;
  }

  /**
   * Get notification history for workspace
   */
  getHistory(workspaceId) {
    return this.logs.filter((l) => l.workspaceId === workspaceId);
  }

  /**
   * Clear in-memory logs (for testing)
   */
  clear() {
    this.logs = [];
  }
}

export const notificationService = new NotificationService();

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from '../src/services/notificationService.js';

describe('Notification Service & Templating Engine', () => {
  let svc;

  beforeEach(() => {
    svc = new NotificationService();
  });

  it('formats obligation SMS with required parameters and clean text without emojis', () => {
    const sms = svc.formatObligationSms({
      memberName: 'Edwin M',
      amountFormatted: '1,500.00',
      currency: 'KES',
      dueDate: '2026-12-01',
      workspaceName: 'Nairobi Tech Chama',
    });

    expect(sms).toContain('Edwin M');
    expect(sms).toContain('KES 1,500.00');
    expect(sms).toContain('Nairobi Tech Chama');
    // Ensure no emojis
    expect(sms).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it('formats payment receipt SMS accurately', () => {
    const sms = svc.formatPaymentReceiptSms({
      memberName: 'Edwin M',
      amountFormatted: '5,000.00',
      currency: 'KES',
      receiptNumber: 'REC-2026-8891',
      workspaceName: 'Ushirika Alpha',
    });

    expect(sms).toContain('Payment received');
    expect(sms).toContain('REC-2026-8891');
    expect(sms).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it('formats approval request SMS accurately', () => {
    const sms = svc.formatApprovalRequestSms({
      approverName: 'Alice K',
      amountFormatted: '25,000.00',
      currency: 'KES',
      description: 'Q4 Audit Fees',
      workspaceName: 'Ushirika Alpha',
    });

    expect(sms).toContain('Action Required');
    expect(sms).toContain('Alice K');
    expect(sms).toContain('Q4 Audit Fees');
    expect(sms).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it('generates HTML email with responsive inline styling and no emojis', () => {
    const html = svc.formatEmailHtml({
      title: 'Monthly Chama Statement Ready',
      preheader: 'Your November 2026 statement has been generated',
      contentLines: [
        'The statement for November 2026 is now available.',
        'Total collections: KES 150,000.00 across 24 members.',
        'The cryptographic Merkle root has been anchored to Stellar Soroban.',
      ],
      actionUrl: 'https://hesabu.app/workspaces/ws-1/statements',
      actionLabel: 'View Statement & Verification',
      workspaceName: 'Ushirika Alpha',
    });

    expect(html).toContain('Monthly Chama Statement Ready');
    expect(html).toContain('https://hesabu.app/workspaces/ws-1/statements');
    expect(html).toContain('View Statement & Verification');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it('dispatches and logs notification records', async () => {
    const entry = await svc.dispatch({
      workspaceId: 'ws_demo',
      recipientId: 'u_123',
      recipientContact: '+254712345678',
      channel: 'SMS',
      eventType: 'OBLIGATION_ISSUED',
      content: 'Hello member, dues are pending.',
    });

    expect(entry.id).toMatch(/^notif_/);
    expect(entry.status).toBe('SENT');

    const history = svc.getHistory('ws_demo');
    expect(history.length).toBe(1);
    expect(history[0].recipientContact).toBe('+254712345678');
  });
});

import React, { useState, useEffect } from 'react';
import { Plus, CreditCard, RefreshCw, FileText } from 'lucide-react';
import { api, money } from '../../api';
import { PageHeader, Field, Modal } from '../shared/CommonComponents';

export function InvoicesView({ workspaceId, currency, setNotice, refresh }) {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState('');
  const [settleModal, setSettleModal] = useState(null);
  const [creditNoteModal, setCreditNoteModal] = useState(null);
  const [busy, setBusy] = useState(false);

  // New Invoice Form
  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [lines, setLines] = useState([{ description: 'Consulting Services', quantity: 1, unitPrice: '1000' }]);

  // New Customer Form
  const [custForm, setCustForm] = useState({ name: '', email: '', phone: '', taxId: '', address: '' });

  // Settle Form
  const [settleRail, setSettleRail] = useState('MPESA');
  const [settleRef, setSettleRef] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  // Credit Note Form
  const [cnReason, setCnReason] = useState('Service adjustment / goodwill credit');
  const [cnAmount, setCnAmount] = useState('');

  function loadData() {
    api(`/workspaces/${workspaceId}/invoices`).then(r => setInvoices(r.invoices || [])).catch(() => {});
    api(`/workspaces/${workspaceId}/customers`).then(r => setCustomers(r.customers || [])).catch(() => {});
  }

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  function addLine() {
    setLines([...lines, { description: '', quantity: 1, unitPrice: '0' }]);
  }

  function updateLine(idx, field, val) {
    const updated = [...lines];
    updated[idx][field] = val;
    setLines(updated);
  }

  const subtotal = lines.reduce((acc, l) => acc + (Number(l.quantity || 0) * Number(l.unitPrice || 0)), 0);
  const vatRate = currency === 'ZAR' ? 0.15 : 0.16;
  const vatAmount = subtotal * vatRate;
  const totalAmount = subtotal + vatAmount;

  async function createCustomer(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/customers`, {
        method: 'POST',
        body: JSON.stringify(custForm)
      });
      setNotice('Customer account registered successfully.');
      setModal('');
      setCustForm({ name: '', email: '', phone: '', taxId: '', address: '' });
      loadData();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          invoiceNumber,
          dueDate: new Date(dueDate).toISOString(),
          lines: lines.map(l => ({
            description: l.description,
            quantity: Number(l.quantity),
            unitPrice: l.unitPrice
          }))
        })
      });
      setNotice('Commercial invoice issued and posted to Accounts Receivable.');
      setModal('');
      loadData();
      if (refresh) refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function settleInvoice(e) {
    e.preventDefault();
    if (!settleModal) return;
    setBusy(true);
    try {
      await api(`/invoices/${settleModal.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({
          rail: settleRail,
          paymentRef: settleRef || undefined,
          amount: settleAmount || undefined
        })
      });
      setNotice('Invoice settlement recorded and posted to double-entry ledger.');
      setSettleModal(null);
      setSettleAmount('');
      setSettleRef('');
      loadData();
      if (refresh) refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function issueCreditNote(e) {
    e.preventDefault();
    if (!creditNoteModal) return;
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/invoices/${creditNoteModal.id}/credit-notes`, {
        method: 'POST',
        body: JSON.stringify({
          reason: cnReason,
          lines: [
            {
              description: `Credit rebate on ${creditNoteModal.invoiceNumber}`,
              quantity: 1,
              unitPrice: cnAmount
            }
          ]
        })
      });
      setNotice('Credit note issued and posted to Revenue and Accounts Receivable ledgers.');
      setCreditNoteModal(null);
      setCnAmount('');
      loadData();
      if (refresh) refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="COMMERCIAL RECEIVABLES"
        title="Invoices & Accounts Receivable"
        description="Issue professional commercial invoices with VAT calculation, allocate partial settlements, issue credit notes, and track customer receivables."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary" onClick={() => setModal('customer')}><Plus size={15} /> Add Customer</button>
            <button className="primary" onClick={() => { setModal('invoice'); if (customers[0]) setCustomerId(customers[0].id); }}>
              <Plus size={15} /> Issue Invoice
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
        <div className="metric-card">
          <small>Registered B2B Customers</small>
          <strong>{customers.length}</strong>
        </div>
        <div className="metric-card">
          <small>Open Receivables</small>
          <strong>
            {money(invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + (BigInt(i.totalMinor) - BigInt(i.paidMinor || 0)), 0n).toString(), currency)}
          </strong>
        </div>
        <div className="metric-card">
          <small>Settled Invoices</small>
          <strong style={{ color: '#2da44e' }}>
            {money(invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + BigInt(i.totalMinor), 0n).toString(), currency)}
          </strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Commercial Invoices</h2>
            <p>Accrual-based billing linked directly to general ledger accounts with durable allocations</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Paid / Credited</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#7b8780' }}>
                    No invoices issued yet. Click "Issue Invoice" to bill a customer.
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><b>{inv.invoiceNumber}</b></td>
                    <td>{inv.customer?.name || 'Customer'}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td><b>{money(inv.totalMinor, inv.currency)}</b></td>
                    <td>{money(inv.paidMinor || 0n, inv.currency)}</td>
                    <td>
                      <span className={`status status-${inv.status.toLowerCase()}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      {inv.status !== 'PAID' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
                            setSettleModal(inv);
                            const rem = (Number(inv.totalMinor) - Number(inv.paidMinor || 0)) / 100;
                            setSettleAmount(rem.toFixed(2));
                          }}>
                            Settle
                          </button>
                          <button className="secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
                            setCreditNoteModal(inv);
                            const rem = (Number(inv.totalMinor) - Number(inv.paidMinor || 0)) / 100;
                            setCnAmount(rem.toFixed(2));
                          }}>
                            Credit Note
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#2da44e', fontSize: '12px', fontWeight: 600 }}>✓ Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'customer' && (
        <Modal title="Register B2B Customer" onClose={() => setModal('')}>
          <form onSubmit={createCustomer} className="stack">
            <Field label="Customer / Corporate Name">
              <input required value={custForm.name} onChange={e => setCustForm({ ...custForm, name: e.target.value })} />
            </Field>
            <Field label="Billing Email">
              <input type="email" required value={custForm.email} onChange={e => setCustForm({ ...custForm, email: e.target.value })} />
            </Field>
            <Field label="Phone Number">
              <input value={custForm.phone} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} />
            </Field>
            <Field label="KRA PIN / SARS Tax ID">
              <input value={custForm.taxId} onChange={e => setCustForm({ ...custForm, taxId: e.target.value })} />
            </Field>
            <Field label="Physical / Billing Address">
              <input value={custForm.address} onChange={e => setCustForm({ ...custForm, address: e.target.value })} />
            </Field>
            <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Register Customer'}</button>
          </form>
        </Modal>
      )}

      {modal === 'invoice' && (
        <Modal title="Issue Commercial Invoice" onClose={() => setModal('')}>
          <form onSubmit={createInvoice} className="stack">
            <Field label="Select Customer">
              <select required value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">-- Choose Customer --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Invoice Reference #">
                <input required value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
              </Field>
              <Field label="Due Date">
                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </Field>
            </div>

            <div style={{ borderTop: '1px solid #e1e4e8', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Invoice Line Items</span>
                <button type="button" className="text-button" onClick={addLine}>+ Add Line</button>
              </div>
              {lines.map((l, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input placeholder="Item Description" required value={l.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
                  <input type="number" step="1" min="1" placeholder="Qty" required value={l.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                  <input type="number" step="0.01" min="0" placeholder="Unit Price" required value={l.unitPrice} onChange={e => updateLine(idx, 'unitPrice', e.target.value)} />
                </div>
              ))}
            </div>

            <div style={{ background: '#f6f8fa', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Subtotal:</span>
                <b>{currency} {subtotal.toFixed(2)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>VAT ({currency === 'ZAR' ? '15%' : '16%'}):</span>
                <b>{currency} {vatAmount.toFixed(2)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e1e4e8', paddingTop: '4px', fontWeight: 700 }}>
                <span>Grand Total:</span>
                <b>{currency} {totalAmount.toFixed(2)}</b>
              </div>
            </div>

            <button className="primary" disabled={busy || !customerId}>{busy ? 'Issuing...' : 'Issue Invoice'}</button>
          </form>
        </Modal>
      )}

      {settleModal && (
        <Modal title={`Settle Invoice: ${settleModal.invoiceNumber}`} onClose={() => setSettleModal(null)}>
          <form onSubmit={settleInvoice} className="stack">
            <p className="subtle">Record cash or clearing payment against this invoice. Partial payments are supported.</p>
            <Field label="Payment Rail">
              <select value={settleRail} onChange={e => setSettleRail(e.target.value)}>
                <option value="MPESA">Safaricom M-Pesa</option>
                <option value="STELLAR">Stellar Horizon Network</option>
                <option value="PAYSHAP_EFT">PayShap / Instant EFT</option>
                <option value="DEVELOPMENT">Bank Wire / Clearing</option>
              </select>
            </Field>
            <Field label="Settlement Amount">
              <input type="number" step="0.01" required value={settleAmount} onChange={e => setSettleAmount(e.target.value)} />
            </Field>
            <Field label="Provider Reference / Tx Hash (Optional)">
              <input placeholder="e.g. MPESA-QA12345678" value={settleRef} onChange={e => setSettleRef(e.target.value)} />
            </Field>
            <button className="primary" disabled={busy}>{busy ? 'Recording...' : 'Confirm Settlement'}</button>
          </form>
        </Modal>
      )}

      {creditNoteModal && (
        <Modal title={`Issue Credit Note: ${creditNoteModal.invoiceNumber}`} onClose={() => setCreditNoteModal(null)}>
          <form onSubmit={issueCreditNote} className="stack">
            <p className="subtle">Issue a formal credit note reducing the accounts receivable balance.</p>
            <Field label="Credit Reason / Description">
              <input required value={cnReason} onChange={e => setCnReason(e.target.value)} />
            </Field>
            <Field label="Credit Amount (Excl. VAT)">
              <input type="number" step="0.01" required value={cnAmount} onChange={e => setCnAmount(e.target.value)} />
            </Field>
            <button className="primary" disabled={busy}>{busy ? 'Issuing Credit Note...' : 'Issue Credit Note'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

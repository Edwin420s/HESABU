import React, { useState, useEffect } from 'react';
import {
  Plus, FileText, Receipt, Building2, TrendingUp, CheckCircle2,
  AlertCircle, DollarSign, ArrowRight, ShieldCheck, CreditCard, RefreshCw
} from 'lucide-react';
import { api, money } from './api';

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtle">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// =========================================================================
// 1. INVOICING & ACCOUNTS RECEIVABLE
// =========================================================================
export function InvoicesView({ workspaceId, currency, setNotice, refresh }) {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState('');
  const [settleModal, setSettleModal] = useState(null);
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
          paymentRef: settleRef || undefined
        })
      });
      setNotice('Invoice settlement recorded and posted to double-entry ledger.');
      setSettleModal(null);
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
        description="Issue professional commercial invoices with VAT calculation, track customer receivables, and settle payments."
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
            {money(invoices.filter(i => i.status === 'SENT').reduce((s, i) => s + BigInt(i.totalMinor), 0n).toString(), currency)}
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
            <p>Accrual-based billing linked directly to general ledger accounts</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Subtotal</th>
                <th>VAT / Tax</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#7b8780' }}>
                    No invoices issued yet. Click "Issue Invoice" to bill a customer.
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><b>{inv.invoiceNumber}</b></td>
                    <td>{inv.customer?.name || 'Customer'}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td>{money(inv.subtotalMinor, inv.currency)}</td>
                    <td>{money(inv.taxMinor, inv.currency)}</td>
                    <td><b>{money(inv.totalMinor, inv.currency)}</b></td>
                    <td>
                      <span className={`status status-${inv.status.toLowerCase()}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      {inv.status === 'SENT' ? (
                        <button className="primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setSettleModal(inv)}>
                          Settle
                        </button>
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
              {lines.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '8px', marginBottom: '8px' }}>
                  <input placeholder="Item description" required value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
                  <input type="number" min="1" placeholder="Qty" required value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                  <input placeholder={`Unit Price (${currency})`} required value={line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', e.target.value)} />
                </div>
              ))}
            </div>

            <div style={{ background: '#f6f8fa', padding: '12px', borderRadius: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Subtotal: <b>{currency} {subtotal.toFixed(2)}</b></div>
              <div>VAT ({(vatRate * 100).toFixed(0)}%): <b>{currency} {vatAmount.toFixed(2)}</b></div>
              <div style={{ fontSize: '14px', borderTop: '1px solid #d0d7de', paddingTop: '4px', marginTop: '4px' }}>
                Total Due: <b>{currency} {totalAmount.toFixed(2)}</b>
              </div>
            </div>

            <button className="primary" disabled={busy || !customerId}>{busy ? 'Issuing...' : 'Issue Invoice'}</button>
          </form>
        </Modal>
      )}

      {settleModal && (
        <Modal title={`Settle Invoice #${settleModal.invoiceNumber}`} onClose={() => setSettleModal(null)}>
          <form onSubmit={settleInvoice} className="stack">
            <p className="subtle">Total to be settled: <b>{money(settleModal.totalMinor, settleModal.currency)}</b></p>
            <Field label="Settlement Payment Rail">
              <select value={settleRail} onChange={e => setSettleRail(e.target.value)}>
                <option value="MPESA">M-Pesa STK / Paybill</option>
                <option value="STELLAR">Stellar Horizon USDC / XLM</option>
                <option value="PAYSHAP_EFT">PayShap / Bank EFT (ZA)</option>
                <option value="DEVELOPMENT">Internal Sandbox Settlement</option>
              </select>
            </Field>
            <Field label="External Payment Reference / Receipt">
              <input placeholder="e.g. QAB8921829 or EFT Ref" value={settleRef} onChange={e => setSettleRef(e.target.value)} />
            </Field>
            <button className="primary" disabled={busy}>{busy ? 'Processing...' : 'Confirm Settle & Post to Ledger'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// 2. SUPPLIER BILLS & ACCOUNTS PAYABLE
// =========================================================================
export function BillsView({ workspaceId, currency, setNotice, refresh }) {
  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState('');
  const [payModal, setPayModal] = useState(null);
  const [busy, setBusy] = useState(false);

  // New Bill Form
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState(`BILL-${Date.now().toString().slice(-6)}`);
  const [amount, setAmount] = useState('2500.00');
  const [category, setCategory] = useState('OPERATING');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // New Supplier Form
  const [supForm, setSupForm] = useState({ name: '', email: '', phone: '', bankName: '', bankAccount: '', taxId: '' });

  function loadData() {
    api(`/workspaces/${workspaceId}/bills`).then(r => setBills(r.bills || [])).catch(() => {});
    api(`/workspaces/${workspaceId}/suppliers`).then(r => setSuppliers(r.suppliers || [])).catch(() => {});
  }

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  async function createSupplier(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/suppliers`, {
        method: 'POST',
        body: JSON.stringify(supForm)
      });
      setNotice('Supplier registered successfully.');
      setModal('');
      setSupForm({ name: '', email: '', phone: '', bankName: '', bankAccount: '', taxId: '' });
      loadData();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createBill(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/bills`, {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          billNumber,
          amount,
          category,
          dueDate: new Date(dueDate).toISOString(),
          notes
        })
      });
      setNotice('Supplier bill submitted for approval.');
      setModal('');
      loadData();
      if (refresh) refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function approveBill(billId) {
    setBusy(true);
    try {
      await api(`/bills/${billId}/approve`, { method: 'POST' });
      setNotice('Supplier bill approved and recognized in Accounts Payable.');
      loadData();
      if (refresh) refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function payBill(e) {
    e.preventDefault();
    if (!payModal) return;
    setBusy(true);
    try {
      await api(`/bills/${payModal.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          rail: 'PAYSHAP_EFT',
          paymentRef: `PAY-BILL-${Date.now().toString().slice(-6)}`
        })
      });
      setNotice('Supplier payment disbursed and posted to AP journal.');
      setPayModal(null);
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
        eyebrow="COMMERCIAL PAYABLES"
        title="Supplier Bills & Accounts Payable"
        description="Record vendor obligations, enforce dual approval limits, and disburse bank EFT or PayShap payouts."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary" onClick={() => setModal('supplier')}><Plus size={15} /> Add Supplier</button>
            <button className="primary" onClick={() => { setModal('bill'); if (suppliers[0]) setSupplierId(suppliers[0].id); }}>
              <Plus size={15} /> Record Bill
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
        <div className="metric-card">
          <small>Approved Suppliers</small>
          <strong>{suppliers.length}</strong>
        </div>
        <div className="metric-card">
          <small>Pending Approval</small>
          <strong style={{ color: '#d97706' }}>
            {money(bills.filter(b => b.status === 'PENDING_APPROVAL').reduce((s, b) => s + BigInt(b.amountMinor), 0n).toString(), currency)}
          </strong>
        </div>
        <div className="metric-card">
          <small>Total Disbursed</small>
          <strong style={{ color: '#2da44e' }}>
            {money(bills.filter(b => b.status === 'PAID').reduce((s, b) => s + BigInt(b.amountMinor), 0n).toString(), currency)}
          </strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Accounts Payable Ledger</h2>
            <p>Vendor bills pending governance approval and disbursement</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Supplier</th>
                <th>Category</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Governance Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#7b8780' }}>
                    No supplier bills recorded yet. Click "Record Bill" to register vendor payables.
                  </td>
                </tr>
              ) : (
                bills.map(b => (
                  <tr key={b.id}>
                    <td><b>{b.billNumber}</b></td>
                    <td>{b.supplier?.name || 'Vendor'}</td>
                    <td><span className="quiet-tag">{b.category}</span></td>
                    <td>{new Date(b.dueDate).toLocaleDateString()}</td>
                    <td><b>{money(b.amountMinor, b.currency)}</b></td>
                    <td>
                      <span className={`status status-${b.status.toLowerCase().replaceAll('_', '-')}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      {b.status === 'PENDING_APPROVAL' && (
                        <button className="primary" style={{ padding: '4px 10px', fontSize: '12px' }} disabled={busy} onClick={() => approveBill(b.id)}>
                          Approve
                        </button>
                      )}
                      {b.status === 'APPROVED' && (
                        <button className="primary" style={{ padding: '4px 10px', fontSize: '12px' }} disabled={busy} onClick={() => setPayModal(b)}>
                          Disburse
                        </button>
                      )}
                      {b.status === 'PAID' && (
                        <span style={{ color: '#2da44e', fontSize: '12px', fontWeight: 600 }}>✓ Paid & Posted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'supplier' && (
        <Modal title="Register Approved Vendor" onClose={() => setModal('')}>
          <form onSubmit={createSupplier} className="stack">
            <Field label="Vendor / Supplier Name">
              <input required value={supForm.name} onChange={e => setSupForm({ ...supForm, name: e.target.value })} />
            </Field>
            <Field label="Accounts Email">
              <input type="email" required value={supForm.email} onChange={e => setSupForm({ ...supForm, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input value={supForm.phone} onChange={e => setSupForm({ ...supForm, phone: e.target.value })} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Bank Name">
                <input placeholder="e.g. Standard Bank / ABSA" value={supForm.bankName} onChange={e => setSupForm({ ...supForm, bankName: e.target.value })} />
              </Field>
              <Field label="Bank Account Number">
                <input value={supForm.bankAccount} onChange={e => setSupForm({ ...supForm, bankAccount: e.target.value })} />
              </Field>
            </div>
            <Field label="Tax Registration ID">
              <input value={supForm.taxId} onChange={e => setSupForm({ ...supForm, taxId: e.target.value })} />
            </Field>
            <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Register Supplier'}</button>
          </form>
        </Modal>
      )}

      {modal === 'bill' && (
        <Modal title="Record Supplier Bill" onClose={() => setModal('')}>
          <form onSubmit={createBill} className="stack">
            <Field label="Select Supplier">
              <select required value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">-- Choose Vendor --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.bankName || 'Direct'})</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Vendor Bill / Invoice #">
                <input required value={billNumber} onChange={e => setBillNumber(e.target.value)} />
              </Field>
              <Field label={`Amount (${currency})`}>
                <input required value={amount} onChange={e => setAmount(e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Category">
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="OPERATING">Operating Expenses</option>
                  <option value="MARKETING">Marketing & Advertising</option>
                  <option value="SOFTWARE">Software & Cloud Services</option>
                  <option value="LEGAL">Legal & Professional</option>
                  <option value="CAPITAL">Capital Expenditure</option>
                </select>
              </Field>
              <Field label="Due Date">
                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Notes / PO Reference">
              <input value={notes} onChange={e => setNotes(e.target.value)} />
            </Field>
            <button className="primary" disabled={busy || !supplierId}>{busy ? 'Submitting...' : 'Submit for Approval'}</button>
          </form>
        </Modal>
      )}

      {payModal && (
        <Modal title={`Disburse Payout for Bill #${payModal.billNumber}`} onClose={() => setPayModal(null)}>
          <form onSubmit={payBill} className="stack">
            <p className="subtle">Disbursing payment to: <b>{payModal.supplier?.name}</b></p>
            <p>Payable Amount: <b>{money(payModal.amountMinor, payModal.currency)}</b></p>
            <div style={{ background: '#f6f8fa', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
              Payment Rail: <b>PayShap / Immediate EFT (ZA)</b>
              <br />Debit: Accounts Payable (2000)
              <br />Credit: Bank Clearing (1030)
            </div>
            <button className="primary" disabled={busy}>{busy ? 'Disbursing...' : 'Confirm Disbursement & Post'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// 3. PROCUREMENT & PURCHASE REQUESTS
// =========================================================================
export function ProcurementView({ workspaceId, currency, setNotice, refresh }) {
  const [requests, setRequests] = useState([]);
  const [modal, setModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [busy, setBusy] = useState(false);

  // New Request Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('5000.00');
  const [department, setDepartment] = useState('OPERATIONS');

  function loadData() {
    api(`/workspaces/${workspaceId}/purchase-requests`).then(r => setRequests(r.requests || [])).catch(() => {});
  }

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  async function createRequest(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/purchase-requests`, {
        method: 'POST',
        body: JSON.stringify({ title, description, amount, department })
      });
      setNotice('Procurement request submitted for authorization.');
      setModal(false);
      setTitle('');
      setDescription('');
      loadData();
      if (refresh) refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reviewRequest(decision) {
    if (!reviewModal) return;
    setBusy(true);
    try {
      await api(`/purchase-requests/${reviewModal.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, note: 'Reviewed via procurement governance' })
      });
      setNotice(`Purchase request marked as ${decision}.`);
      setReviewModal(null);
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
        eyebrow="CAPITAL GOVERNANCE"
        title="Procurement & Purchase Requests"
        description="Enforce segregation of duties and dual-authorization spending thresholds prior to purchase commitments."
        action={<button className="primary" onClick={() => setModal(true)}><Plus size={15} /> New Purchase Request</button>}
      />

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Purchase Requests</h2>
            <p>Policy-enforced workflow requiring authorized sign-off</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Requested By</th>
                <th>Department</th>
                <th>Estimated Cost</th>
                <th>Date</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#7b8780' }}>
                    No procurement requests pending.
                  </td>
                </tr>
              ) : (
                requests.map(r => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.title}</b>
                      {r.description && <small>{r.description}</small>}
                    </td>
                    <td>{r.requestedBy?.name || 'Staff'}</td>
                    <td><span className="quiet-tag">{r.department}</span></td>
                    <td><b>{money(r.amountMinor, r.currency)}</b></td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`status status-${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 'PENDING' ? (
                        <button className="secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setReviewModal(r)}>
                          Review
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{r.status}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title="Submit Purchase Request" onClose={() => setModal(false)}>
          <form onSubmit={createRequest} className="stack">
            <Field label="Item / Service Title">
              <input required value={title} onChange={e => setTitle(e.target.value)} />
            </Field>
            <Field label="Detailed Justification / Specifications">
              <input value={description} onChange={e => setDescription(e.target.value)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label={`Estimated Amount (${currency})`}>
                <input required value={amount} onChange={e => setAmount(e.target.value)} />
              </Field>
              <Field label="Department">
                <select value={department} onChange={e => setDepartment(e.target.value)}>
                  <option value="OPERATIONS">Operations</option>
                  <option value="IT_INFRA">IT & Infrastructure</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="ADMIN">Administration</option>
                </select>
              </Field>
            </div>
            <button className="primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit Request'}</button>
          </form>
        </Modal>
      )}

      {reviewModal && (
        <Modal title={`Review Request: ${reviewModal.title}`} onClose={() => setReviewModal(null)}>
          <div className="stack">
            <p className="subtle">Requested By: <b>{reviewModal.requestedBy?.name}</b></p>
            <p>Estimated Budget: <b>{money(reviewModal.amountMinor, reviewModal.currency)}</b></p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button className="primary" style={{ flex: 1 }} disabled={busy} onClick={() => reviewRequest('APPROVED')}>
                Approve Request
              </button>
              <button className="secondary" style={{ flex: 1, color: '#cf222e' }} disabled={busy} onClick={() => reviewRequest('REJECTED')}>
                Reject
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// 4. FX & MULTI-CURRENCY TREASURY
// =========================================================================
export function FxView({ workspaceId, currency, setNotice }) {
  const [rates, setRates] = useState({});
  const [fromCurr, setFromCurr] = useState('KES');
  const [toCurr, setToCurr] = useState('ZAR');
  const [calcAmount, setCalcAmount] = useState('10000.00');
  const [calcResult, setCalcResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/fx/rates').then(r => setRates(r.rates || {})).catch(() => {});
  }, []);

  async function handleConvert(e) {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      const decimals = (fromCurr === 'UGX' || fromCurr === 'TZS') ? 0 : 2;
      const amountMinor = Math.round(Number(calcAmount) * Math.pow(10, decimals));
      const res = await api('/fx/convert', {
        method: 'POST',
        body: JSON.stringify({
          amountMinor,
          fromCurrency: fromCurr,
          toCurrency: toCurr,
          spreadPercentage: 0.005 // 0.5% spread
        })
      });
      setCalcResult(res);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="MULTI-CURRENCY TREASURY"
        title="Foreign Exchange & Cross-Border Rates"
        description="Real-time multi-market conversion rates across Kenya Shillings (KES), South African Rand (ZAR), USD, and regional currencies."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
        <div className="metric-card">
          <small>1 USD → KES</small>
          <strong>{rates.KES?.rateToUsd ? `KES ${rates.KES.rateToUsd.toFixed(2)}` : '130.00'}</strong>
        </div>
        <div className="metric-card">
          <small>1 USD → ZAR</small>
          <strong>{rates.ZAR?.rateToUsd ? `ZAR ${rates.ZAR.rateToUsd.toFixed(2)}` : '18.20'}</strong>
        </div>
        <div className="metric-card">
          <small>1 ZAR → KES (Cross)</small>
          <strong>
            {rates.KES && rates.ZAR ? `KES ${(rates.KES.rateToUsd / rates.ZAR.rateToUsd).toFixed(2)}` : '7.14'}
          </strong>
        </div>
        <div className="metric-card">
          <small>1 EUR → USD</small>
          <strong>{rates.EUR?.rateToUsd ? `$${(1 / rates.EUR.rateToUsd).toFixed(2)}` : '$1.08'}</strong>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: '640px' }}>
        <div className="panel-heading">
          <div>
            <h2>Cross-Border Currency Calculator</h2>
            <p>Compute exact minor-unit conversions with institutional spread deduction</p>
          </div>
        </div>

        <form onSubmit={handleConvert} className="stack" style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="From Currency">
              <select value={fromCurr} onChange={e => setFromCurr(e.target.value)}>
                <option value="KES">KES - Kenyan Shilling</option>
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="UGX">UGX - Ugandan Shilling</option>
                <option value="TZS">TZS - Tanzanian Shilling</option>
              </select>
            </Field>
            <Field label="To Currency">
              <select value={toCurr} onChange={e => setToCurr(e.target.value)}>
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="KES">KES - Kenyan Shilling</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="UGX">UGX - Ugandan Shilling</option>
                <option value="TZS">TZS - Tanzanian Shilling</option>
              </select>
            </Field>
          </div>

          <Field label={`Amount to Convert in ${fromCurr}`}>
            <input type="number" required value={calcAmount} onChange={e => setCalcAmount(e.target.value)} />
          </Field>

          <button className="primary" disabled={busy}>
            {busy ? 'Calculating...' : 'Calculate Institutional Rate'}
          </button>

          {calcResult && (
            <div style={{ background: '#f6f8fa', padding: '16px', borderRadius: '8px', marginTop: '12px', border: '1px solid #d0d7de' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="subtle">Mid-Market Cross Rate:</span>
                <b>1 {fromCurr} = {calcResult.baseRate} {toCurr}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="subtle">Spread Applied:</span>
                <span>{(calcResult.spreadPercentage * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', borderTop: '1px solid #d0d7de', paddingTop: '8px' }}>
                <span>Converted Payout:</span>
                <b style={{ color: '#0969da' }}>
                  {money(calcResult.targetAmountMinor, toCurr)}
                </b>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

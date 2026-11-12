import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api, money } from '../../api';
import { PageHeader, Field, Modal } from '../shared/CommonComponents';

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
              <input required value={supForm.name} onChange={e => setCustForm ? setCustForm({ ...supForm, name: e.target.value }) : setSupForm({ ...supForm, name: e.target.value })} />
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

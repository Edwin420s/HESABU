import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, money } from '../../api';
import { PageHeader, Field, Modal } from '../shared/CommonComponents';

export function LoansView({ workspaceId, loans, refresh, setNotice, currency }) {
  const [modal, setModal] = useState(false);
  const [principal, setPrincipal] = useState('');
  const [duration, setDuration] = useState('6');
  const [rate, setRate] = useState('');
  const [type, setType] = useState('FLAT');
  const [busy, setBusy] = useState(false);

  async function applyLoan(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/loans/apply`, {
        method: 'POST',
        body: JSON.stringify({
          principalMinor: Math.round(parseFloat(principal) * 100),
          durationMonths: parseInt(duration),
          interestRatePct: parseFloat(rate),
          interestType: type,
        }),
      });
      setModal(false);
      setPrincipal('');
      setRate('');
      refresh();
      setNotice('Loan application submitted for approval');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CREDIT & CAPITAL"
        title="Table Banking Loans"
        description="Internal peer lending, interest amortization schedules, and member repayments."
        helpText="Table Banking allows members to borrow against collective capital pools with customizable interest rates and monthly amortization. Disbursements credit the member's account, and repayments automatically allocate across principal and interest receivables in the general ledger."
        action={<button className="primary" onClick={() => setModal(true)}><Plus size={16} /> Request Loan</button>}
      />

      {!loans?.length ? (
        <div style={{ textAlign: 'center', padding: '36px', color: '#7b8780' }}>
          No loans issued yet. Members can apply for table banking loans from collective reserves.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Principal</th>
                <th>Total Interest</th>
                <th>Total Payable</th>
                <th>Repaid</th>
                <th>Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.id.slice(0, 10)}...</b></td>
                  <td>{money(l.principalMinor, currency)}</td>
                  <td>{money(l.totalInterestMinor, currency)} ({l.interestType})</td>
                  <td>{money(l.totalPayableMinor, currency)}</td>
                  <td>{money(l.totalRepaidMinor, currency)}</td>
                  <td><b>{money(l.outstandingMinor, currency)}</b></td>
                  <td><span className={`status status-${l.status.toLowerCase().replaceAll('_', '-')}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title="Apply for Table Banking Loan" onClose={() => setModal(false)}>
          <form onSubmit={applyLoan} className="stack">
            <Field label={`Principal Amount (${currency})`}>
              <input type="number" required step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="e.g. 50000" />
            </Field>
            <Field label="Duration (Months)">
              <input type="number" min="1" max="36" required value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 6" />
            </Field>
            <Field label="Annual Interest Rate (%)">
              <input type="number" step="0.1" required value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 12" />
            </Field>
            <Field label="Interest Calculation Model">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="FLAT">Flat Rate</option>
                <option value="REDUCING_BALANCE">Reducing Balance</option>
              </select>
            </Field>
            <button className="primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit Application'}</button>
          </form>
        </Modal>
      )}
    </>
  );
}

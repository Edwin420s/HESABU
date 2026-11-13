import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api, money } from '../../api';
import { PageHeader, Field, Modal } from '../shared/CommonComponents';

export function ProcurementView({ workspaceId, currency, setNotice, refresh }) {
  const [requests, setRequests] = useState([]);
  const [modal, setModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [busy, setBusy] = useState(false);

  // New Request Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
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
                <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000.00" />
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

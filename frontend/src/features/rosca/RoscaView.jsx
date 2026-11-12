import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, money } from '../../api';
import { PageHeader, Field, Modal } from '../shared/CommonComponents';

export function RoscaView({ workspaceId, cycles, refresh, setNotice, currency }) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('5000');
  const [busy, setBusy] = useState(false);

  async function createCycle(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/rosca`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          contributionPerMemberMinor: Math.round(parseFloat(amount) * 100),
          memberIds: ['m_admin', 'm_treasurer', 'm_member_1'],
        }),
      });
      setModal(false);
      refresh();
      setNotice('ROSCA Merry-Go-Round cycle created successfully');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="COMMUNITY WEALTH ACCUMULATION"
        title="Merry-Go-Round (ROSCA) Circles"
        description="Rotating savings and credit rounds ensuring scheduled, transparent pool disbursements to members."
        action={<button className="primary" onClick={() => setModal(true)}><Plus size={16} /> New Merry-Go-Round</button>}
      />

      {!cycles?.length ? (
        <div style={{ textAlign: 'center', padding: '36px', color: '#7b8780' }}>
          No active Merry-Go-Round cycles found. Create one to begin rotating pool rounds.
        </div>
      ) : (
        <div className="grid">
          {cycles.map((c) => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{c.name}</h3>
                <span className="status status-active">{c.status}</span>
              </div>
              <p className="subtle" style={{ margin: '6px 0 12px' }}>Round {c.currentRound} of {c.totalRounds}</p>
              <div className="metric-row">
                <div>
                  <span className="subtle">Target Pot</span>
                  <b>{money(c.potPerRoundMinor, currency)}</b>
                </div>
                <div>
                  <span className="subtle">Per Member Dues</span>
                  <b>{money(c.contributionPerMemberMinor, currency)}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Create Merry-Go-Round Cycle" onClose={() => setModal(false)}>
          <form onSubmit={createCycle} className="stack">
            <Field label="Cycle Name">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026 Monthly Rotation" />
            </Field>
            <Field label={`Contribution per Member (${currency})`}>
              <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <button className="primary" disabled={busy}>{busy ? 'Creating...' : 'Launch Cycle'}</button>
          </form>
        </Modal>
      )}
    </>
  );
}

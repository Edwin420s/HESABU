import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api, money } from '../../api';
import { PageHeader, Field, Modal } from '../shared/CommonComponents';

export function RoscaView({ workspaceId, cycles, refresh, setNotice, currency, members = [] }) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (members && members.length > 0) {
      setSelectedMembers(members.map(m => m.id));
    }
  }, [members]);

  async function createCycle(e) {
    e.preventDefault();
    if (selectedMembers.length < 2) {
      setNotice('A Merry-Go-Round cycle requires at least 2 participating members.');
      return;
    }
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/rosca`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          contributionPerMemberMinor: Math.round(parseFloat(amount) * 100),
          memberIds: selectedMembers,
        }),
      });
      setModal(false);
      setName('');
      setAmount('');
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
              <input type="number" required step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
            </Field>
            <Field label="Participating Members (minimum 2)">
              {members.length === 0 ? (
                <p className="tiny subtle">No workspace members found. Add members to your workspace first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  {members.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(m.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedMembers(prev => [...prev, m.id]);
                          } else {
                            setSelectedMembers(prev => prev.filter(id => id !== m.id));
                          }
                        }}
                      />
                      <span>{m.user?.name || m.user?.email || m.id}</span>
                      <span className="quiet-tag">{m.role}</span>
                    </label>
                  ))}
                </div>
              )}
            </Field>
            <button className="primary" disabled={busy || selectedMembers.length < 2}>
              {busy ? 'Creating...' : `Launch Cycle (${selectedMembers.length} members)`}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

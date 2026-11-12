import React, { useState } from 'react';
import { ShieldCheck, Wallet, ArrowDownLeft, Activity, Send } from 'lucide-react';
import { api, money } from '../../api';

function Metric({ label, value, icon, tone = '' }) {
  return (
    <div className={`metric-card ${tone ? `tone-${tone}` : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <small>{label}</small>
        {icon}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

export function AgentCopilotView({ workspaceId, insights, currency }) {
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      text: "Hello! I am HESABU's Autonomous Financial Copilot. I can analyze your treasury balances, detect overdue member dues, check double-entry balancing, and answer operational finance questions. How can I help you today?"
    }
  ]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSend(promptText) {
    const textToSend = promptText || query;
    if (!textToSend.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setQuery('');
    setBusy(true);

    try {
      const res = await api(`/workspaces/${workspaceId}/agent/query`, {
        method: 'POST',
        body: JSON.stringify({ question: textToSend })
      });
      const responseBody = res.response || res;
      setMessages(prev => [...prev, {
        role: 'agent',
        text: responseBody.answer,
        data: responseBody.toolData
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'agent', text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  const promptSuggestions = [
    "What is our total treasury balance and collection status?",
    "Show all overdue member contributions",
    "Analyze expense runway and approved spending",
    "Are all double-entry ledger accounts balanced?"
  ];

  return (
    <div className="stack">
      <div className="metric-grid">
        <Metric label="Reconciliation Status" value={insights?.reconciliationHealth || 'HEALTHY'} icon={<ShieldCheck />} tone="green" />
        <Metric label="Total Obligations" value={money(insights?.totalObligationsMinor, currency)} icon={<Wallet />} />
        <Metric label="Total Settled" value={money(insights?.totalSettledMinor, currency)} icon={<ArrowDownLeft />} tone="green" />
        <Metric label="Total Outstanding" value={money(insights?.totalOutstandingMinor, currency)} icon={<Activity />} tone="amber" />
      </div>

      <div className="prompt-chips">
        {promptSuggestions.map((p, i) => (
          <button key={i} className="chip" onClick={() => handleSend(p)}>
            {p}
          </button>
        ))}
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-bubble ${m.role}`}>
              <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '4px', opacity: 0.8 }}>
                {m.role === 'agent' ? 'HESABU Copilot' : 'You'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))}
          {busy && (
            <div className="chat-bubble agent">
              <span className="subtle">Analyzing double-entry ledger and external rails…</span>
            </div>
          )}
        </div>

        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="chat-input-bar">
          <input
            placeholder="Ask Copilot about contributions, runway, member debts, or ledger integrity…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="primary" disabled={busy || !query.trim()}>
            <Send size={15} /> Ask
          </button>
        </form>
      </div>

      {insights?.actionItems && insights.actionItems.length > 0 && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Autonomous Action Items</h2>
              <p>Reconciliation items flagged by agentic monitoring</p>
            </div>
            <span className="quiet-tag">{insights.actionItems.length} flagged</span>
          </div>
          <div className="stack">
            {insights.actionItems.map((item, idx) => (
              <div key={idx} style={{ padding: '12px', border: '1px solid #e7ebe7', borderRadius: '8px', background: '#fafbfa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <b>Item #{idx + 1}: {item.targetType || 'Settlement'}</b>
                  <span className="quiet-tag">{item.rail || 'EXTERNAL'}</span>
                </div>
                <p className="subtle">{item.recommendation || `Reference: ${item.externalRef}`}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

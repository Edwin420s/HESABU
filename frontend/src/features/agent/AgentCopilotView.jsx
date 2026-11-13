import React, { useState } from 'react';
import {
  ShieldCheck, Wallet, ArrowDownLeft, Activity, Send,
  Bot, User, Sparkles, RotateCcw, CheckCircle2, TrendingUp,
  Receipt, Landmark, PiggyBank, Scale
} from 'lucide-react';
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
      text: "Hello! I am HESABU's Autonomous Financial Copilot. I analyze your live double-entry books, member contributions, rotating savings, table loans, and supplier bills. What financial question can I help you with today?",
      time: 'Just now'
    }
  ]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSend(promptText) {
    const textToSend = promptText || query;
    if (!textToSend.trim()) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: textToSend, time: userTime }]);
    setQuery('');
    setBusy(true);

    try {
      const res = await api(`/workspaces/${workspaceId}/agent/query`, {
        method: 'POST',
        body: JSON.stringify({ question: textToSend })
      });
      const responseBody = res.response || res;
      const agentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, {
        role: 'agent',
        text: responseBody.answer,
        data: responseBody.toolData,
        agentInvoked: responseBody.agentInvoked,
        time: agentTime
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `Error processing financial query: ${e.message}`,
        time: 'Now'
      }]);
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    setMessages([
      {
        role: 'agent',
        text: "Conversation cleared. How can I assist with your workspace financial operations?",
        time: 'Just now'
      }
    ]);
  }

  const promptSuggestions = [
    { label: "Treasury balance & collection status", icon: <Wallet size={13} className="text-emerald-700" /> },
    { label: "Show all overdue member contributions", icon: <ArrowDownLeft size={13} className="text-amber-700" /> },
    { label: "What is the status of our table loans?", icon: <TrendingUp size={13} className="text-teal-700" /> },
    { label: "How is our Merry-Go-Round cycle progressing?", icon: <PiggyBank size={13} className="text-amber-700" /> },
    { label: "Are all double-entry ledger accounts balanced?", icon: <Scale size={13} className="text-emerald-700" /> },
    { label: "Show supplier bills awaiting payment", icon: <Receipt size={13} className="text-blue-700" /> }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Status Strip */}
      <div className="metric-grid">
        <Metric label="Reconciliation Status" value={insights?.reconciliationHealth || 'HEALTHY'} icon={<ShieldCheck />} tone="green" />
        <Metric label="Matched Settlements" value={insights?.matchedSettlementsCount ?? 0} icon={<Wallet />} />
        <Metric label="Unmatched Settlements" value={insights?.unmatchedSettlementsCount ?? 0} icon={<ArrowDownLeft />} tone={insights?.unmatchedSettlementsCount > 0 ? 'amber' : 'green'} />
        <Metric label="Stuck Payments" value={insights?.stuckPaymentsCount ?? 0} icon={<Activity />} tone={insights?.stuckPaymentsCount > 0 ? 'amber' : 'green'} />
      </div>

      {/* Suggested Quick Questions */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
          <Sparkles size={14} className="text-emerald-600" />
          <span>Suggested Financial Operations Queries</span>
        </div>
        <div className="prompt-chips">
          {promptSuggestions.map((p, i) => (
            <button
              key={i}
              type="button"
              className="chip"
              onClick={() => handleSend(p.label)}
              disabled={busy}
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Chat Console */}
      <div className="chat-container">
        {/* Console Header */}
        <div style={{
          background: '#0c271f',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(22, 101, 52, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: '#16a34a',
              display: 'grid',
              placeItems: 'center',
              color: '#ffffff'
            }}>
              <Bot size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em' }}>
                HESABU Autonomous Copilot
              </div>
              <div style={{ fontSize: '10px', color: '#86efac', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                <span>Double-Entry Intelligence Online</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer'
            }}
            title="Reset conversation"
          >
            <RotateCcw size={12} />
            <span>Clear</span>
          </button>
        </div>

        {/* Message Stream */}
        <div className="chat-messages">
          {messages.map((m, idx) => {
            const isAgent = m.role === 'agent';
            return (
              <div key={idx} className={`chat-bubble ${m.role}`}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  opacity: 0.85
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {isAgent ? <Bot size={13} className="text-emerald-700" /> : <User size={13} className="text-emerald-200" />}
                    <span>{isAgent ? 'HESABU Copilot' : 'You'}</span>
                    {m.agentInvoked && (
                      <span style={{
                        fontSize: '9px',
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        marginLeft: '4px',
                        fontWeight: 800
                      }}>
                        {m.agentInvoked}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>{m.time}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{m.text}</div>
              </div>
            );
          })}

          {busy && (
            <div className="chat-bubble agent">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 600 }}>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Analyzing double-entry journal, settlement rails, and obligations…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="chat-input-bar">
          <input
            placeholder="Ask Copilot about contributions, runway, member debts, or ledger integrity…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !query.trim()}>
            <Send size={15} />
            <span>Ask</span>
          </button>
        </form>
      </div>

      {/* Flagged Action Items */}
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
              <div key={idx} style={{ padding: '12px', border: '1px solid #d4dfd9', borderRadius: '8px', background: '#ffffff' }}>
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

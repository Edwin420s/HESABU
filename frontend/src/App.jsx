import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, BookOpen, Bot, Building2,
  CheckCircle2, ChevronDown, CircleHelp, CreditCard, FileSpreadsheet, FileText,
  Hash, History, LayoutDashboard, Lock, LogOut, MessageSquare, PiggyBank,
  Plus, Receipt, RefreshCw, Repeat, Send, ShieldCheck, Sparkles, Target,
  Trash2, TrendingUp, Undo2, Users, Wallet
} from 'lucide-react';
import { api, money } from './api';
import { InvoicesView, BillsView, ProcurementView, FxView } from './CommercialViews';

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: 'demo@hesabu.local', password: 'HesabuDemo!2026' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('hesabu_token', result.token);
      localStorage.setItem('hesabu_user', JSON.stringify(result.user));
      onAuth(result.user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <p className="eyebrow">ENTERPRISE FINANCIAL OPERATIONS</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="subtle">Multi-rail collaborative financial operations for chamas, cooperatives, SMEs, and associations.</p>
        <form onSubmit={submit} className="stack">
          {mode === 'register' && (
            <Field label="Full name">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
          )}
          <Field label="Email">
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password">
            <input type="password" required minLength="10" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </Field>
          {error && <p className="error">{error}</p>}
          <button className="primary full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New to HESABU? Create an account' : 'Already registered? Sign in'}
        </button>
        <p className="tiny">Demo credentials: demo@hesabu.local · HesabuDemo!2026</p>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">H</span>
      <span>HESABU</span>
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

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hesabu_user')); } catch { return null; }
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [page, setPage] = useState('overview');
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    api('/workspaces').then(r => {
      setWorkspaces(r.workspaces);
      if (!workspaceId && r.workspaces[0]) setWorkspaceId(r.workspaces[0].id);
    }).catch(e => setNotice(e.message));
  }, [user, refresh]);

  useEffect(() => {
    if (!workspaceId) return;
    api(`/workspaces/${workspaceId}`).then(r => setWorkspace(r.workspace)).catch(e => setNotice(e.message));
  }, [workspaceId, refresh]);

  function logout() {
    localStorage.removeItem('hesabu_token');
    localStorage.removeItem('hesabu_user');
    setUser(null);
    setWorkspaces([]);
    setWorkspace(null);
    navigate('/');
  }

  if (!user) return <Auth onAuth={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-picker">
          <div className="workspace-icon"><Building2 size={17} /></div>
          <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
            {workspaces.map(w => (
              <option key={w.id} value={w.id}>
                {w.country === 'ZA' ? '🇿🇦' : '🇰🇪'} {w.name} ({w.currency || 'KES'})
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">OPERATIONS</p>
        <nav>
          <NavButton active={page === 'overview'} onClick={() => setPage('overview')} icon={<LayoutDashboard size={17} />} label="Overview" />
          <NavButton active={page === 'contributions'} onClick={() => setPage('contributions')} icon={<ArrowDownLeft size={17} />} label="Contributions" />
          <NavButton active={page === 'invoices'} onClick={() => setPage('invoices')} icon={<FileText size={17} />} label="Invoices & AR" />
          <NavButton active={page === 'bills'} onClick={() => setPage('bills')} icon={<Receipt size={17} />} label="Bills & AP" />
          <NavButton active={page === 'procurement'} onClick={() => setPage('procurement')} icon={<Building2 size={17} />} label="Procurement" />
          <NavButton active={page === 'campaigns'} onClick={() => setPage('campaigns')} icon={<Target size={17} />} label="Campaigns & Goals" />
          <NavButton active={page === 'expenses'} onClick={() => setPage('expenses')} icon={<Receipt size={17} />} label="Expenses & Splits" />
          <NavButton active={page === 'reimbursements'} onClick={() => setPage('reimbursements')} icon={<PiggyBank size={17} />} label="Reimbursements" />
          <NavButton active={page === 'recurring'} onClick={() => setPage('recurring')} icon={<Repeat size={17} />} label="Recurring Dues" />
          <NavButton active={page === 'rosca'} onClick={() => setPage('rosca')} icon={<Repeat size={17} />} label="Merry-Go-Round" />
          <NavButton active={page === 'loans'} onClick={() => setPage('loans')} icon={<PiggyBank size={17} />} label="Table Loans" />
          <NavButton active={page === 'budgets'} onClick={() => setPage('budgets')} icon={<Target size={17} />} label="Budget Variance" />
          <NavButton active={page === 'fx'} onClick={() => setPage('fx')} icon={<TrendingUp size={17} />} label="FX & Treasury" />
          <NavButton active={page === 'payments'} onClick={() => setPage('payments')} icon={<CreditCard size={17} />} label="Payments & Rails" />
          <NavButton active={page === 'agent'} onClick={() => setPage('agent')} icon={<Bot size={17} />} label="Agentic Copilot" />
        </nav>
        <p className="nav-label" style={{ marginTop: '16px' }}>GOVERNANCE & LEDGER</p>
        <nav>
          <NavButton active={page === 'ledger'} onClick={() => setPage('ledger')} icon={<BookOpen size={17} />} label="Double-Entry Ledger" />
          <NavButton active={page === 'statements'} onClick={() => setPage('statements')} icon={<FileSpreadsheet size={17} />} label="Financial Statements" />
          <NavButton active={page === 'anchors'} onClick={() => setPage('anchors')} icon={<Lock size={17} />} label="Statement Anchors" />
          <NavButton active={page === 'members'} onClick={() => setPage('members')} icon={<Users size={17} />} label="Members & Access" />
          <NavButton active={page === 'audit'} onClick={() => setPage('audit')} icon={<History size={17} />} label="Audit Trail" />
          <NavButton active={page === 'reports'} onClick={() => setPage('reports')} icon={<FileText size={17} />} label="Exports" />
        </nav>
        <div className="sidebar-bottom">
          <div className="help-link"><CircleHelp size={16} /> Financial Operations Platform</div>
          <div className="profile">
            <div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
            <div className="profile-info">
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
            <button className="icon-button" title="Sign out" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="slash">/</span>
            <b>{workspace?.name || 'Loading workspace'}</b>
          </div>
          <div className="top-actions">
            <span className="status-dot" /> {workspace?.country === 'ZA' ? '🇿🇦 South Africa (ZAR · PayShap & Horizon)' : '🇰🇪 Kenya (KES · M-Pesa STK & Horizon)'}
            <button className="icon-button" onClick={() => setRefresh(v => v + 1)} title="Refresh Data"><RefreshCw size={15} /></button>
            <button className="icon-button"><Bell size={17} /></button>
          </div>
        </header>

        {notice && (
          <div className="notice" onClick={() => setNotice('')}>
            {notice} <span>×</span>
          </div>
        )}

        <div className="page-content">
          {!workspaceId ? (
            <EmptyWorkspace onCreated={() => setRefresh(v => v + 1)} />
          ) : (
            <Routes>
              <Route path="*" element={<WorkspacePage page={page} workspace={workspace} workspaceId={workspaceId} refresh={() => setRefresh(v => v + 1)} setNotice={setNotice} />} />
            </Routes>
          )}
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

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

function WorkspacePage({ page, workspace, workspaceId, refresh, setNotice }) {
  const [data, setData] = useState({
    summary: null,
    obligations: [],
    campaigns: [],
    expenses: [],
    reimbursements: [],
    recurring: [],
    payments: [],
    agent: null,
    journal: [],
    auditLogs: [],
    anchors: [],
    trialBalance: null,
    incomeStatement: null,
    rosca: [],
    loans: [],
    variance: null
  });
  const [modal, setModal] = useState('');
  const [payModal, setPayModal] = useState(null);
  const [campaignModal, setCampaignModal] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api(`/workspaces/${workspaceId}/dashboard`),
      api(`/workspaces/${workspaceId}/obligations`),
      api(`/workspaces/${workspaceId}/campaigns`).catch(() => ({ campaigns: [] })),
      api(`/workspaces/${workspaceId}/expenses`),
      api(`/workspaces/${workspaceId}/reimbursements`).catch(() => ({ reimbursements: [] })),
      api(`/workspaces/${workspaceId}/recurring`).catch(() => ({ schedules: [] })),
      api(`/workspaces/${workspaceId}/payments`),
      api(`/workspaces/${workspaceId}/agent/reconcile`),
      api(`/workspaces/${workspaceId}/journal`),
      api(`/workspaces/${workspaceId}/audit`),
      api(`/workspaces/${workspaceId}/anchors`).catch(() => ({ anchors: [] })),
      api(`/workspaces/${workspaceId}/reports/trial-balance`).catch(() => null),
      api(`/workspaces/${workspaceId}/reports/income-statement`).catch(() => null),
      api(`/workspaces/${workspaceId}/analytics/health-score`).catch(() => null),
      api(`/workspaces/${workspaceId}/rosca`).catch(() => ({ cycles: [] })),
      api(`/workspaces/${workspaceId}/loans`).catch(() => ({ loans: [] })),
      api(`/workspaces/${workspaceId}/budgets/variance`).catch(() => null)
    ]).then(([d, o, c, e, r, rec, p, a, j, au, anc, tb, is, an, ro, lo, va]) => setData({
      summary: d.summary,
      obligations: o.obligations,
      campaigns: c.campaigns || [],
      expenses: e.expenses,
      reimbursements: r.reimbursements || [],
      recurring: rec.schedules || [],
      payments: p.payments,
      agent: a.insights,
      journal: j.entries,
      auditLogs: au.auditLogs,
      anchors: anc.anchors || [],
      trialBalance: tb,
      incomeStatement: is,
      analytics: an,
      rosca: ro.cycles || [],
      loans: lo.loans || [],
      variance: va
    })).catch(err => setNotice(err.message));
  }, [workspaceId, refresh]);

  async function create(kind, form) {
    setBusy(true);
    try {
      if (kind === 'obligation') await api(`/workspaces/${workspaceId}/obligations`, { method: 'POST', body: JSON.stringify(form) });
      if (kind === 'campaign') await api(`/workspaces/${workspaceId}/campaigns`, { method: 'POST', body: JSON.stringify(form) });
      if (kind === 'expense') await api(`/workspaces/${workspaceId}/expenses`, { method: 'POST', body: JSON.stringify(form) });
      if (kind === 'reimbursement') await api(`/workspaces/${workspaceId}/reimbursements`, { method: 'POST', body: JSON.stringify(form) });
      if (kind === 'recurring') await api(`/workspaces/${workspaceId}/recurring`, { method: 'POST', body: JSON.stringify(form) });
      if (kind === 'anchor') await api(`/workspaces/${workspaceId}/anchors/generate`, { method: 'POST', body: JSON.stringify(form) });
      setModal('');
      refresh();
      setNotice('Record created successfully.');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePayment(obligationId, rail, phoneNumber) {
    try {
      const res = await api(`/obligations/${obligationId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ rail, phoneNumber })
      });
      setPayModal(null);
      refresh();
      setNotice(res.notice || 'Payment attempt created.');
    } catch (e) {
      setNotice(e.message);
    }
  }

  const currency = workspace?.currency || 'KES';
  const modalUI = <Modal type={modal} onClose={() => setModal('')} busy={busy} onSubmit={create} members={workspace?.memberships} />;
  const payModalUI = payModal && (
    <PaymentInitModal
      obligation={payModal}
      currency={currency}
      onClose={() => setPayModal(null)}
      onSubmit={(rail, phone) => handleCreatePayment(payModal.id, rail, phone)}
    />
  );

  if (page === 'overview') {
    return (
      <>
        <Overview
          workspace={workspace}
          summary={data.summary}
          obligations={data.obligations}
          campaigns={data.campaigns}
          expenses={data.expenses}
          reimbursements={data.reimbursements}
          agent={data.agent}
          analytics={data.analytics}
          setModal={setModal}
        />
        {modalUI}
      </>
    );
  }
  if (page === 'contributions') {
    return (
      <>
        <PageHeader
          eyebrow="COLLECTIONS"
          title="Contributions & Obligations"
          description="Track member contribution obligations, payment attempts, and verified settlements."
          action={<button className="primary" onClick={() => setModal('obligation')}><Plus size={16} /> New obligation</button>}
        />
        <ObligationTable rows={data.obligations} currency={currency} onPay={setPayModal} refresh={refresh} setNotice={setNotice} />
        {modalUI}
        {payModalUI}
      </>
    );
  }
  if (page === 'invoices') {
    return <InvoicesView workspaceId={workspaceId} currency={currency} setNotice={setNotice} refresh={refresh} />;
  }
  if (page === 'bills') {
    return <BillsView workspaceId={workspaceId} currency={currency} setNotice={setNotice} refresh={refresh} />;
  }
  if (page === 'procurement') {
    return <ProcurementView workspaceId={workspaceId} currency={currency} setNotice={setNotice} refresh={refresh} />;
  }
  if (page === 'campaigns') {
    return (
      <>
        <PageHeader
          eyebrow="TARGETED FUNDRAISING"
          title="Campaigns & Group Goals"
          description="Crowdfund specific projects, asset purchases, emergencies, or community initiatives."
          action={<button className="primary" onClick={() => setModal('campaign')}><Plus size={16} /> New Campaign</button>}
        />
        <CampaignsHub campaigns={data.campaigns} currency={currency} onAddContribution={c => { setCampaignModal(c); setModal('obligation'); }} />
        {modalUI}
      </>
    );
  }
  if (page === 'expenses') {
    return (
      <>
        <PageHeader
          eyebrow="SPENDING"
          title="Expenses & Multi-Member Splits"
          description="Submit costs, review approvals with separation of duties, and execute payouts."
          action={<button className="primary" onClick={() => setModal('expense')}><Plus size={16} /> Add expense</button>}
        />
        <ExpenseTable rows={data.expenses} currency={currency} refresh={refresh} setNotice={setNotice} />
        {modalUI}
      </>
    );
  }
  if (page === 'reimbursements') {
    return (
      <>
        <PageHeader
          eyebrow="OUT-OF-POCKET EXPENSES"
          title="Member Reimbursements"
          description="Review out-of-pocket claims from members and disburse payouts directly to their verified accounts."
          action={<button className="primary" onClick={() => setModal('reimbursement')}><Plus size={16} /> Submit Claim</button>}
        />
        <ReimbursementsView reimbursements={data.reimbursements} currency={currency} refresh={refresh} setNotice={setNotice} />
        {modalUI}
      </>
    );
  }
  if (page === 'recurring') {
    return (
      <>
        <PageHeader
          eyebrow="AUTOMATED RECURRENCE"
          title="Recurring Dues Schedules"
          description="Configure weekly, monthly, or quarterly dues cycles that automatically bill all members."
          action={<button className="primary" onClick={() => setModal('recurring')}><Plus size={16} /> New Schedule</button>}
        />
        <RecurringDuesView schedules={data.recurring} currency={currency} refresh={refresh} setNotice={setNotice} />
        {modalUI}
      </>
    );
  }
  if (page === 'rosca') {
    return <RoscaView workspaceId={workspaceId} cycles={data.rosca || []} refresh={refresh} setNotice={setNotice} currency={currency} />;
  }
  if (page === 'loans') {
    return <LoansView workspaceId={workspaceId} loans={data.loans || []} refresh={refresh} setNotice={setNotice} currency={currency} />;
  }
  if (page === 'budgets') {
    return <BudgetVarianceView workspaceId={workspaceId} variance={data.variance} currency={currency} />;
  }
  if (page === 'fx') {
    return <FxView workspaceId={workspaceId} currency={currency} setNotice={setNotice} />;
  }
  if (page === 'payments') {
    return (
      <>
        <PageHeader
          eyebrow="MONEY MOVEMENT"
          title="Payment Transactions"
          description="Payment attempts remain pending until independently verified on Stellar Horizon or Safaricom M-Pesa."
        />
        <FxConverterCard />
        <PaymentTable rows={data.payments} currency={currency} refresh={refresh} setNotice={setNotice} />
      </>
    );
  }
  if (page === 'agent') {
    return (
      <>
        <PageHeader
          eyebrow="AGENTIC COGNITION"
          title="Autonomous Financial Copilot"
          description="Interactive AI agent providing live cashflow analysis, reconciliation checks, and natural-language queries."
        />
        <AgentCopilotView workspaceId={workspaceId} insights={data.agent} currency={currency} />
      </>
    );
  }
  if (page === 'ledger') {
    return (
      <>
        <PageHeader
          eyebrow="ACCOUNTING CORE"
          title="Double-Entry Journal"
          description="Immutable, balanced journal entries posted upon external settlement verification."
        />
        <LedgerView entries={data.journal} currency={currency} refresh={refresh} setNotice={setNotice} />
      </>
    );
  }
  if (page === 'statements') {
    return (
      <>
        <PageHeader
          eyebrow="FINANCIAL REPORTING"
          title="Trial Balance & Income Statement"
          description="Real-time mathematical verification of double-entry ledger equality and operational performance."
        />
        <FinancialStatementsView trialBalance={data.trialBalance} incomeStatement={data.incomeStatement} currency={currency} />
      </>
    );
  }
  if (page === 'anchors') {
    return (
      <>
        <PageHeader
          eyebrow="CRYPTOGRAPHIC AUDITABILITY"
          title="Statement Anchors (Merkle Roots)"
          description="Canonical SHA-256 Merkle root fingerprints of financial periods for tamper-proof verification."
          action={<button className="primary" onClick={() => setModal('anchor')}><Plus size={16} /> Generate Anchor</button>}
        />
        <AnchorsView anchors={data.anchors} currency={currency} />
        {modalUI}
      </>
    );
  }
  if (page === 'members') return <Members workspace={workspace} refresh={refresh} setNotice={setNotice} />;
  if (page === 'audit') {
    return (
      <>
        <PageHeader
          eyebrow="SECURITY & GOVERNANCE"
          title="Audit Trail"
          description="Complete immutable history of administrative, financial, and security actions."
        />
        <AuditView logs={data.auditLogs} workspaceId={workspaceId} />
      </>
    );
  }
  if (page === 'reports') return <Reports workspaceId={workspaceId} />;

  return null;
}

function Overview({ workspace, summary, obligations, campaigns, expenses, reimbursements, agent, analytics, setModal }) {
  const currency = workspace?.currency || 'KES';
  const pendingReimb = reimbursements?.filter(r => r.status === 'SUBMITTED')?.length || 0;
  const activeCampaigns = campaigns?.filter(c => c.status === 'ACTIVE')?.length || 0;

  return (
    <>
      <PageHeader
        eyebrow="ENTERPRISE FINANCIAL DASHBOARD"
        title="Good work starts with financial clarity."
        description={`${workspace?.name || 'Your workspace'} · Collaborative financial operations, multi-rail settlements, and double-entry rigor.`}
        action={<button className="primary" onClick={() => setModal('obligation')}><Plus size={16} /> New obligation</button>}
      />
      <div className="metric-grid">
        <Metric label="Expected contributions" value={money(summary?.obligationsMinor, currency)} icon={<Wallet />} tone="green" />
        <Metric label="Confirmed received" value={money(summary?.receivedMinor, currency)} icon={<ArrowDownLeft />} />
        <Metric label="Outstanding balance" value={money(summary?.outstandingMinor, currency)} icon={<Activity />} tone="amber" />
        <Metric label="Approved expenses" value={money(summary?.approvedExpensesMinor, currency)} icon={<ArrowUpRight />} />
      </div>

      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '20px' }}>
          <div className="panel" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: '13px' }}>Chama Financial Health Score</b>
                <p className="subtle" style={{ margin: '3px 0 0' }}>Collection efficiency and organizational liquidity index</p>
              </div>
              <span className={`status status-${analytics.rating.toLowerCase()}`}>{analytics.rating} ({analytics.healthScore}/100)</span>
            </div>
            <div className="progress-bar-bg" style={{ marginTop: '12px' }}>
              <div className={`progress-bar-fill ${analytics.healthScore >= 70 ? 'complete' : 'warning'}`} style={{ width: `${analytics.healthScore}%` }} />
            </div>
          </div>
          <div className="panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="subtle" style={{ fontSize: '11px' }}>Collection Efficiency</span>
            <strong style={{ fontSize: '18px', color: '#245c46' }}>{analytics.metrics.collectionRatePct}% Settled</strong>
            <small style={{ fontSize: '10px', color: '#8a958f' }}>{analytics.metrics.settledObligations} of {analytics.metrics.totalObligations} dues collected</small>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <div className="metric-card" style={{ padding: '14px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#7b8780' }}>Active Campaigns</p>
          <strong style={{ fontSize: '18px' }}>{activeCampaigns} Goals</strong>
          <small>{campaigns?.length || 0} total campaigns created</small>
        </div>
        <div className="metric-card" style={{ padding: '14px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#7b8780' }}>Pending Reimbursements</p>
          <strong style={{ fontSize: '18px' }}>{pendingReimb} Claims</strong>
          <small>Awaiting approver review</small>
        </div>
        <div className="metric-card" style={{ padding: '14px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#7b8780' }}>Settlement Rails</p>
          <strong style={{ fontSize: '18px' }}>Stellar + M-Pesa</strong>
          <small>Direct on-chain & mobile money</small>
        </div>
      </div>

      {agent && (
        <div className="agent-banner">
          <div className="agent-banner-header">
            <div className="agent-tag"><Sparkles size={14} /> Autonomous Reconciliation Agent</div>
            <span className={`status status-${agent.reconciliationHealth.toLowerCase()}`}>{agent.reconciliationHealth}</span>
          </div>
          <p>
            {agent.actionItems.length === 0
              ? 'All obligations, payments, and expenses are fully reconciled and balanced in the double-entry journal.'
              : `${agent.actionItems.length} active items identified by the Reconciliation Agent for administrator attention.`}
          </p>
        </div>
      )}

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent obligations</h2>
              <p>Contribution items in this workspace</p>
            </div>
            <span className="quiet-tag">{obligations.length} records</span>
          </div>
          <ObligationTable rows={obligations.slice(0, 5)} currency={currency} compact />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Expense activity</h2>
              <p>Recently submitted costs</p>
            </div>
            <Receipt size={18} className="muted-icon" />
          </div>
          <ExpenseTable rows={expenses.slice(0, 5)} currency={currency} compact />
        </section>
      </div>

      <div className="trust-note">
        <ShieldCheck size={18} />
        <div>
          <b>Built around financial accountability & double-entry integrity</b>
          <p>Payment attempts are not treated as confirmed money. Settlements are recorded only after provider or on-chain verification, generating balanced debits and credits.</p>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, icon, tone = '' }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>Workspace totals</small>
    </div>
  );
}

function CampaignsHub({ campaigns, currency, onAddContribution }) {
  if (!campaigns?.length) return <EmptyState text="No fundraising campaigns yet. Create one to collect towards specific goals." />;

  return (
    <div className="card-grid">
      {campaigns.map(c => {
        const target = Number(c.targetMinor || 0);
        const raised = Number(c.raisedMinor || 0);
        const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

        return (
          <div key={c.id} className="entity-card">
            <div>
              <div className="entity-card-header">
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.description || 'Targeted community campaign'}</p>
                </div>
                <Status value={c.status} />
              </div>

              <div style={{ margin: '14px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                  <span>{money(raised, currency)} raised</span>
                  <span>{pct}% of {money(target, currency)}</span>
                </div>
                <div className="progress-bar-bg">
                  <div className={`progress-bar-fill ${pct >= 100 ? 'complete' : ''}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>

            <div className="entity-card-meta">
              <span>{c.obligations?.length || 0} contributions pledged</span>
              <button className="small-button" onClick={() => onAddContribution(c)}>
                + Add Pledge
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReimbursementsView({ reimbursements, currency, refresh, setNotice }) {
  if (!reimbursements?.length) return <EmptyState text="No reimbursement claims filed yet. Members can submit claims for out-of-pocket expenses." />;

  async function handleAction(id, action) {
    try {
      if (action === 'approve') {
        await api(`/reimbursements/${id}/approve`, { method: 'POST' });
        setNotice('Claim approved.');
      } else if (action === 'pay') {
        await api(`/reimbursements/${id}/pay`, { method: 'POST' });
        setNotice('Claim paid and posted to double-entry ledger (Debit: 5050, Credit: 1000).');
      } else if (action === 'reject') {
        const reason = prompt('Rejection reason:');
        if (!reason) return;
        await api(`/reimbursements/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
        setNotice('Claim rejected.');
      }
      refresh();
    } catch (e) {
      setNotice(e.message);
    }
  }

  return (
    <div className="panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Claim</th>
              <th>Member</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Receipt / Proof</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reimbursements.map(r => (
              <tr key={r.id}>
                <td>
                  <b>{r.title}</b>
                  <small>{r.description || 'Out of pocket claim'}</small>
                </td>
                <td>{r.claimant?.name || r.claimant?.email || 'Member'}</td>
                <td><span className="quiet-tag">{r.category}</span></td>
                <td className="amount">{money(r.amountMinor, currency)}</td>
                <td>
                  {r.receiptUrl ? (
                    <a href={r.receiptUrl} target="_blank" rel="noreferrer" style={{ color: '#245c46', textDecoration: 'underline', fontSize: '11px' }}>
                      View Receipt
                    </a>
                  ) : <span className="subtle">No file</span>}
                </td>
                <td><Status value={r.status} /></td>
                <td>
                  <div className="inline-actions">
                    {r.status === 'SUBMITTED' && (
                      <>
                        <button className="small-button" onClick={() => handleAction(r.id, 'approve')}>Approve</button>
                        <button className="small-button danger" onClick={() => handleAction(r.id, 'reject')}>Reject</button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button className="small-button" onClick={() => handleAction(r.id, 'pay')}>
                        Disburse Payout
                      </button>
                    )}
                    {r.status === 'PAID' && <span className="quiet-tag">Paid</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecurringDuesView({ schedules, currency, refresh, setNotice }) {
  if (!schedules?.length) return <EmptyState text="No recurring dues schedules. Create automated recurring dues for chama or subscription cycles." />;

  async function triggerSchedule(id) {
    try {
      const res = await api(`/recurring/${id}/trigger`, { method: 'POST' });
      setNotice(res.message || 'Cycle triggered and obligations generated for members.');
      refresh();
    } catch (e) {
      setNotice(e.message);
    }
  }

  return (
    <div className="panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Schedule Title</th>
              <th>Interval</th>
              <th>Amount per Member</th>
              <th>Next Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s.id}>
                <td>
                  <b>{s.title}</b>
                  <small>Created {new Date(s.createdAt).toLocaleDateString()}</small>
                </td>
                <td><span className="quiet-tag">{s.interval}</span></td>
                <td className="amount">{money(s.amountMinor, currency)}</td>
                <td>{new Date(s.nextRunAt).toLocaleDateString()}</td>
                <td><span className={`status ${s.isActive ? 'status-confirmed' : 'status-failed'}`}>{s.isActive ? 'Active' : 'Paused'}</span></td>
                <td>
                  <button className="small-button" onClick={() => triggerSchedule(s.id)}>
                    <Repeat size={12} style={{ marginRight: '4px' }} /> Trigger Cycle Now
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinancialStatementsView({ trialBalance, incomeStatement, currency }) {
  const [tab, setTab] = useState('trial-balance');

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: '10px' }}>
        <button className={`secondary ${tab === 'trial-balance' ? 'active' : ''}`} onClick={() => setTab('trial-balance')}>
          Trial Balance
        </button>
        <button className={`secondary ${tab === 'income-statement' ? 'active' : ''}`} onClick={() => setTab('income-statement')}>
          Income Statement (P&L)
        </button>
      </div>

      {tab === 'trial-balance' && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Trial Balance & Account Balances</h2>
              <p>Double-entry balancing ledger verification as of {new Date().toLocaleDateString()}</p>
            </div>
            {trialBalance?.isBalanced ? (
              <span className="crypto-badge"><CheckCircle2 size={12} /> Double-Entry Balanced</span>
            ) : (
              <span className="status status-failed">Out of Balance</span>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Total Debits</th>
                  <th>Total Credits</th>
                  <th>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance?.accounts?.map(a => (
                  <tr key={a.accountCode}>
                    <td><b>{a.accountCode}</b></td>
                    <td>{money(a.totalDebitMinor, currency)}</td>
                    <td>{money(a.totalCreditMinor, currency)}</td>
                    <td className="amount">{money(a.netBalanceMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid #17231f' }}>
                  <td>TOTALS</td>
                  <td>{money(trialBalance?.totalDebitsMinor || 0, currency)}</td>
                  <td>{money(trialBalance?.totalCreditsMinor || 0, currency)}</td>
                  <td>{trialBalance?.isBalanced ? 'Balanced (Zero Difference)' : 'Discrepancy'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'income-statement' && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Income Statement (Surplus & Deficit)</h2>
              <p>Recognized member contributions vs operating expenses</p>
            </div>
            <span className={`status ${Number(incomeStatement?.netSurplusMinor || 0) >= 0 ? 'status-confirmed' : 'status-failed'}`}>
              {Number(incomeStatement?.netSurplusMinor || 0) >= 0 ? 'Net Surplus' : 'Net Deficit'}
            </span>
          </div>

          <div className="metric-grid" style={{ marginBottom: '20px' }}>
            <Metric label="Recognized Revenue" value={money(incomeStatement?.revenueMinor, currency)} icon={<ArrowDownLeft />} tone="green" />
            <Metric label="Total Expenses" value={money(incomeStatement?.expensesMinor, currency)} icon={<ArrowUpRight />} tone="amber" />
            <Metric
              label="Net Operating Surplus"
              value={money(incomeStatement?.netSurplusMinor, currency)}
              icon={<TrendingUp />}
              tone={Number(incomeStatement?.netSurplusMinor || 0) >= 0 ? 'green' : 'amber'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AnchorsView({ anchors, currency }) {
  return (
    <div className="stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
        <div className="metric-card" style={{ padding: '14px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#7b8780' }}>Soroban Contract</p>
          <strong style={{ fontSize: '16px' }}>hesabu_anchor.wasm</strong>
          <small>Stellar Testnet WASM</small>
        </div>
        <div className="metric-card" style={{ padding: '14px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#7b8780' }}>Cryptographic Scheme</p>
          <strong style={{ fontSize: '16px' }}>SHA-256 Merkle</strong>
          <small>256-bit canonical roots</small>
        </div>
        <div className="metric-card" style={{ padding: '14px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#7b8780' }}>Tamper-Proof Audit</p>
          <strong style={{ fontSize: '16px' }}>Immutable</strong>
          <small>Zero modifications allowed</small>
        </div>
      </div>

      {!anchors?.length ? (
        <EmptyState text="No period anchors generated yet. Generate an anchor to fingerprint journal entries into a canonical SHA-256 Merkle root." />
      ) : (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Cryptographic Period Fingerprints</h2>
              <p>Canonical SHA-256 Merkle roots locking journal entries for external auditing</p>
            </div>
            <span className="quiet-tag">{anchors.length} anchors</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Anchor Reference</th>
                  <th>Period Window</th>
                  <th>Entries Sealed</th>
                  <th>SHA-256 Merkle Fingerprint</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {anchors.map(a => (
                  <tr key={a.id}>
                    <td>
                      <b>{a.id.slice(0, 8)}…</b>
                      <small>Generated {new Date(a.createdAt).toLocaleString()}</small>
                    </td>
                    <td>{new Date(a.periodStart).toLocaleDateString()} – {new Date(a.periodEnd).toLocaleDateString()}</td>
                    <td><b>{a.entryCount} entries</b></td>
                    <td>
                      <span className="crypto-hash">{a.merkleRoot}</span>
                    </td>
                    <td>
                      <span className="crypto-badge"><CheckCircle2 size={12} /> Cryptographically Sealed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentCopilotView({ workspaceId, insights, currency }) {
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
        body: JSON.stringify({ query: textToSend })
      });
      setMessages(prev => [...prev, { role: 'agent', text: res.answer, data: res.data }]);
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
                  <b>{item.type}</b>
                  <span className={`status status-${item.severity.toLowerCase()}`}>{item.severity}</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#55655b' }}>{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ObligationTable({ rows, currency, compact = false, onPay, refresh, setNotice }) {
  if (!rows.length) return <EmptyState text="No obligations yet. Create one to start tracking contributions." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Obligation</th>
            <th>Member</th>
            <th>Amount</th>
            <th>Status</th>
            {!compact && <th>Due date</th>}
            {!compact && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <b>{r.title}</b>
                <small>{r.description || 'Contribution'}</small>
              </td>
              <td>{r.memberName}</td>
              <td className="amount">{money(r.amountMinor, currency)}</td>
              <td><Status value={r.status} /></td>
              {!compact && <td>{r.dueAt ? new Date(r.dueAt).toLocaleDateString() : '—'}</td>}
              {!compact && (
                <td>
                  <div className="inline-actions">
                    {r.status !== 'SETTLED' && r.status !== 'CANCELLED' && (
                      <button className="small-button" onClick={() => onPay?.(r)}>
                        Pay / Settle
                      </button>
                    )}
                    {r.status !== 'SETTLED' && r.status !== 'CANCELLED' && (
                      <button className="small-button danger" onClick={async () => {
                        if (!confirm('Are you sure you want to cancel this obligation?')) return;
                        try {
                          await api(`/obligations/${r.id}/cancel`, { method: 'POST' });
                          refresh?.();
                          setNotice?.('Obligation cancelled.');
                        } catch (e) { setNotice?.(e.message); }
                      }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentInitModal({ obligation, currency, onClose, onSubmit }) {
  const [rail, setRail] = useState('STELLAR');
  const [phone, setPhone] = useState('');

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">CHOOSE SETTLEMENT RAIL</p>
            <h2>Pay Obligation</h2>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="stack">
          <p className="subtle">
            Obligation: <b>{obligation.title}</b> ({money(obligation.amountMinor, currency)})
          </p>
          <Field label="Settlement Rail">
            <select value={rail} onChange={e => setRail(e.target.value)}>
              <option value="STELLAR">Stellar Network (USDC Live Horizon Verification)</option>
              <option value="MPESA">Safaricom M-Pesa (Daraja STK Push & Webhook)</option>
              <option value="DEVELOPMENT">Development Simulation (Sandbox)</option>
            </select>
          </Field>
          {rail === 'MPESA' && (
            <Field label="Kenyan Phone Number (2547XXXXXXXX)">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 254712345678" />
            </Field>
          )}
          {rail === 'STELLAR' && (
            <p className="tiny" style={{ background: '#edf4ef', padding: '10px', borderRadius: '6px' }}>
              Memo Reference: <b>HESABU-{obligation.id.slice(0, 8)}</b>. You will authorize the transaction using a Stellar wallet or Horizon transaction.
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="primary" onClick={() => onSubmit(rail, phone.trim())}>
              Initiate Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseTable({ rows, currency, compact = false, refresh, setNotice }) {
  if (!rows.length) return <EmptyState text="No expenses recorded yet." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Expense</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Status</th>
            {!compact && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <b>{r.title}</b>
                <small>{r.description || 'Submitted expense'}</small>
              </td>
              <td>{r.category}</td>
              <td className="amount">{money(r.amountMinor, currency)}</td>
              <td><Status value={r.status} /></td>
              {!compact && (
                <td>
                  <div className="inline-actions">
                    {r.status === 'SUBMITTED' && (
                      <>
                        <button className="small-button" onClick={async () => {
                          try {
                            await api(`/expenses/${r.id}/approve`, { method: 'POST' });
                            refresh();
                            setNotice('Expense approved.');
                          } catch (e) { setNotice(e.message); }
                        }}>Approve</button>
                        <button className="small-button danger" onClick={async () => {
                          const note = prompt('Reason for rejection:');
                          if (!note) return;
                          try {
                            await api(`/expenses/${r.id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
                            refresh();
                            setNotice('Expense rejected.');
                          } catch (e) { setNotice(e.message); }
                        }}>Reject</button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button className="small-button" onClick={async () => {
                        try {
                          await api(`/expenses/${r.id}/pay`, { method: 'POST' });
                          refresh();
                          setNotice('Expense marked paid and posted to journal.');
                        } catch (e) { setNotice(e.message); }
                      }}>
                        Record Payout
                      </button>
                    )}
                    {r.status === 'PAID' && <span className="quiet-tag">Settled</span>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTable({ rows, currency, refresh, setNotice }) {
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  if (!rows.length) return <EmptyState text="No payment attempts yet. Open an obligation and create a payment attempt." />;

  async function handleVerify(p) {
    try {
      if (p.rail === 'DEVELOPMENT') {
        await api(`/payments/${p.id}/dev-confirm`, { method: 'POST' });
        setNotice('Development simulated settlement recorded.');
      } else if (p.rail === 'STELLAR') {
        const txHash = prompt('Enter confirmed Stellar 64-character Transaction Hash from your wallet or Horizon:');
        if (!txHash) return;
        await api(`/payments/${p.id}/stellar-confirm`, { method: 'POST', body: JSON.stringify({ txHash: txHash.trim() }) });
        setNotice('Stellar on-chain transaction verified and posted to double-entry journal.');
      } else if (p.rail === 'MPESA') {
        const receiptNumber = prompt('Enter Safaricom M-Pesa Receipt Number (e.g. QA12345678):');
        if (!receiptNumber) return;
        await api(`/payments/${p.id}/mpesa-confirm`, { method: 'POST', body: JSON.stringify({ receiptNumber: receiptNumber.trim().toUpperCase() }) });
        setNotice('M-Pesa payment confirmed and posted to journal.');
      }
      refresh();
    } catch (e) {
      setNotice(e.message);
    }
  }

  return (
    <div className="panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Obligation</th>
              <th>Rail</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference / Hash</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>
                  <b>{r.id.slice(0, 9)}</b>
                  <small>{new Date(r.createdAt).toLocaleString()}</small>
                </td>
                <td>{r.obligation?.title}</td>
                <td>
                  <span className={`status status-${r.rail.toLowerCase()}`}>{r.rail}</span>
                </td>
                <td className="amount">{money(r.amountMinor, currency)}</td>
                <td><Status value={r.status} /></td>
                <td>
                  <small className="crypto-hash">{r.txHash || r.providerRef || 'Awaiting verification'}</small>
                </td>
                <td>
                  {r.status === 'PENDING' ? (
                    <button className="small-button" onClick={() => handleVerify(r)}>
                      {r.rail === 'STELLAR' ? 'Verify on Stellar' : r.rail === 'MPESA' ? 'Confirm M-Pesa' : 'Simulate verify'}
                    </button>
                  ) : (
                    <button className="small-button" onClick={() => setSelectedReceipt(r)}>
                      View Voucher
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        All verified settlements are atomically posted to the double-entry accounting journal.
      </p>

      {selectedReceipt && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelectedReceipt(null)}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">VERIFIED TRANSACTION VOUCHER</p>
                <h2>RCP-{selectedReceipt.id.slice(0, 8).toUpperCase()}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedReceipt(null)}>×</button>
            </div>
            <div className="stack" style={{ fontSize: '12px' }}>
              <div style={{ background: '#fafbfa', border: '1px solid #e7ebe7', padding: '14px', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 6px', color: '#7b8780' }}>Obligation Title</p>
                <b style={{ fontSize: '13px' }}>{selectedReceipt.obligation?.title}</b>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Settlement Rail:</span>
                  <b>{selectedReceipt.rail}</b>
                </div>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Amount Settled:</span>
                  <b style={{ color: '#245c46' }}>{money(selectedReceipt.amountMinor, currency)}</b>
                </div>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Settlement Status:</span>
                  <span className="crypto-badge"><CheckCircle2 size={12} /> {selectedReceipt.status}</span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#7b8780' }}>Reference / Hash:</span>
                  <div className="crypto-hash" style={{ marginTop: '4px' }}>{selectedReceipt.txHash || selectedReceipt.providerRef}</div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setSelectedReceipt(null)}>Close</button>
                <button type="button" className="primary" onClick={() => window.print()}>Print Receipt</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerView({ entries, currency, refresh, setNotice }) {
  if (!entries?.length) return <EmptyState text="No journal entries posted yet. Confirm a payment or pay an approved expense to create journal entries." />;

  async function handleReverse(id) {
    const reason = prompt('Reason for audit reversal:');
    if (!reason) return;
    try {
      await api(`/journal/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) });
      setNotice('Entry reversed with balanced counter-entry.');
      refresh?.();
    } catch (e) {
      setNotice?.(e.message);
    }
  }

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>Posted Double-Entry Journal Entries</h2>
          <p>Every transaction maintains strict balanced debit and credit ledger lines.</p>
        </div>
        <span className="quiet-tag">{entries.length} entries</span>
      </div>

      <div className="stack">
        {entries.map(e => (
          <div key={e.id} style={{ border: '1px solid #edf0ed', borderRadius: '8px', padding: '14px', background: '#fafbfa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <b>{e.reference}</b>
                <span className="quiet-tag" style={{ marginLeft: '10px' }}>{new Date(e.postedAt).toLocaleString()}</span>
                {e.reversedEntryId && <span className="status status-failed" style={{ marginLeft: '8px' }}>Reversal Entry</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="status status-settled">{e.status}</span>
                {!e.reversedEntryId && (
                  <button className="small-button danger" onClick={() => handleReverse(e.id)}>
                    <Undo2 size={12} style={{ marginRight: '4px' }} /> Reverse
                  </button>
                )}
              </div>
            </div>
            <p className="subtle" style={{ marginBottom: '10px' }}>{e.description}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Side</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {e.lines.map(l => (
                    <tr key={l.id}>
                      <td><b>{l.accountCode}</b></td>
                      <td>
                        <span className={`status status-${l.side.toLowerCase()}`}>{l.side}</span>
                      </td>
                      <td className="amount">{money(l.amountMinor, l.currency || currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FxConverterCard() {
  const [fromCurr, setFromCurr] = useState('USD');
  const [toCurr, setToCurr] = useState('KES');
  const [amount, setAmount] = useState('100');
  const [conversion, setConversion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    const decimals = (fromCurr === 'UGX' || fromCurr === 'TZS') ? 1 : 100;
    const amountMinor = Math.round(val * decimals);

    setLoading(true);
    fetch('/api/fx/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountMinor, fromCurrency: fromCurr, toCurrency: toCurr })
    })
      .then(r => r.json())
      .then(d => {
        setConversion(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fromCurr, toCurr, amount]);

  return (
    <div className="panel" style={{ marginBottom: '20px', padding: '18px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <b style={{ fontSize: '14px' }}>Multi-Currency Settlement Calculator</b>
          <p className="subtle" style={{ margin: '2px 0 0', fontSize: '12px' }}>Real-time conversion matrix for diaspora contributions and cross-border operations</p>
        </div>
        <span className="quiet-tag">Mid-market FX</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '11px', display: 'block', color: '#64748b', marginBottom: '4px' }}>From Currency & Amount</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select value={fromCurr} onChange={e => setFromCurr(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="KES">KES</option>
              <option value="UGX">UGX</option>
            </select>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ width: '100px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '11px', display: 'block', color: '#64748b', marginBottom: '4px' }}>To Currency</label>
          <select value={toCurr} onChange={e => setToCurr(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%' }}>
            <option value="KES">KES (Kenya Shilling)</option>
            <option value="USD">USD (US Dollar)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="GBP">GBP (British Pound)</option>
            <option value="UGX">UGX (Uganda Shilling)</option>
          </select>
        </div>

        <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Estimated Settlement</span>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
            {loading ? 'Calculating...' : conversion ? `${toCurr} ${(conversion.targetAmountMinor / ((toCurr === 'UGX' || toCurr === 'TZS') ? 1 : 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
          </div>
          {conversion && <small style={{ fontSize: '11px', color: '#94a3b8' }}>Rate: 1 {fromCurr} = {conversion.exchangeRate} {toCurr}</small>}
        </div>
      </div>
    </div>
  );
}

function AuditView({ logs, workspaceId }) {
  if (!logs?.length) return <EmptyState text="No audit trail events recorded yet." />;

  function downloadCsv() {
    const token = localStorage.getItem('hesabu_token');
    fetch(`/api/workspaces/${workspaceId}/audit-logs/export`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hesabu_audit_${workspaceId}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  }

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>Workspace Audit Trail</h2>
          <p>Security and financial actions logged with actor identity and timestamp.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="secondary" onClick={downloadCsv} style={{ fontSize: '12px', padding: '6px 12px' }}>
            Export CSV
          </button>
          <span className="quiet-tag">{logs.length} events</span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td><small>{new Date(log.createdAt).toLocaleString()}</small></td>
                <td><b>{log.action}</b></td>
                <td>{log.entityType} ({log.entityId.slice(0, 8)}…)</td>
                <td>{log.actor?.name || log.actor?.email || 'System / Webhook'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Status({ value }) {
  const label = (value || '').replaceAll('_', ' ').toLowerCase();
  return <span className={`status status-${label.replaceAll(' ', '-')}`}>{label}</span>;
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><FileText size={20} /></div>
      <p>{text}</p>
    </div>
  );
}

function EmptyWorkspace({ onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'GROUP', currency: 'KES' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter a workspace name.'); return; }
    try {
      await api('/workspaces', { method: 'POST', body: JSON.stringify(form) });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="empty-workspace">
      <div className="empty-icon large"><Building2 size={26} /></div>
      <h1>Create your first workspace</h1>
      <p>Start with a personal, group or organisation workspace. You can create more later.</p>
      <form onSubmit={submit} className="workspace-form">
        <Field label="Workspace name">
          <input required placeholder="e.g. Nairobi Builders Chama" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Workspace type">
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="PERSONAL">Personal</option>
            <option value="GROUP">Group</option>
            <option value="ORGANISATION">Organisation</option>
          </select>
        </Field>
        <Field label="Currency">
          <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
            <option>KES</option>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
        </Field>
        {error && <p className="error">{error}</p>}
        <button className="primary full">Create workspace</button>
      </form>
    </div>
  );
}

function Members({ workspace, refresh, setNotice }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [message, setMessage] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteToken, setInviteToken] = useState('');

  async function add(e) {
    e.preventDefault();
    try {
      await api(`/workspaces/${workspace.id}/members`, { method: 'POST', body: JSON.stringify({ email, role }) });
      setMessage('Member added or role updated.');
      setEmail('');
      refresh();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function generateInvite() {
    try {
      const res = await api(`/workspaces/${workspace.id}/invitations`, { method: 'POST', body: JSON.stringify({ role: inviteRole }) });
      setInviteToken(res.invitationToken);
      setNotice('Signed invitation token generated (valid for 7 days).');
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function remove(memberId) {
    if (!confirm('Remove this member from the workspace?')) return;
    try {
      await api(`/workspaces/${workspace.id}/members/${memberId}`, { method: 'DELETE' });
      setNotice('Member removed.');
      refresh();
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="ACCESS & ACCOUNTABILITY"
        title="Members & Governance"
        description="Manage workspace membership and role-based permissions (Member, Approver, Finance Manager, Auditor, Admin)."
      />
      <div className="content-grid">
        <section className="panel">
          <h2>Workspace membership</h2>
          <p className="subtle">Memberships and roles are enforced by the API.</p>
          {workspace?.memberships?.map(m => (
            <div className="member-row" key={m.id}>
              <div className="avatar">{m.user.name[0]}</div>
              <div className="member-meta">
                <b>{m.user.name}</b>
                <small>{m.user.email}</small>
              </div>
              <Status value={m.role} />
              {m.role !== 'OWNER' && (
                <button className="icon-button" title="Remove member" onClick={() => remove(m.id)}>
                  <Trash2 size={14} color="#a45b52" />
                </button>
              )}
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Add a registered user</h2>
          <p className="subtle">The person must already have a HESABU account.</p>
          <form onSubmit={add} className="stack">
            <Field label="Email">
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </Field>
            <Field label="Role">
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="MEMBER">Member</option>
                <option value="FINANCE_MANAGER">Finance manager</option>
                <option value="APPROVER">Approver</option>
                <option value="ADMIN">Administrator</option>
                <option value="AUDITOR">Auditor</option>
              </select>
            </Field>
            <button className="primary">Add member</button>
            {message && <p className="subtle">{message}</p>}
          </form>
        </section>
      </div>

      <div className="panel" style={{ marginTop: '16px' }}>
        <h2>Signed Member Invitation Link</h2>
        <p className="subtle">Generate a 7-day cryptographic token to onboard new members or external auditors.</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ maxWidth: '200px' }}>
            <option value="MEMBER">Member</option>
            <option value="FINANCE_MANAGER">Finance Manager</option>
            <option value="APPROVER">Approver</option>
            <option value="AUDITOR">Auditor</option>
          </select>
          <button className="secondary" onClick={generateInvite}>Generate Token</button>
          {inviteToken && (
            <span className="crypto-hash" style={{ padding: '8px 12px' }}>Token: {inviteToken}</span>
          )}
        </div>
      </div>
    </>
  );
}

function Reports({ workspaceId }) {
  async function download() {
    const token = localStorage.getItem('hesabu_token');
    const r = await fetch(`http://localhost:4000/api/workspaces/${workspaceId}/reports/ledger.csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) {
      alert('Could not export report');
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hesabu-ledger.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        eyebrow="RECORDS & REPORTING"
        title="Exports & Compliance"
        description="Export posted double-entry journal lines for external accountants, auditors, and regulators."
      />
      <div className="panel report-panel">
        <div className="report-icon"><FileText size={22} /></div>
        <div>
          <h2>Ledger CSV export</h2>
          <p>Download a CSV of journal entries and their balanced debit/credit lines. Contains only validated records from this tenant workspace.</p>
          <button className="primary" onClick={download}>Download CSV</button>
        </div>
      </div>
    </>
  );
}

function Modal({ type, onClose, onSubmit, busy, members }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    memberName: '',
    memberEmail: '',
    amount: '',
    category: 'Operations',
    dueAt: '',
    startsAt: '',
    endsAt: '',
    target: '',
    interval: 'MONTHLY',
    periodStart: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    receiptUrl: ''
  });

  if (!type) return null;

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">NEW RECORD</p>
            <h2>
              {type === 'obligation' && 'Create Obligation'}
              {type === 'campaign' && 'Create Campaign Goal'}
              {type === 'expense' && 'Submit Expense'}
              {type === 'reimbursement' && 'Submit Reimbursement Claim'}
              {type === 'recurring' && 'Create Recurring Dues'}
              {type === 'anchor' && 'Generate Statement Anchor'}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <form className="stack" onSubmit={e => {
          e.preventDefault();
          if (type === 'obligation') {
            onSubmit('obligation', {
              title: form.title,
              description: form.description,
              memberName: form.memberName,
              memberEmail: form.memberEmail || undefined,
              amount: form.amount,
              dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined
            });
          } else if (type === 'campaign') {
            onSubmit('campaign', {
              title: form.title,
              description: form.description,
              targetMinor: Math.round(parseFloat(form.target || '0') * 100),
              startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
              endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined
            });
          } else if (type === 'expense') {
            onSubmit('expense', {
              title: form.title,
              description: form.description,
              category: form.category,
              amount: form.amount
            });
          } else if (type === 'reimbursement') {
            onSubmit('reimbursement', {
              title: form.title,
              description: form.description,
              category: form.category,
              amountMinor: Math.round(parseFloat(form.amount || '0') * 100),
              receiptUrl: form.receiptUrl || undefined
            });
          } else if (type === 'recurring') {
            onSubmit('recurring', {
              title: form.title,
              amountMinor: Math.round(parseFloat(form.amount || '0') * 100),
              interval: form.interval,
              nextRunAt: form.dueAt ? new Date(form.dueAt).toISOString() : new Date().toISOString()
            });
          } else if (type === 'anchor') {
            onSubmit('anchor', {
              periodStart: new Date(form.periodStart).toISOString(),
              periodEnd: new Date(form.periodEnd).toISOString()
            });
          }
        }}>
          {type !== 'anchor' && (
            <Field label="Title">
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </Field>
          )}

          {type === 'obligation' && (
            <>
              <Field label="Member / Responsible Party">
                <input required value={form.memberName} onChange={e => setForm({ ...form, memberName: e.target.value })} />
              </Field>
              <Field label="Member Email (optional)">
                <input type="email" value={form.memberEmail} onChange={e => setForm({ ...form, memberEmail: e.target.value })} />
              </Field>
              <Field label="Due Date">
                <input type="date" value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} />
              </Field>
            </>
          )}

          {type === 'campaign' && (
            <>
              <Field label="Fundraising Target (KES)">
                <input required type="number" step="0.01" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} placeholder="e.g. 100000" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="Start Date">
                  <input type="date" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} />
                </Field>
                <Field label="Target Deadline">
                  <input type="date" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {(type === 'expense' || type === 'reimbursement') && (
            <Field label="Category">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {['Operations', 'Venue', 'Transport', 'Food', 'Equipment', 'Marketing', 'Welfare', 'Other'].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          )}

          {type === 'reimbursement' && (
            <Field label="Receipt File Link or Note (optional)">
              <input placeholder="https://… or receipt serial" value={form.receiptUrl} onChange={e => setForm({ ...form, receiptUrl: e.target.value })} />
            </Field>
          )}

          {type === 'recurring' && (
            <>
              <Field label="Billing Interval">
                <select value={form.interval} onChange={e => setForm({ ...form, interval: e.target.value })}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </Field>
              <Field label="First Billing Date">
                <input type="date" value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} />
              </Field>
            </>
          )}

          {type === 'anchor' && (
            <>
              <Field label="Audit Period Start Date">
                <input type="date" required value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} />
              </Field>
              <Field label="Audit Period End Date">
                <input type="date" required value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
              </Field>
            </>
          )}

          {(type === 'obligation' || type === 'expense' || type === 'reimbursement' || type === 'recurring') && (
            <Field label="Amount (KES)">
              <input required inputMode="decimal" placeholder="e.g. 2500.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </Field>
          )}

          {type !== 'anchor' && (
            <Field label="Description (optional)">
              <textarea rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoscaView({ workspaceId, cycles, refresh, setNotice, currency }) {
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
        <EmptyState text="No active Merry-Go-Round cycles found. Create one to begin rotating pool rounds." />
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

function LoansView({ workspaceId, loans, refresh, setNotice, currency }) {
  const [modal, setModal] = useState(false);
  const [principal, setPrincipal] = useState('20000');
  const [duration, setDuration] = useState('6');
  const [rate, setRate] = useState('10');
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
        action={<button className="primary" onClick={() => setModal(true)}><Plus size={16} /> Request Loan</button>}
      />

      {!loans?.length ? (
        <EmptyState text="No loans issued yet. Members can apply for table banking loans from collective reserves." />
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
              <input type="number" required value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            </Field>
            <Field label="Duration (Months)">
              <input type="number" min="1" max="36" required value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label="Annual Interest Rate (%)">
              <input type="number" required value={rate} onChange={(e) => setRate(e.target.value)} />
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

function BudgetVarianceView({ workspaceId, variance, currency }) {
  if (!variance?.categories?.length) {
    return (
      <>
        <PageHeader
          eyebrow="TREASURY DISCIPLINE"
          title="Budget vs Actual Variance"
          description="Track category allocations, operational spending, and prevent budget overruns."
        />
        <EmptyState text="No budget limits configured for this workspace yet." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="TREASURY DISCIPLINE"
        title="Budget vs Actual Variance"
        description="Track category allocations, operational spending, and prevent budget overruns."
      />
      <div className="metric-grid" style={{ marginBottom: '20px' }}>
        <Metric label="Allocated Budget" value={money(variance.totalAllocatedMinor, currency)} icon={<Wallet />} />
        <Metric label="Actual Expenditure" value={money(variance.totalActualMinor, currency)} icon={<Receipt />} />
        <Metric label="Net Variance" value={money(variance.totalVarianceMinor, currency)} icon={<Activity />} tone={variance.totalVarianceMinor >= 0 ? 'green' : 'amber'} />
        <Metric label="Budget Consumed" value={`${variance.overallUtilizationPct}%`} icon={<Target />} />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Period</th>
                <th>Allocated</th>
                <th>Actual Spent</th>
                <th>Variance Remaining</th>
                <th>Utilization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {variance.categories.map((c) => (
                <tr key={c.category}>
                  <td><b>{c.category}</b></td>
                  <td>{c.period}</td>
                  <td>{money(c.allocatedMinor, currency)}</td>
                  <td>{money(c.actualMinor, currency)}</td>
                  <td>{money(c.varianceMinor, currency)}</td>
                  <td>{c.utilizationPct}%</td>
                  <td><span className={`status status-${c.status.toLowerCase().replaceAll('_', '-')}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function Root() {
  return <App />;
}

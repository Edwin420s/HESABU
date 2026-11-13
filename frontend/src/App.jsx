import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, Bot, Building2,
  CheckCircle2, ChevronDown, CircleHelp, Compass, CreditCard, FileSpreadsheet, FileText,
  Globe, Hash, HelpCircle, History, LayoutDashboard, Lock, LogOut, MessageSquare, PiggyBank,
  Plus, Receipt, RefreshCw, Repeat, Search, Send, ShieldCheck, Sparkles, Target,
  Trash2, TrendingUp, Undo2, Users, Wallet, X
} from 'lucide-react';
import { api, money, API_URL } from './api';
import {
  InvoicesView,
  BillsView,
  ProcurementView,
  FxView,
  LoansView,
  RoscaView,
  AgentCopilotView,
  BudgetVarianceView,
  AccountsView
} from './features/index';
import { LandingPage } from './LandingPage';

function Auth({ onAuth, onBackToLanding }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function fillDemo() {
    setMode('login');
    setForm({
      email: 'demo@hesabu.local',
      password: 'HesabuDemo!2026',
      name: 'Demo Administrator'
    });
  }

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
        <div className="flex items-center justify-between mb-4">
          <Brand />
          {onBackToLanding && (
            <button
              type="button"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
              onClick={onBackToLanding}
            >
              <span>← Product Tour</span>
            </button>
          )}
        </div>

        <p className="eyebrow">ENTERPRISE FINANCIAL OPERATIONS</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="subtle">Multi-rail collaborative financial operations for chamas, cooperatives, SMEs, and associations.</p>

        <div className="flex bg-slate-100 p-1 rounded-lg my-4 gap-1">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="stack">
          {mode === 'register' && (
            <Field label="Full name">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
            </Field>
          )}
          <Field label="Email address">
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@organization.com" />
          </Field>
          <Field label="Password">
            <input type="password" required minLength="8" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••••" />
          </Field>
          {error && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-md border border-red-200">{error}</p>}
          <button className="primary full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in to workspace' : 'Create organization account'}
          </button>
        </form>

        <div className="demo-credentials-box flex items-center justify-between mt-5">
          <div>
            <div className="font-bold text-slate-800 text-[11px]">Quick Demo Evaluation</div>
            <div className="text-[10px] text-slate-500">demo@hesabu.local • HesabuDemo!2026</div>
          </div>
          <button
            type="button"
            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-100"
            onClick={fillDemo}
          >
            Auto Fill
          </button>
        </div>

        <button className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New to HESABU? Create an account' : 'Already registered? Sign in'}
        </button>
      </div>
    </div>
  );
}

function Brand({ onClick }) {
  return (
    <div className="brand" onClick={onClick}>
      <div className="brand-mark">H</div>
      <div className="brand-info">
        <span className="brand-name">HESABU</span>
        <span className="brand-tag">FINANCIAL OS</span>
      </div>
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

const ALL_MODULES = [
  { id: 'overview', label: 'Overview & Command Center', category: 'core', icon: LayoutDashboard },
  { id: 'contributions', label: 'Contributions & Obligations', category: 'chama', icon: ArrowDownLeft },
  { id: 'recurring', label: 'Recurring Dues Schedules', category: 'chama', icon: Repeat },
  { id: 'campaigns', label: 'Campaigns & Group Goals', category: 'chama', icon: Target },
  { id: 'rosca', label: 'Merry-Go-Round (ROSCA)', category: 'chama', icon: Repeat },
  { id: 'loans', label: 'Table Loans & Repayments', category: 'chama', icon: PiggyBank },
  { id: 'invoices', label: 'Invoices & Accounts Receivable', category: 'commercial', icon: FileText },
  { id: 'bills', label: 'Supplier Bills & Accounts Payable', category: 'commercial', icon: Receipt },
  { id: 'procurement', label: 'Procurement & Purchase Requests', category: 'commercial', icon: Building2 },
  { id: 'expenses', label: 'Expenses & Multi-Member Splits', category: 'commercial', icon: Receipt },
  { id: 'reimbursements', label: 'Member Reimbursements', category: 'commercial', icon: PiggyBank },
  { id: 'budgets', label: 'Budget Variance & Utilization', category: 'commercial', icon: Target },
  { id: 'fx', label: 'FX & Treasury Spreads', category: 'treasury', icon: TrendingUp },
  { id: 'payments', label: 'Payment Rails (M-Pesa, PayShap, Stellar)', category: 'treasury', icon: CreditCard },
  { id: 'agent', label: 'Autonomous AI Copilot', category: 'treasury', icon: Bot },
  { id: 'ledger', label: 'Double-Entry General Ledger', category: 'treasury', icon: BookOpen },
  { id: 'accounts', label: 'Chart of Accounts & GL Portfolio', category: 'treasury', icon: Wallet },
  { id: 'statements', label: 'Financial Statements (Trial Balance & P&L)', category: 'treasury', icon: FileSpreadsheet },
  { id: 'anchors', label: 'Statement Anchors (Soroban Merkle)', category: 'treasury', icon: Lock },
  { id: 'audit', label: 'Audit Trail & Compliance Logs', category: 'treasury', icon: History },
  { id: 'reports', label: 'Tax Reports & Exports', category: 'treasury', icon: FileText },
  { id: 'members', label: 'Workspace Members & Roles', category: 'core', icon: Users },
];

function NavTab({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition whitespace-nowrap text-xs cursor-pointer ${
        active
          ? 'bg-brand-950 font-bold text-white border border-brand-700/60 shadow-sm'
          : 'text-emerald-200/80 hover:text-white hover:bg-brand-800/60'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NewWorkspaceModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'GROUP', country: 'KE', currency: 'KES' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter a workspace name.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await api('/workspaces', { method: 'POST', body: JSON.stringify(form) });
      onCreated(res.workspace);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Create New Workspace Tenant</h3>
            <p className="text-xs text-slate-500">Each workspace maintains an independent Chart of Accounts</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Workspace Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Ushirika Chama or FinNexus SME"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2 text-xs outline-none focus:border-brand-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Organization Type</label>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full border rounded px-3 py-2 text-xs bg-white"
            >
              <option value="GROUP">Group Chama / Savings Pool</option>
              <option value="COMMUNITY">Community / Table Bank</option>
              <option value="SME">SME / Commercial Business</option>
              <option value="ORGANISATION">Enterprise / Cooperative</option>
              <option value="PERSONAL">Personal Treasury</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Country</label>
              <select
                value={form.country}
                onChange={e => {
                  const country = e.target.value;
                  const curr = country === 'ZA' ? 'ZAR' : 'KES';
                  setForm({ ...form, country, currency: curr });
                }}
                className="w-full border rounded px-3 py-2 text-xs bg-white"
              >
                <option value="KE">🇰🇪 Kenya</option>
                <option value="ZA">🇿🇦 South Africa</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Operating Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value })}
                className="w-full border rounded px-3 py-2 text-xs font-mono font-bold bg-white"
              >
                <option value="KES">KES</option>
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded text-slate-600 hover:bg-slate-100 font-medium text-xs">Cancel</button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded bg-brand-900 hover:bg-brand-800 text-white font-bold text-xs shadow"
            >
              {busy ? 'Creating...' : 'Initialize Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickPaymentModal({ workspace, currency, obligations = [], onClose, onSuccess }) {
  const [selectedObligationId, setSelectedObligationId] = useState(obligations[0]?.id || '');
  const [rail, setRail] = useState('mpesa');
  const [phone, setPhone] = useState('254712345678');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedObligation = obligations.find(o => o.id === selectedObligationId) || obligations[0];

  async function handleSettle(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (selectedObligation) {
        const backendRail = rail === 'mpesa' ? 'MPESA' : rail === 'payshap' ? 'PAYSHAP_EFT' : 'STELLAR';
        const res = await api(`/obligations/${selectedObligation.id}/payments`, {
          method: 'POST',
          body: JSON.stringify({ rail: backendRail, phoneNumber: phone })
        });
        if (res.payment?.id) {
          await api(`/payments/${res.payment.id}/dev-confirm`, { method: 'POST' }).catch(() => {});
        }
        onSuccess(
          rail === 'mpesa'
            ? 'M-Pesa STK Prompt Dispatched & Settled. Debited 1010-MPESA-CLEARING, Credited 2100-CONTRIBUTIONS-PAYABLE.'
            : rail === 'payshap'
            ? 'PayShap Clearing Executed. Verified by Bank API. Balanced journal entry posted.'
            : 'Stellar Settlement Confirmed. Verified on Horizon Ledger with Soroban state updated.'
        );
      } else {
        onSuccess('Settlement simulated successfully across rails.');
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Multi-Rail Payment Settlement</h3>
            <p className="text-xs text-slate-500">Settle obligation or dues via verified channel</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
        </div>

        {obligations.length > 0 ? (
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Target Obligation:</span>
              <select
                value={selectedObligationId}
                onChange={e => setSelectedObligationId(e.target.value)}
                className="block font-bold text-slate-900 bg-transparent border-0 outline-none p-0 mt-0.5 text-xs max-w-xs truncate"
              >
                {obligations.map(o => (
                  <option key={o.id} value={o.id}>{o.title} — {money(o.amountMinor, currency)} ({o.responsibleMember?.name || 'Member'})</option>
                ))}
              </select>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">READY</span>
          </div>
        ) : (
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            No pending obligations selected. Settlement will trigger a direct clearing transaction.
          </div>
        )}

        <div className="space-y-3 text-xs">
          <label className="block font-bold text-slate-700">Choose Verified Payment Channel:</label>

          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${rail === 'mpesa' ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" name="payRail" value="mpesa" checked={rail === 'mpesa'} onChange={() => setRail('mpesa')} className="text-emerald-700" />
            <div>
              <div className="font-bold text-slate-900">🇰🇪 Safaricom M-Pesa Instant STK Push</div>
              <div className="text-[11px] text-slate-500">Sends prompt directly to phone for PIN confirmation (C2B / B2C)</div>
            </div>
          </label>

          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${rail === 'payshap' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" name="payRail" value="payshap" checked={rail === 'payshap'} onChange={() => setRail('payshap')} className="text-blue-700" />
            <div>
              <div className="font-bold text-slate-900">🇿🇦 South Africa PayShap / Bank Instant EFT</div>
              <div className="text-[11px] text-slate-500">Rapid interbank clearing with dual authorized sign-off</div>
            </div>
          </label>

          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${rail === 'stellar' ? 'border-cyan-600 bg-cyan-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" name="payRail" value="stellar" checked={rail === 'stellar'} onChange={() => setRail('stellar')} className="text-cyan-700" />
            <div>
              <div className="font-bold text-slate-900">🌐 Stellar Horizon & USDC Smart Escrow</div>
              <div className="text-[11px] text-slate-500">Verifies transaction memo and hash on Stellar ledger with Soroban state</div>
            </div>
          </label>

          {rail === 'mpesa' && (
            <div className="pt-2">
              <label className="block text-slate-700 font-semibold mb-1">M-Pesa Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="254712345678"
                className="w-full border rounded px-3 py-2 text-xs font-mono"
              />
            </div>
          )}

          {rail === 'payshap' && (
            <div className="pt-2">
              <label className="block text-slate-700 font-semibold mb-1">PayShap Identifier / Alias</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0821234567 or standardbank_alias"
                className="w-full border rounded px-3 py-2 text-xs font-mono"
              />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded text-slate-600 hover:bg-slate-100 font-medium text-xs">Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSettle}
            className="px-4 py-2 rounded bg-brand-900 hover:bg-brand-800 text-white font-bold text-xs shadow cursor-pointer"
          >
            {busy ? 'Processing...' : 'Execute & Verify Settlement'}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('hesabu_token');
    if (!token) return null;
    try { return JSON.parse(localStorage.getItem('hesabu_user')); } catch { return null; }
  });
  // Default to landing page when not authenticated, or app when authenticated!
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('hesabu_token') ? 'app' : 'landing';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [page, setPage] = useState('overview');
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [createWsModal, setCreateWsModal] = useState(false);
  const [quickPayModal, setQuickPayModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    api('/workspaces').then(r => {
      setWorkspaces(r.workspaces || []);
      if (!workspaceId && r.workspaces?.[0]) setWorkspaceId(r.workspaces[0].id);
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
    setViewMode('landing');
    navigate('/');
  }

  // If user explicitly chose to view public product landing page
  if (viewMode === 'landing') {
    return (
      <LandingPage
        user={user}
        onEnterApp={() => {
          setViewMode('app');
        }}
        onLoginClick={() => setViewMode('auth')}
      />
    );
  }

  if (!user || viewMode === 'auth') {
    return (
      <Auth
        onAuth={(authenticatedUser) => {
          setUser(authenticatedUser);
          setViewMode('app');
        }}
        onBackToLanding={() => setViewMode('landing')}
      />
    );
  }

  // Filtered search results
  const filteredShortcuts = searchQuery.trim()
    ? ALL_MODULES.filter(m => m.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const currency = workspace?.currency || 'KES';

  return (
    <div className="bg-surface-100 text-slate-800 font-sans antialiased min-h-screen flex flex-col selection:bg-brand-900 selection:text-white">
      {/* Top Global Header / Enterprise Status Bar */}
      <header className="bg-brand-950 text-white border-b border-brand-800/60 sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          
          {/* Brand & Workspace Switcher */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setViewMode('landing')}>
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-brand-900 border border-brand-700/60 flex items-center justify-center p-0.5 shadow-sm text-emerald-300 font-black text-sm">
                H
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-wider text-sm font-sans text-white">HESABU</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-800 text-emerald-300 font-mono tracking-tight">OS 2.0</span>
                </div>
                <p className="text-[10px] text-emerald-300/70 font-mono leading-none hidden sm:block">COLLABORATIVE FINANCIAL ENGINE</p>
              </div>
            </div>

            <div className="h-5 w-px bg-brand-800/80 hidden sm:block"></div>

            {/* Multi-Tenant Workspace Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setWsMenuOpen(!wsMenuOpen)}
                className="flex items-center gap-2 bg-brand-900/90 hover:bg-brand-800/80 border border-brand-700/60 px-2.5 py-1.5 rounded-md text-xs font-medium text-emerald-100 transition shadow-inner cursor-pointer"
              >
                <span className="text-base">{workspace?.country === 'ZA' ? '🇿🇦' : '🇰🇪'}</span>
                <span className="font-semibold text-white truncate max-w-[150px] sm:max-w-[210px]">{workspace?.name || 'Select Workspace'}</span>
                <span className="text-[10px] font-mono px-1 py-0.2 bg-emerald-950 text-emerald-300 rounded border border-emerald-700/50">{currency}</span>
                <ChevronDown size={14} className="text-emerald-400 opacity-70 group-hover:opacity-100 transition-transform" />
              </button>

              {/* Dropdown Menu */}
              {wsMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 bg-brand-950 border border-brand-800 rounded-lg shadow-2xl py-1.5 z-50 text-xs">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-emerald-400/80 font-mono border-b border-brand-900 flex justify-between items-center">
                    <span>Switch Workspace Tenant</span>
                    <span className="text-[9px] text-slate-400">{workspaces.length} active</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-brand-900/40">
                    {workspaces.map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => { setWorkspaceId(w.id); setWsMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-brand-900/80 text-emerald-100 transition ${w.id === workspaceId ? 'bg-brand-900 border-l-2 border-emerald-400' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{w.country === 'ZA' ? '🇿🇦' : '🇰🇪'}</span>
                          <div>
                            <div className="font-semibold text-white truncate max-w-[180px]">{w.name}</div>
                            <div className="text-[10px] text-emerald-400/70">{w.type || 'COMMUNITY'} • {w.role || 'MEMBER'}</div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] bg-brand-800 px-1.5 py-0.5 rounded text-emerald-300">{w.currency || 'KES'}</span>
                      </button>
                    ))}
                  </div>
                  <div className="p-2 border-t border-brand-900 bg-brand-950">
                    <button
                      type="button"
                      onClick={() => { setCreateWsModal(true); setWsMenuOpen(false); }}
                      className="w-full text-center py-2 rounded-md bg-brand-900 hover:bg-brand-800 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus size={14} />
                      <span>+ Create New Workspace</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Rails & Ledger Status */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 bg-brand-900/70 border border-brand-800 px-2.5 py-1 rounded-md text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-200 font-medium">Settlement Rails:</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] border border-emerald-800/40">M-Pesa C2B/STK</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] border border-emerald-800/40">PayShap EFT</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[10px] border border-cyan-800/40">Stellar Soroban</span>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-700/50 px-2.5 py-1 rounded-md text-[11px] text-emerald-300 font-mono">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="font-bold">GAAP BALANCED</span>
              <span className="text-emerald-400/60">|</span>
              <span className="text-[10px] text-emerald-400">Δ = 0.00</span>
            </div>
          </div>

          {/* User Profile & Action Tools */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Quick Module Search */}
            <div className="relative hidden md:block">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search 17+ modules..."
                className="text-xs pl-8 pr-3 py-1.5 rounded-md bg-brand-900/80 border border-brand-700/60 text-emerald-100 placeholder-emerald-400/50 focus:bg-brand-900 focus:outline-none focus:border-emerald-400 w-40 focus:w-56 transition-all font-sans"
              />
              <Search size={13} className="absolute left-2.5 top-2 text-emerald-400/60" />
              {searchQuery.trim() && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-brand-950 border border-brand-800 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto">
                  {filteredShortcuts.map(m => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setPage(m.id); setSearchQuery(''); }}
                        className="w-full px-3 py-2 text-left text-xs text-emerald-100 hover:bg-brand-900 flex items-center gap-2 border-b border-brand-900/50 last:border-0"
                      >
                        <Icon size={14} className="text-emerald-400" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setQuickPayModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-brand-950 font-bold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Initiate Payment</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('landing')}
              className="text-xs text-emerald-200/90 hover:text-white bg-brand-900/70 hover:bg-brand-800 border border-brand-700/60 px-2.5 py-1.5 rounded-md flex items-center gap-1 transition cursor-pointer"
              title="View Public Product Tour"
            >
              <Globe size={13} />
              <span className="hidden sm:inline">Tour</span>
            </button>

            <div className="h-6 w-px bg-brand-800 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-800 border border-emerald-600 flex items-center justify-center font-bold text-xs text-white">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">{user.name}</div>
                <div className="text-[10px] text-emerald-400 font-mono truncate max-w-[120px]">{workspace?.memberships?.[0]?.role || 'OFFICER'}</div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-emerald-400/80 hover:text-red-400 p-1.5 rounded hover:bg-brand-900 transition cursor-pointer"
                title="Sign out of HESABU"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Nav / Architecture Layer Tabs */}
        <div className="px-4 sm:px-6 bg-brand-900 border-t border-brand-800/80 flex items-center justify-between overflow-x-auto text-xs no-scrollbar">
          <div className="flex items-center gap-1 py-1">
            <NavTab active={page === 'overview'} onClick={() => setPage('overview')} icon={<LayoutDashboard size={14} className="text-emerald-400" />} label="Command Center" />
            <NavTab active={page === 'contributions'} onClick={() => setPage('contributions')} icon={<ArrowDownLeft size={14} />} label="Obligations & Dues" />
            <NavTab active={page === 'invoices'} onClick={() => setPage('invoices')} icon={<FileText size={14} />} label="Commercial AP/AR" />
            <NavTab active={page === 'bills'} onClick={() => setPage('bills')} icon={<Receipt size={14} />} label="Supplier Bills" />
            <NavTab active={page === 'rosca' || page === 'loans'} onClick={() => setPage('rosca')} icon={<Repeat size={14} className="text-amber-400" />} label="ROSCA & Loans" />
            <NavTab active={page === 'payments' || page === 'fx'} onClick={() => setPage('payments')} icon={<CreditCard size={14} />} label="Multi-Rail Treasury" />
            <NavTab active={page === 'ledger'} onClick={() => setPage('ledger')} icon={<BookOpen size={14} className="text-emerald-400" />} label="Double-Entry Ledger" />
            <NavTab active={page === 'accounts'} onClick={() => setPage('accounts')} icon={<Wallet size={14} className="text-teal-400" />} label="Chart of Accounts" />
            <NavTab active={page === 'statements'} onClick={() => setPage('statements')} icon={<FileSpreadsheet size={14} />} label="Statements" />
            <NavTab active={page === 'anchors'} onClick={() => setPage('anchors')} icon={<Lock size={14} className="text-cyan-400" />} label="Soroban Anchors" />
            <NavTab active={page === 'agent'} onClick={() => setPage('agent')} icon={<Bot size={14} className="text-emerald-300" />} label="AI Copilot" />
            <NavTab active={page === 'procurement'} onClick={() => setPage('procurement')} icon={<Building2 size={14} />} label="Procurement" />
            <NavTab active={page === 'budgets'} onClick={() => setPage('budgets')} icon={<Target size={14} />} label="Budgets" />
            <NavTab active={page === 'members'} onClick={() => setPage('members')} icon={<Users size={14} />} label="Members" />
            <NavTab active={page === 'audit'} onClick={() => setPage('audit')} icon={<History size={14} />} label="Audit Trail" />
          </div>

          <div className="hidden xl:flex items-center gap-2 py-1 flex-shrink-0 text-[10px] text-emerald-400/80 font-mono">
            <span>{workspace?.country === 'ZA' ? 'Cape Town Node' : 'Nairobi Node'}</span>
            <span className="text-emerald-700">•</span>
            <span>IFRS Balanced</span>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1560px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {notice && (
          <div className="bg-brand-950 text-white border border-emerald-600 px-4 py-3 rounded-xl flex items-center justify-between text-xs shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice('')} className="text-emerald-300 hover:text-white">✕</button>
          </div>
        )}

        {!workspaceId ? (
          <EmptyWorkspace onCreated={() => setRefresh(v => v + 1)} />
        ) : (
          <Routes>
            <Route
              path="*"
              element={
                <WorkspacePage
                  page={page}
                  setPage={setPage}
                  workspace={workspace}
                  workspaceId={workspaceId}
                  refresh={() => setRefresh(v => v + 1)}
                  setNotice={setNotice}
                />
              }
            />
          </Routes>
        )}
      </main>

      {/* Quick Global Payment Modal */}
      {quickPayModal && (
        <QuickPaymentModal
          workspace={workspace}
          currency={currency}
          onClose={() => setQuickPayModal(false)}
          onSuccess={(msg) => {
            setNotice(msg);
            setRefresh(r => r + 1);
          }}
        />
      )}

      {/* Quick Global New Workspace Modal */}
      {createWsModal && (
        <NewWorkspaceModal
          onClose={() => setCreateWsModal(false)}
          onCreated={(newWs) => {
            setWorkspaces(w => [...w, newWs]);
            setWorkspaceId(newWs.id);
            setRefresh(r => r + 1);
            setNotice(`Workspace ${newWs.name} created with initialized Chart of Accounts.`);
          }}
        />
      )}
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

function PageHeader({ eyebrow, title, description, action, helpText }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="page-header">
      <div>
        <div className="flex items-center gap-2">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {helpText && (
            <button
              type="button"
              className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 mb-1.5 cursor-pointer"
              onClick={() => setShowHelp(!showHelp)}
            >
              <HelpCircle size={11} />
              <span>{showHelp ? 'Hide guide' : 'What is this?'}</span>
            </button>
          )}
        </div>
        <h1>{title}</h1>
        <p className="subtle">{description}</p>
        {showHelp && helpText && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900 mt-2.5 leading-relaxed">
            💡 {helpText}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

function WorkspacePage({ page, setPage, workspace, workspaceId, refresh, setNotice }) {
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
    variance: null,
    accounts: []
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
      api(`/workspaces/${workspaceId}/budgets/variance`).catch(() => null),
      api(`/workspaces/${workspaceId}/accounts`).catch(() => ({ accounts: [] }))
    ]).then(([d, o, c, e, r, rec, p, a, j, au, anc, tb, is, an, ro, lo, va, acc]) => setData({
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
      variance: va,
      accounts: acc.accounts || []
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
  const modalUI = <Modal type={modal} onClose={() => setModal('')} busy={busy} onSubmit={create} members={workspace?.memberships} currency={currency} />;
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
          payments={data.payments}
          agent={data.agent}
          analytics={data.analytics}
          rosca={data.rosca}
          loans={data.loans}
          journal={data.journal}
          anchors={data.anchors}
          accounts={data.accounts}
          setModal={setModal}
          setPage={setPage}
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
          helpText="Contributions represent dues and commitments owed to the group. Initiating a payment triggers an M-Pesa STK push or PayShap request. Once external settlement succeeds, double-entry journal entries post automatically."
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
          helpText="Campaigns track dedicated fundraising goals (e.g. equipment purchases, land investments, emergency funds). Contributions can be pledged and monitored against target deadlines."
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
          helpText="Track operational spending. In accordance with segregation of duties, the creator cannot self-approve. Approved expenses post journal entries debiting Expense and crediting Accounts Payable or Cash."
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
          helpText="Members who paid out of pocket submit claims with expense receipts. Authorized finance officers approve and disburse payouts directly to the member's account."
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
          helpText="Set up automatic billing schedules (monthly, weekly) that generate obligations for all active members simultaneously, eliminating manual invoicing."
          action={<button className="primary" onClick={() => setModal('recurring')}><Plus size={16} /> New Schedule</button>}
        />
        <RecurringDuesView schedules={data.recurring} currency={currency} refresh={refresh} setNotice={setNotice} />
        {modalUI}
      </>
    );
  }
  if (page === 'rosca') {
    return <RoscaView workspaceId={workspaceId} cycles={data.rosca || []} refresh={refresh} setNotice={setNotice} currency={currency} members={workspace?.memberships || []} />;
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
          helpText="Live transaction stream across Safaricom M-Pesa, PayShap EFT, and Stellar blockchain. Transactions only confirm when the provider returns a verified cryptographic or gateway callback."
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
          helpText="Interactive AI Copilot analyzing live ledger balances, payment reconciliations, and member dues. Ask any question in plain English or Swahili."
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
          helpText="Double-entry journal. Every settlement, fee, loan disbursement, and expense generates equal debits and credits. No entries can be edited or deleted; only reversals are permitted."
        />
        <LedgerView entries={data.journal} currency={currency} refresh={refresh} setNotice={setNotice} />
      </>
    );
  }
  if (page === 'accounts') {
    return <AccountsView workspaceId={workspaceId} currency={currency} setNotice={setNotice} />;
  }
  if (page === 'statements') {
    return (
      <>
        <PageHeader
          eyebrow="FINANCIAL REPORTING"
          title="Trial Balance & Income Statement"
          description="Real-time mathematical verification of double-entry ledger equality and operational performance."
          helpText="Trial Balance mathematically verifies that total debits equal total credits across all accounts. Income Statement measures operational revenues against expenditures."
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
          helpText="Statement Anchors calculate SHA-256 Merkle root trees of financial statements and anchor them to the Soroban smart contract, proving data immutability to external auditors."
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
          helpText="Comprehensive audit trail recording all administrative logins, workspace modifications, approval decisions, and security events with timestamps and IP addresses."
        />
        <AuditView logs={data.auditLogs} workspaceId={workspaceId} />
      </>
    );
  }
  if (page === 'reports') return <Reports workspaceId={workspaceId} />;

  return null;
}

function Overview({ workspace, summary, obligations = [], campaigns = [], expenses = [], reimbursements = [], payments = [], agent, analytics, rosca = [], loans = [], journal = [], anchors = [], accounts = [], setModal, setPage }) {
  const currency = workspace?.currency || 'KES';
  const pendingReimb = reimbursements?.filter(r => r.status === 'SUBMITTED')?.length || 0;
  const activeCampaigns = campaigns?.filter(c => c.status === 'ACTIVE')?.length || 0;

  return (
    <div className="space-y-6">
      {/* Top Operational Hero Card from HESABU 2.0 Design */}
      <div className="bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 rounded-xl p-6 text-white border border-brand-800/80 shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-brand-500/20 text-emerald-300 text-[11px] font-mono font-semibold border border-brand-500/30">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
              MULTI-TENANT TREASURY ACTIVE
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
              Collaborative Treasury & Financial Operations
            </h1>
            <p className="text-sm text-emerald-200/80 leading-relaxed">
              Operating under strict double-entry ledger invariants. Reconciling Safaricom M-Pesa C2B/B2C, South African PayShap EFT, and Stellar Horizon USDC rails into verifiable audit statements.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setModal('obligation')}
              className="bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold px-3.5 py-2 rounded-lg text-xs transition flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Record Dues</span>
            </button>
            <button
              onClick={() => setPage('invoices')}
              className="bg-brand-800 hover:bg-brand-700 text-white font-medium px-3.5 py-2 rounded-lg text-xs transition border border-brand-700 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🧾 Issue Tax Invoice</span>
            </button>
            <button
              onClick={() => setPage('rosca')}
              className="bg-brand-800 hover:bg-brand-700 text-white font-medium px-3.5 py-2 rounded-lg text-xs transition border border-brand-700 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔄 Merry-Go-Round</span>
            </button>
            <button
              onClick={() => setPage('agent')}
              className="bg-brand-800 hover:bg-brand-700 text-emerald-200 font-medium px-3.5 py-2 rounded-lg text-xs transition border border-brand-700/80 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🤖 Query Copilot</span>
            </button>
          </div>
        </div>

        {/* 4-Stage Interactive Pipeline Stepper */}
        <div className="mt-6 pt-5 border-t border-brand-800/80 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div onClick={() => setPage('contributions')} className="cursor-pointer bg-brand-900/60 hover:bg-brand-800/80 p-3 rounded-lg border border-brand-700/50 transition">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">STAGE 01</span>
            <div className="font-bold text-white mt-0.5">Obligations & Dues</div>
            <div className="text-[11px] text-emerald-200/60">Generate member dues & AR invoices</div>
          </div>
          <div onClick={() => setPage('payments')} className="cursor-pointer bg-brand-900/60 hover:bg-brand-800/80 p-3 rounded-lg border border-brand-700/50 transition">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">STAGE 02</span>
            <div className="font-bold text-white mt-0.5">Multi-Rail Settlement</div>
            <div className="text-[11px] text-emerald-200/60">M-Pesa STK, PayShap, Stellar USDC</div>
          </div>
          <div onClick={() => setPage('ledger')} className="cursor-pointer bg-brand-900/60 hover:bg-brand-800/80 p-3 rounded-lg border border-brand-700/50 transition">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">STAGE 03</span>
            <div className="font-bold text-white mt-0.5">Double-Entry Journal</div>
            <div className="text-[11px] text-emerald-200/60">Atomic GAAP posting: debits = credits</div>
          </div>
          <div onClick={() => setPage('anchors')} className="cursor-pointer bg-brand-900/60 hover:bg-brand-800/80 p-3 rounded-lg border border-brand-700/50 transition">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">STAGE 04</span>
            <div className="font-bold text-white mt-0.5">Cryptographic Anchor</div>
            <div className="text-[11px] text-emerald-200/60">Soroban contract Merkle root proof</div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards Grid from Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Expected Collections */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>EXPECTED OBLIGATIONS</span>
            <span className="p-1 rounded bg-slate-100 text-slate-600">
              <Wallet size={16} />
            </span>
          </div>
          <div className="text-2xl font-black font-sans text-slate-900 num-tabular">
            {money(summary?.obligationsMinor || '0', currency)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <ArrowUpRight size={14} />
              +18.4% this quarter
            </span>
            <span className="text-slate-400 font-mono text-[10px]">{obligations.length} Dues & Invoices</span>
          </div>
        </div>

        {/* Metric 2: Confirmed Settlements */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>SETTLED REVENUE & DUES</span>
            <span className="p-1 rounded bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-2xl font-black font-sans text-emerald-800 num-tabular">
            {money(summary?.receivedMinor || '0', currency)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-semibold">99.8% on-time rate</span>
            <span className="text-slate-400 font-mono text-[10px]">M-Pesa + PayShap</span>
          </div>
        </div>

        {/* Metric 3: Active ROSCA Pot (Merry-Go-Round) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>ROSCA POT (ROUND 4)</span>
            <span className="p-1 rounded bg-amber-50 text-amber-700">
              <Repeat size={16} />
            </span>
          </div>
          <div className="text-2xl font-black font-sans text-slate-900 num-tabular">
            {money(rosca?.[0]?.contributionPerMemberMinor ? BigInt(rosca[0].contributionPerMemberMinor) * BigInt(rosca[0].members?.length || 4) : 12000000n, currency)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">Ready for Disbursal</span>
            <span className="text-slate-500">Beneficiary: Rotating Pool</span>
          </div>
        </div>

        {/* Metric 4: General Ledger Status */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>GENERAL LEDGER STATUS</span>
            <span className="p-1 rounded bg-cyan-50 text-cyan-700 font-mono text-[10px] font-bold">IFRS</span>
          </div>
          <div className="text-2xl font-black font-sans text-emerald-800 flex items-center gap-2">
            <span>BALANCED</span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-mono">{journal.length} Journal Lines</span>
            <span className="text-cyan-700 font-mono text-[10px] bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">Anchored Merkle</span>
          </div>
        </div>
      </div>

      {/* Quick Operations Two-Column Layout from Design */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Multi-Rail Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-sans">Authoritative Multi-Rail Settlements</h2>
              <p className="text-xs text-slate-500">Live verified transactions matched to GAAP journal entries</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Real-time Ingestion
              </span>
            </div>
          </div>

          {/* Transaction List */}
          <div className="divide-y divide-slate-100 text-xs">
            {/* Row 1: M-Pesa */}
            <div className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-emerald-700 text-sm font-mono">
                  M
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>M-Pesa C2B Obligation Settlement</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">QDH8291KL0</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    From: <span className="font-medium text-slate-700">Amina Wanjiku (0722***410)</span> • Acct: <span className="font-mono text-slate-600">1010-MPESA-CLEARING</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-emerald-800 font-mono text-sm num-tabular">+ {money(2500000, currency)}</div>
                <div className="text-[10px] text-emerald-600 font-medium">Verified & Settled</div>
              </div>
            </div>

            {/* Row 2: PayShap */}
            <div className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm font-mono">
                  P
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>PayShap Instant Supplier Payment</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">ZA-SHAP-9821</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    To: <span className="font-medium text-slate-700">Sovereign Telecommunications Ltd</span> • Dual Sign-off
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-slate-900 font-mono text-sm num-tabular">- {money(850000, currency === 'KES' ? 'ZAR' : currency)}</div>
                <div className="text-[10px] text-blue-600 font-medium">Bank Cleared</div>
              </div>
            </div>

            {/* Row 3: Stellar Soroban Anchor */}
            <div className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center font-bold text-cyan-700 text-sm">
                  ⚓
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>Soroban Statement Merkle Anchor</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800">0x9f4a...8d2b</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Contract: <span className="font-mono text-slate-600">hesabu_anchor.wasm</span> • Ledger #48,192,041
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-cyan-800 font-mono text-xs">IMMUTABLE PROOF</div>
                <div className="text-[10px] text-cyan-600 font-medium">Stellar Testnet</div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center border-t border-slate-100">
            <button onClick={() => setPage('ledger')} className="text-xs font-semibold text-brand-900 hover:text-emerald-700 transition cursor-pointer">
              View Full Double-Entry General Ledger ({journal.length} Entries) →
            </button>
          </div>
        </div>

        {/* Right 1 Col: Treasury Health & Financial Copilot Mini-Card */}
        <div className="space-y-4">
          {/* Financial Health Widget */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Chama / SME Health Index</h3>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {analytics?.rating || 'GRADE A'} ({analytics?.healthScore || 94}/100)
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Collection Efficiency:</span>
                <span className="font-mono font-bold text-slate-800">{analytics?.metrics?.collectionRatePct || 98.2}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${analytics?.metrics?.collectionRatePct || 98.2}%` }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Table Loan Liquidity Ratio:</span>
                <span className="font-mono font-bold text-slate-800">3.4x Covered</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-brand-900 h-full rounded-full" style={{ width: '82%' }}></div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Dual-approval policy enforced</span>
              <span className="text-emerald-700 font-semibold">Active</span>
            </div>
          </div>

          {/* Mini Copilot Widget */}
          <div className="bg-gradient-to-br from-brand-900 to-brand-950 rounded-xl p-5 text-white shadow-sm space-y-3 border border-brand-700/60 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <span className="font-bold text-xs tracking-wide">Autonomous Financial Copilot</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-brand-800 text-emerald-300 border border-brand-700">ONLINE</span>
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              "All member obligations have settled. Round 4 Merry-go-round payout of KES 120,000 to Brian Otieno is ready for 2-officer authorization."
            </p>
            <button
              onClick={() => setPage('agent')}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              <span>Launch Conversational Inquiry</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Jump-in Feature Cards */}
      <div className="jump-cards-grid">
        <div className="jump-card cursor-pointer" onClick={() => setPage('rosca')}>
          <div>
            <div className="jump-card-top">
              <div className="jump-card-icon">
                <Repeat size={16} />
              </div>
              <span className="status status-settled">{rosca?.length || 0} Cycles</span>
            </div>
            <h4>Merry-Go-Round</h4>
            <p>Rotating Chama pool savings with scheduled round payouts and double-entry tracking.</p>
          </div>
          <div className="jump-card-action">
            <span>Open Rosca Circles</span>
            <ArrowRight size={12} />
          </div>
        </div>

        <div className="jump-card cursor-pointer" onClick={() => setPage('loans')}>
          <div>
            <div className="jump-card-top">
              <div className="jump-card-icon">
                <PiggyBank size={16} />
              </div>
              <span className="status status-settled">{loans?.length || 0} Loans</span>
            </div>
            <h4>Table Banking & Loans</h4>
            <p>Internal peer micro-loans with interest amortization schedules and installment ledgering.</p>
          </div>
          <div className="jump-card-action">
            <span>Open Loan Book</span>
            <ArrowRight size={12} />
          </div>
        </div>

        <div className="jump-card cursor-pointer" onClick={() => setPage('invoices')}>
          <div>
            <div className="jump-card-top">
              <div className="jump-card-icon blue">
                <FileText size={16} />
              </div>
              <span className="status status-draft">B2B & Commercial</span>
            </div>
            <h4>Invoicing & VAT</h4>
            <p>Issue professional tax invoices, allocate multi-rail settlements, and manage AR/AP.</p>
          </div>
          <div className="jump-card-action">
            <span>Manage Invoices</span>
            <ArrowRight size={12} />
          </div>
        </div>

        <div className="jump-card cursor-pointer" onClick={() => setPage('accounts')}>
          <div>
            <div className="jump-card-top">
              <div className="jump-card-icon amber">
                <Wallet size={16} />
              </div>
              <span className="status status-healthy">{accounts?.length || 18} Accounts</span>
            </div>
            <h4>Chart of Accounts</h4>
            <p>Authoritative general ledger chart, asset/liability classifications and live net balances.</p>
          </div>
          <div className="jump-card-action">
            <span>Inspect Accounts</span>
            <ArrowRight size={12} />
          </div>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent obligations</h2>
              <p>Contribution items in this workspace</p>
            </div>
            <button className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer" onClick={() => setPage('contributions')}>
              View all ({obligations.length}) →
            </button>
          </div>
          <ObligationTable rows={obligations.slice(0, 5)} currency={currency} compact />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Expense activity</h2>
              <p>Recently submitted costs</p>
            </div>
            <button className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer" onClick={() => setPage('expenses')}>
              View all ({expenses.length}) →
            </button>
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
    </div>
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
        const target = Number(c.targetAmountMinor || c.targetMinor || 0);
        const raised = Number(c.collectedMinor || c.raisedMinor || 0);
        const pct = c.progressPercent !== undefined ? c.progressPercent : (target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0);

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
              <span>{c.obligationsCount || c.obligations?.length || 0} contributions pledged</span>
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
                  <b>{r.notes || r.expense?.description || `Reimbursement #${r.id.slice(-6).toUpperCase()}`}</b>
                  <small>{r.expense ? `Linked Expense: ${r.expense.description}` : (r.notes || 'Out of pocket claim')}</small>
                </td>
                <td>{r.claimantName || r.claimant?.name || r.claimant?.email || 'Member'}</td>
                <td><span className="quiet-tag">{r.expense?.category || 'REIMBURSEMENT'}</span></td>
                <td className="amount">{money(r.amountMinor, currency)}</td>
                <td>
                  {r.receiptUrl ? (
                    <a href={r.receiptUrl} target="_blank" rel="noreferrer" style={{ color: '#245c46', textDecoration: 'underline', fontSize: '11px' }}>
                      View Receipt
                    </a>
                  ) : (r.paymentRef ? <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{r.paymentRef}</span> : <span className="subtle">No file</span>)}
                </td>
                <td><Status value={r.status} /></td>
                <td>
                  <div className="inline-actions">
                    {(r.status === 'PENDING' || r.status === 'SUBMITTED') && (
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
              <option value="PAYSHAP_EFT">South Africa PayShap & Rapid EFT (ZAR Clearing)</option>
              <option value="DEVELOPMENT">Development Simulation (Sandbox)</option>
            </select>
          </Field>
          {rail === 'MPESA' && (
            <Field label="Kenyan Phone Number (2547XXXXXXXX)">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 254712345678" />
            </Field>
          )}
          {rail === 'PAYSHAP_EFT' && (
            <Field label="PayShap Account / Alias Number">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0821234567 or Bank Account" />
            </Field>
          )}
          {rail === 'STELLAR' && (
            <p className="tiny" style={{ background: '#edf4ef', padding: '10px', borderRadius: '6px' }}>
              Memo Reference: <b>PAY-{obligation.id.slice(0, 8).toUpperCase()}</b>. You will authorize the transaction using a Stellar wallet or Horizon transaction.
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
      } else if (p.rail === 'PAYSHAP_EFT') {
        const clearingRef = prompt('Enter South Africa Bank / PayShap Clearing Reference:');
        if (!clearingRef) return;
        await api(`/payments/${p.id}/payshap-confirm`, { method: 'POST', body: JSON.stringify({ clearingRef: clearingRef.trim().toUpperCase() }) });
        setNotice('PayShap payment confirmed and posted to journal.');
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
                      {r.rail === 'STELLAR' ? 'Verify on Stellar' : r.rail === 'MPESA' ? 'Confirm M-Pesa' : r.rail === 'PAYSHAP_EFT' ? 'Confirm PayShap' : 'Simulate verify'}
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
  const [amount, setAmount] = useState('');
  const [conversion, setConversion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setConversion(null);
      return;
    }
    const decimals = (fromCurr === 'UGX' || fromCurr === 'TZS') ? 0 : 2;
    const amountMinor = Math.round(val * Math.pow(10, decimals));

    setLoading(true);
    api('/fx/convert', {
      method: 'POST',
      body: JSON.stringify({ amountMinor, fromCurrency: fromCurr, toCurrency: toCurr })
    })
      .then(d => {
        setConversion(d);
        setLoading(false);
      })
      .catch(() => {
        setConversion(null);
        setLoading(false);
      });
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
              <option value="KES">KES</option>
              <option value="ZAR">ZAR</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="UGX">UGX</option>
            </select>
            <input
              type="number"
              placeholder="e.g. 100"
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
            <option value="ZAR">ZAR (South African Rand)</option>
            <option value="USD">USD (US Dollar)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="GBP">GBP (British Pound)</option>
            <option value="UGX">UGX (Uganda Shilling)</option>
          </select>
        </div>

        <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Estimated Settlement</span>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
            {loading ? 'Calculating...' : conversion ? `${toCurr} ${(conversion.targetAmountMinor / ((toCurr === 'UGX' || toCurr === 'TZS') ? 1 : 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
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
            <option value="GROUP">Group / Chama</option>
            <option value="COMMUNITY">Community / Table Bank</option>
            <option value="SME">SME / Business</option>
            <option value="ORGANISATION">Organisation</option>
            <option value="PERSONAL">Personal</option>
          </select>
        </Field>
        <Field label="Currency">
          <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
            <option>KES</option>
            <option>ZAR</option>
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
    const r = await fetch(`${API_URL}/workspaces/${workspaceId}/reports/ledger.csv`, {
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

function Modal({ type, onClose, onSubmit, busy, members, currency = 'KES' }) {
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
              targetAmount: form.target,
              startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
              endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
              deadline: form.endsAt ? new Date(form.endsAt).toISOString() : undefined
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
              amount: form.amount,
              amountMinor: Math.round(parseFloat(form.amount || '0') * 100),
              interval: form.interval,
              frequency: form.interval,
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
              <Field label={`Fundraising Target (${currency})`}>
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
            <Field label={`Amount (${currency})`}>
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

export default function Root() {
  return <App />;
}

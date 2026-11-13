import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Search, ArrowUpRight, ArrowDownLeft, ShieldCheck, Filter } from 'lucide-react';
import { api, money } from '../../api';
import { PageHeader, Field, Modal } from '../shared/CommonComponents';

export function AccountsView({ workspaceId, currency, setNotice }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('ASSET');
  const [description, setDescription] = useState('');

  function loadAccounts() {
    setLoading(true);
    api(`/workspaces/${workspaceId}/accounts`)
      .then(res => setAccounts(res.accounts || []))
      .catch(err => setNotice(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAccounts();
  }, [workspaceId]);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/accounts`, {
        method: 'POST',
        body: JSON.stringify({ code, name, type, description })
      });
      setNotice(`Account ${code} (${name}) created successfully.`);
      setModalOpen(false);
      setCode('');
      setName('');
      setDescription('');
      loadAccounts();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = accounts.filter(acc => {
    const matchesType = filterType === 'ALL' || acc.type === filterType;
    const matchesSearch = acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          acc.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const assetCount = accounts.filter(a => a.type === 'ASSET').length;
  const liabilityCount = accounts.filter(a => a.type === 'LIABILITY').length;
  const equityCount = accounts.filter(a => a.type === 'EQUITY').length;
  const revenueCount = accounts.filter(a => a.type === 'REVENUE').length;
  const expenseCount = accounts.filter(a => a.type === 'EXPENSE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="GENERAL LEDGER CHART OF ACCOUNTS"
        title="Accounts & Ledger Architecture"
        description="Authoritative chart of accounts enforcing double-entry rules across assets, liabilities, equity, revenues, and expenses."
        helpText="Every transaction posts to specific account codes in this chart of accounts. Assets and Expenses maintain normal debit balances, while Liabilities, Equity, and Revenues maintain normal credit balances."
        action={
          <button className="primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Add Account
          </button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-500 transition" onClick={() => setFilterType('ASSET')}>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">1000 Series</span>
          <div className="text-xl font-extrabold text-emerald-800 mt-0.5">{assetCount}</div>
          <span className="text-xs text-slate-600 font-medium">Assets</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-500 transition" onClick={() => setFilterType('LIABILITY')}>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">2000 Series</span>
          <div className="text-xl font-extrabold text-blue-800 mt-0.5">{liabilityCount}</div>
          <span className="text-xs text-slate-600 font-medium">Liabilities</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-500 transition" onClick={() => setFilterType('EQUITY')}>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">3000 Series</span>
          <div className="text-xl font-extrabold text-purple-800 mt-0.5">{equityCount}</div>
          <span className="text-xs text-slate-600 font-medium">Equity</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-500 transition" onClick={() => setFilterType('REVENUE')}>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">4000 Series</span>
          <div className="text-xl font-extrabold text-teal-800 mt-0.5">{revenueCount}</div>
          <span className="text-xs text-slate-600 font-medium">Revenue</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-500 transition" onClick={() => setFilterType('EXPENSE')}>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">5000 Series</span>
          <div className="text-xl font-extrabold text-amber-800 mt-0.5">{expenseCount}</div>
          <span className="text-xs text-slate-600 font-medium">Expenses</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs transition ${
                  filterType === t
                    ? 'bg-brand-950 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code or title..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-brand-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Account Code</th>
                <th className="py-3 px-4">Account Name & Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Debits Posted</th>
                <th className="py-3 px-4 text-right">Credits Posted</th>
                <th className="py-3 px-4 text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading Chart of Accounts...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No accounts match the current filter.</td>
                </tr>
              ) : (
                filtered.map(acc => {
                  const netMinor = BigInt(acc.netBalanceMinor || '0');
                  const isPositive = netMinor >= 0n;
                  return (
                    <tr key={acc.id || acc.code} className="hover:bg-slate-50/70 transition font-sans">
                      <td className="py-3 px-4 font-mono font-bold text-brand-900 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{acc.code}</span>
                          {acc.isSystem && (
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-sans font-semibold">System</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{acc.name}</div>
                        {acc.description && <div className="text-[11px] text-slate-500 font-normal">{acc.description}</div>}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          acc.type === 'ASSET' ? 'bg-emerald-100 text-emerald-800' :
                          acc.type === 'LIABILITY' ? 'bg-blue-100 text-blue-800' :
                          acc.type === 'EQUITY' ? 'bg-purple-100 text-purple-800' :
                          acc.type === 'REVENUE' ? 'bg-teal-100 text-teal-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                        {money(acc.debitsMinor || '0', acc.currency || currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                        {money(acc.creditsMinor || '0', acc.currency || currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        <span className={isPositive ? 'text-emerald-800' : 'text-amber-800'}>
                          {money(acc.netBalanceMinor || '0', acc.currency || currency)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal to add account */}
      {modalOpen && (
        <Modal title="Create New General Ledger Account" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-4 text-xs">
            <Field label="Account Code (e.g. 1050-PETTY-CASH)">
              <input
                type="text"
                required
                placeholder="1050-PETTY-CASH"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </Field>

            <Field label="Account Title">
              <input
                type="text"
                required
                placeholder="Petty Cash Reserve"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </Field>

            <Field label="Classification Category">
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="ASSET">ASSET (1000 Series - Normal Debit)</option>
                <option value="LIABILITY">LIABILITY (2000 Series - Normal Credit)</option>
                <option value="EQUITY">EQUITY (3000 Series - Normal Credit)</option>
                <option value="REVENUE">REVENUE (4000 Series - Normal Credit)</option>
                <option value="EXPENSE">EXPENSE (5000 Series - Normal Debit)</option>
              </select>
            </Field>

            <Field label="Description (Optional)">
              <textarea
                rows={2}
                placeholder="Account purpose and ledger posting scope..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" className="secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Creating...' : 'Register Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

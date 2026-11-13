import React, { useState } from 'react';
import {
  ShieldCheck, ArrowRight, CheckCircle2, ChevronRight, Zap, RefreshCw,
  Building2, Users, Wallet, CreditCard, Sparkles, Lock, TrendingUp,
  BarChart3, Globe, Layers, ArrowUpRight, Check, HelpCircle, FileText,
  PiggyBank, Play, Star, ExternalLink, Bot, Landmark, Scale
} from 'lucide-react';

export function LandingPage({ onEnterApp, user, onLoginClick }) {
  const [calculatorTab, setCalculatorTab] = useState('rosca'); // 'rosca' | 'fx' | 'ledger'
  const [memberCount, setMemberCount] = useState(12);
  const [monthlyContribution, setMonthlyContribution] = useState(10000); // KES 10,000
  const [loanInterestPct, setLoanInterestPct] = useState(10); // 10%
  const [fxFrom, setFxFrom] = useState('USD');
  const [fxTo, setFxTo] = useState('KES');
  const [fxAmount, setFxAmount] = useState(500);
  const [simCollections, setSimCollections] = useState(250000);
  const [simExpenses, setSimExpenses] = useState(85000);
  const [simLoans, setSimLoans] = useState(90000);
  const [activeFaq, setActiveFaq] = useState(null);

  // ROSCA Calculations
  const roundPot = memberCount * monthlyContribution;
  const cycleTotal = roundPot * memberCount;
  const loanFundPool = Math.round(roundPot * 0.4);
  const estimatedLoanYield = Math.round(loanFundPool * (loanInterestPct / 100));

  // FX Calculation
  const rates = {
    USD: { KES: 129.50, ZAR: 18.25, EUR: 0.92 },
    EUR: { KES: 140.20, ZAR: 19.80, USD: 1.08 },
    ZAR: { KES: 7.10, USD: 0.055, EUR: 0.051 },
    KES: { USD: 0.0077, ZAR: 0.14, EUR: 0.0071 }
  };
  const fxRate = rates[fxFrom]?.[fxTo] || 1;
  const fxConverted = Math.round(fxAmount * fxRate * 100) / 100;

  // Ledger Balance Calculations
  const totalDebits = simCollections + simExpenses + simLoans;
  const totalCredits = totalDebits;
  const netCashChange = simCollections - simExpenses - simLoans;

  return (
    <div className="landing-root">
      {/* Top Global Header (Matches Application Theme) */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-mark">H</div>
            <div className="landing-brand-text">
              <span className="landing-brand-title">HESABU</span>
              <span className="landing-brand-badge">FINANCIAL OS</span>
            </div>
          </div>

          <nav className="landing-nav-links">
            <a href="#features">Capabilities</a>
            <a href="#simulator">Simulator</a>
            <a href="#chama">Group Banking</a>
            <a href="#commercial">Commercial Finance</a>
            <a href="#rails">Settlement Rails</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="landing-nav-actions">
            {user ? (
              <button className="landing-btn-primary" onClick={onEnterApp}>
                <span>Enter Workspace</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <button className="landing-btn-ghost" onClick={onLoginClick}>
                  Sign in
                </button>
                <button className="landing-btn-primary" onClick={onLoginClick}>
                  <span>Get Started Free</span>
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-bg-glow" />
        <div className="landing-container">
          <div className="landing-hero-pill">
            <span className="landing-hero-beacon" />
            <span className="landing-hero-pill-text">ONE GROUP • ONE FINANCIAL TRUTH</span>
            <ChevronRight size={14} className="text-emerald-600" />
          </div>

          <h1 className="landing-hero-title">
            Shared Financial Accountability for Groups & Organizations
          </h1>

          <p className="landing-hero-subtitle">
            Stop managing group money across WhatsApp screenshots, notebooks, and conflicting spreadsheets. HESABU connects member commitments, provider-verified payments, spending approvals, and real-time reconciled funds into one shared truth.
          </p>

          <div className="landing-hero-cta-group">
            <button className="landing-btn-hero-primary" onClick={user ? onEnterApp : onLoginClick}>
              <span>{user ? 'Open Workspace' : 'Launch Free Workspace'}</span>
              <ArrowRight size={18} />
            </button>
            <a href="#simulator" className="landing-btn-hero-secondary">
              <Play size={16} className="text-emerald-700 fill-emerald-700" />
              <span>Explore Group Simulator</span>
            </a>
          </div>

          {/* Trust Metrics Bar */}
          <div className="landing-trust-bar">
            <div className="landing-trust-item">
              <ShieldCheck size={18} className="text-emerald-700" />
              <span>Verified Payment Receipts</span>
            </div>
            <div className="landing-trust-divider" />
            <div className="landing-trust-item">
              <Zap size={18} className="text-amber-700" />
              <span>Dual-Officer Spending Sign-offs</span>
            </div>
            <div className="landing-trust-divider" />
            <div className="landing-trust-item">
              <Scale size={18} className="text-teal-700" />
              <span>Balanced Double-Entry Books (Δ = 0.00)</span>
            </div>
            <div className="landing-trust-divider" />
            <div className="landing-trust-item">
              <Bot size={18} className="text-emerald-700" />
              <span>Automated Reconciliation Intelligence</span>
            </div>
          </div>

          {/* Live Hero Dashboard Preview */}
          <div className="landing-hero-mockup">
            <div className="landing-mockup-header">
              <div className="landing-mockup-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="landing-mockup-search">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>hesabu.app/workspace/enterprise-treasury</span>
              </div>
              <div className="landing-mockup-badge">
                <span className="status-dot" /> Live Financial System
              </div>
            </div>

            <div className="landing-mockup-body">
              <div className="landing-mockup-stats">
                <div className="landing-mockup-stat-card">
                  <span className="stat-label">TOTAL TREASURY LIQUIDITY</span>
                  <div className="stat-value">KES 14,820,500.00</div>
                  <div className="stat-sub positive">
                    <TrendingUp size={13} /> +18.4% this quarter
                  </div>
                </div>
                <div className="landing-mockup-stat-card">
                  <span className="stat-label">COLLECTIONS & SETTLEMENTS</span>
                  <div className="stat-value">KES 9,240,000.00</div>
                  <div className="stat-sub neutral">
                    <span>99.8% on-time settlement</span>
                  </div>
                </div>
                <div className="landing-mockup-stat-card">
                  <span className="stat-label">ROTATING POT (CYCLE 4)</span>
                  <div className="stat-value">KES 1,200,000.00</div>
                  <div className="stat-sub alert">
                    <span>Fully funded • Ready for payout</span>
                  </div>
                </div>
                <div className="landing-mockup-stat-card">
                  <span className="stat-label">GENERAL LEDGER STATUS</span>
                  <div className="stat-value text-emerald-700">BALANCED</div>
                  <div className="stat-sub positive">
                    <CheckCircle2 size={13} /> Zero trial balance variance (Δ = 0.00)
                  </div>
                </div>
              </div>

              {/* Activity Stream */}
              <div className="landing-mockup-stream">
                <div className="landing-stream-row">
                  <div className="landing-stream-icon mpesa">K</div>
                  <div className="landing-stream-info">
                    <b>Member Dues & Contribution Settlement</b>
                    <small>Received from Amina Wanjiku • Ref: QDH8291KL0 • Auto-Reconciled</small>
                  </div>
                  <span className="landing-stream-amount positive">+ KES 25,000.00</span>
                  <span className="landing-stream-status settled">Verified</span>
                </div>
                <div className="landing-stream-row">
                  <div className="landing-stream-icon payshap">Z</div>
                  <div className="landing-stream-info">
                    <b>Commercial Supplier Bill Payment</b>
                    <small>Payable to Sovereign Telecommunications Ltd • 2-Tier Authorized</small>
                  </div>
                  <span className="landing-stream-amount negative">- ZAR 8,500.00</span>
                  <span className="landing-stream-status settled">Disbursed</span>
                </div>
                <div className="landing-stream-row">
                  <div className="landing-stream-icon fx">F</div>
                  <div className="landing-stream-info">
                    <b>Multi-Currency Treasury Conversion</b>
                    <small>USD to KES Settlement • Guaranteed Rate Window Locked</small>
                  </div>
                  <span className="landing-stream-amount positive">+ KES 647,500.00</span>
                  <span className="landing-stream-status settled">Settled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regional Settlement Rails Strip */}
      <section className="landing-rails-strip" id="rails">
        <div className="landing-container">
          <p className="landing-section-eyebrow text-center">NATIVE SETTLEMENT INFRASTRUCTURE</p>
          <h2 className="landing-section-title text-center">Built for Multi-Rail Financial Operations</h2>
          <p className="landing-section-subtitle text-center">
            Connect verified payment gateways and clearing rails directly to your general ledger.
          </p>

          <div className="landing-rails-grid">
            <div className="landing-rail-card">
              <div className="landing-rail-badge kenya">🇰🇪 EAST AFRICA</div>
              <h3>Mobile Money & Dues Clearing</h3>
              <p>Automated member contributions, instant collection tracking, and direct disbursements with real-time settlement receipts.</p>
              <div className="landing-rail-specs">
                <span>⚡ Instant payment confirmation</span>
                <span>📋 Automated receipt voucher generation</span>
              </div>
            </div>

            <div className="landing-rail-card">
              <div className="landing-rail-badge sa">🇿🇦 SOUTHERN AFRICA</div>
              <h3>Interbank EFT & Supplier Clearing</h3>
              <p>Instant clearing for commercial supplier invoices, cooperative distributions, and high-value payments with dual-signatory approvals.</p>
              <div className="landing-rail-specs">
                <span>🏦 Direct bank clearing</span>
                <span>🔐 Segregation of duties & dual sign-off</span>
              </div>
            </div>

            <div className="landing-rail-card">
              <div className="landing-rail-badge global">🌐 CROSS-BORDER</div>
              <h3>Multi-Currency Operating Accounts</h3>
              <p>Execute transparent currency conversions across KES, ZAR, USD, and EUR with guaranteed rate locks and balanced clearing accounts.</p>
              <div className="landing-rail-specs">
                <span>💱 Real-time exchange rate quotes</span>
                <span>📊 Automatic currency leg balancing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section className="landing-simulator" id="simulator">
        <div className="landing-container">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">INTERACTIVE FINANCIAL SIMULATOR</p>
            <h2 className="landing-section-title">Model Your Group or Enterprise Treasury</h2>
            <p className="landing-section-subtitle">
              Simulate rotating savings circles, multi-currency conversions, and double-entry ledger balancing in real time.
            </p>
          </div>

          <div className="landing-calculator-card">
            <div className="landing-calc-tabs">
              <button
                className={`landing-calc-tab ${calculatorTab === 'rosca' ? 'active' : ''}`}
                onClick={() => setCalculatorTab('rosca')}
              >
                <PiggyBank size={16} />
                <span>Rotating Savings & Table Loans</span>
              </button>
              <button
                className={`landing-calc-tab ${calculatorTab === 'fx' ? 'active' : ''}`}
                onClick={() => setCalculatorTab('fx')}
              >
                <RefreshCw size={16} />
                <span>Multi-Currency Treasury (FX)</span>
              </button>
              <button
                className={`landing-calc-tab ${calculatorTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setCalculatorTab('ledger')}
              >
                <Scale size={16} />
                <span>Double-Entry Balance Engine</span>
              </button>
            </div>

            <div className="landing-calc-content">
              {calculatorTab === 'rosca' && (
                <div className="landing-calc-grid" id="chama">
                  <div className="landing-calc-inputs">
                    <div className="landing-input-group">
                      <div className="landing-input-header">
                        <label>Active Circle Members</label>
                        <span className="landing-input-val">{memberCount} members</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="30"
                        value={memberCount}
                        onChange={e => setMemberCount(Number(e.target.value))}
                        className="landing-slider"
                      />
                    </div>

                    <div className="landing-input-group">
                      <div className="landing-input-header">
                        <label>Monthly Contribution per Member</label>
                        <span className="landing-input-val">KES {monthlyContribution.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="2000"
                        max="50000"
                        step="1000"
                        value={monthlyContribution}
                        onChange={e => setMonthlyContribution(Number(e.target.value))}
                        className="landing-slider"
                      />
                    </div>

                    <div className="landing-input-group">
                      <div className="landing-input-header">
                        <label>Table Loan Interest Rate</label>
                        <span className="landing-input-val">{loanInterestPct}% per annum</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="24"
                        value={loanInterestPct}
                        onChange={e => setLoanInterestPct(Number(e.target.value))}
                        className="landing-slider"
                      />
                    </div>
                  </div>

                  <div className="landing-calc-results">
                    <h4>ROTATING SAVINGS & LOAN PROJECTIONS</h4>
                    <div className="calc-result-row">
                      <span>Monthly Pot Payout per Turn:</span>
                      <strong>KES {roundPot.toLocaleString()}</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Full Cycle Total ({memberCount} months):</span>
                      <strong>KES {cycleTotal.toLocaleString()}</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Available Table Loan Liquidity:</span>
                      <strong>KES {loanFundPool.toLocaleString()}</strong>
                    </div>
                    <div className="calc-result-row highlight">
                      <span>Projected Group Interest Surplus:</span>
                      <strong className="text-emerald-700">+ KES {estimatedLoanYield.toLocaleString()}</strong>
                    </div>
                    <button className="landing-btn-primary full mt-4" onClick={user ? onEnterApp : onLoginClick}>
                      Start This Group on HESABU
                    </button>
                  </div>
                </div>
              )}

              {calculatorTab === 'fx' && (
                <div className="landing-calc-grid">
                  <div className="landing-calc-inputs">
                    <div className="landing-input-group">
                      <label className="block text-xs font-bold text-slate-800 mb-2">Source Amount & Currency</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={fxAmount}
                          onChange={e => setFxAmount(Number(e.target.value))}
                          className="landing-text-input flex-1"
                        />
                        <select
                          value={fxFrom}
                          onChange={e => setFxFrom(e.target.value)}
                          className="landing-select-input"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="ZAR">ZAR (R)</option>
                          <option value="KES">KES (KSh)</option>
                        </select>
                      </div>
                    </div>

                    <div className="landing-input-group">
                      <label className="block text-xs font-bold text-slate-800 mb-2">Target Settlement Currency</label>
                      <select
                        value={fxTo}
                        onChange={e => setFxTo(e.target.value)}
                        className="landing-select-input full"
                      >
                        <option value="KES">KES — Kenya Shillings</option>
                        <option value="ZAR">ZAR — South African Rand</option>
                        <option value="USD">USD — US Dollar</option>
                        <option value="EUR">EUR — Euro</option>
                      </select>
                    </div>

                    <div className="p-3 bg-surface-100 border border-surface-300 rounded-lg text-xs text-slate-700">
                      <b>Guaranteed 15-Minute Rate Window:</b> HESABU locks the conversion rate and automatically posts balanced currency clearing entries to your double-entry ledger.
                    </div>
                  </div>

                  <div className="landing-calc-results">
                    <h4>INSTANT TREASURY QUOTE</h4>
                    <div className="calc-result-row">
                      <span>Exchange Rate:</span>
                      <strong>1 {fxFrom} = {fxRate} {fxTo}</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Liquidity Spread:</span>
                      <strong>0.50% (50 bps)</strong>
                    </div>
                    <div className="calc-result-row highlight">
                      <span>Estimated Net Minor Settlement:</span>
                      <strong className="text-emerald-700 text-lg">{fxTo} {fxConverted.toLocaleString()}</strong>
                    </div>
                    <button className="landing-btn-primary full mt-4" onClick={user ? onEnterApp : onLoginClick}>
                      Execute Conversion in Treasury
                    </button>
                  </div>
                </div>
              )}

              {calculatorTab === 'ledger' && (
                <div className="landing-calc-grid">
                  <div className="landing-calc-inputs">
                    <div className="landing-input-group">
                      <div className="landing-input-header">
                        <label>Member Collections & Sales</label>
                        <span className="landing-input-val">KES {simCollections.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="50000"
                        max="1000000"
                        step="10000"
                        value={simCollections}
                        onChange={e => setSimCollections(Number(e.target.value))}
                        className="landing-slider"
                      />
                    </div>

                    <div className="landing-input-group">
                      <div className="landing-input-header">
                        <label>Operational Spend & Supplier Bills</label>
                        <span className="landing-input-val">KES {simExpenses.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="10000"
                        max="500000"
                        step="5000"
                        value={simExpenses}
                        onChange={e => setSimExpenses(Number(e.target.value))}
                        className="landing-slider"
                      />
                    </div>

                    <div className="landing-input-group">
                      <div className="landing-input-header">
                        <label>Loan Disbursements & Investments</label>
                        <span className="landing-input-val">KES {simLoans.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="10000"
                        max="500000"
                        step="5000"
                        value={simLoans}
                        onChange={e => setSimLoans(Number(e.target.value))}
                        className="landing-slider"
                      />
                    </div>
                  </div>

                  <div className="landing-calc-results">
                    <h4>DOUBLE-ENTRY TRIAL BALANCE ENGINE</h4>
                    <div className="calc-result-row">
                      <span>Total Journal Debits:</span>
                      <strong className="font-mono">KES {totalDebits.toLocaleString()}.00</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Total Journal Credits:</span>
                      <strong className="font-mono">KES {totalCredits.toLocaleString()}.00</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Trial Balance Discrepancy:</span>
                      <strong className="text-emerald-700 font-mono font-bold">Δ = 0.00 (Perfect Equality)</strong>
                    </div>
                    <div className="calc-result-row highlight">
                      <span>Net Cashflow Surplus:</span>
                      <strong className={`text-lg font-mono ${netCashChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        KES {netCashChange.toLocaleString()}.00
                      </strong>
                    </div>
                    <button className="landing-btn-primary full mt-4" onClick={user ? onEnterApp : onLoginClick}>
                      View Full General Ledger
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="landing-features" id="features">
        <div className="landing-container">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">CORE PRODUCT CAPABILITIES</p>
            <h2 className="landing-section-title">Built for Real-World Financial Operations</h2>
            <p className="landing-section-subtitle">
              Engineered from first principles for chamas, SACCOs, multi-member associations, and high-growth commercial enterprises.
            </p>
          </div>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-emerald-100 text-emerald-800">
                <Users size={22} />
              </div>
              <h3>Chama & SACCO Automation</h3>
              <p>Rotating merry-go-round cycles with automated turn disbursement, verified pot funding, and table banking loans with custom penalty rules.</p>
              <ul className="landing-feature-bullets">
                <li>Automated round rotation & pot collection</li>
                <li>Flat or reducing-balance table loans</li>
                <li>Strict anti-overpayment validation</li>
              </ul>
            </div>

            <div className="landing-feature-card" id="commercial">
              <div className="landing-feature-icon-box bg-teal-100 text-teal-800">
                <FileText size={22} />
              </div>
              <h3>Commercial Invoicing & Accounts Receivable</h3>
              <p>Complete lifecycle receivables. Issue professional invoices with automatic tax allocation, credit notes, and instant customer settlements.</p>
              <ul className="landing-feature-bullets">
                <li>Automated VAT & sales tax calculation</li>
                <li>Customer payment matching & receipts</li>
                <li>Comprehensive customer ledger balances</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-brand-100 text-brand-900">
                <Building2 size={22} />
              </div>
              <h3>Supplier Bills & Accounts Payable</h3>
              <p>Streamline expenditures with purchase requisitions, dual-officer approval workflows, and direct disbursements to verified supplier accounts.</p>
              <ul className="landing-feature-bullets">
                <li>Purchase requisitions with budget checks</li>
                <li>Segregation of duties: creator cannot self-approve</li>
                <li>Direct supplier payment execution</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-emerald-100 text-emerald-800">
                <Landmark size={22} />
              </div>
              <h3>Authoritative Double-Entry Ledger</h3>
              <p>No spreadsheets or manual reconciliations. Every transaction automatically posts balanced debits and credits following GAAP/IFRS standards.</p>
              <ul className="landing-feature-bullets">
                <li>Real-time Trial Balance & Income Statement (P&L)</li>
                <li>Multi-currency operating accounts</li>
                <li>Permanent contra-reversals for audit compliance</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-brand-100 text-brand-900">
                <Bot size={22} />
              </div>
              <h3>Agentic Financial Intelligence</h3>
              <p>Built-in autonomous copilot providing instant answers on dues, spend trends, budget utilization, and automated cashflow reconciliation.</p>
              <ul className="landing-feature-bullets">
                <li>Instant natural-language financial queries</li>
                <li>Automated reconciliation gap detection</li>
                <li>Collaborative financial health scoring</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-teal-100 text-teal-800">
                <ShieldCheck size={22} />
              </div>
              <h3>Auditing & Regulatory Compliance</h3>
              <p>Maintain an immutable audit trail of every administrative and financial event with tamper-evident statements ready for external auditors.</p>
              <ul className="landing-feature-bullets">
                <li>Comprehensive audit trail with timestamps & IPs</li>
                <li>Verifiable financial statement fingerprints</li>
                <li>Instant balance sheet & income statement exports</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-how-it-works">
        <div className="landing-container">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">SIMPLE ONBOARDING</p>
            <h2 className="landing-section-title">Up and Running in 3 Steps</h2>
            <p className="landing-section-subtitle">
              Move your group or organization from scattered spreadsheets to an enterprise-grade financial engine.
            </p>
          </div>

          <div className="landing-steps-grid">
            <div className="landing-step-card">
              <div className="landing-step-number">01</div>
              <h4>Create Your Workspace</h4>
              <p>Select your operational profile (SME, Chama, Cooperative) and primary operating currency (KES, ZAR, USD).</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-number">02</div>
              <h4>Invite Your Finance Team</h4>
              <p>Configure role-based access for admins, financial officers, and approvers to enforce segregation of duties.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-number">03</div>
              <h4>Automate Operations & Books</h4>
              <p>Collect dues, issue invoices, disburse loans, pay bills, and let the double-entry engine balance your books automatically.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="landing-pricing" id="pricing">
        <div className="landing-container">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">TRANSPARENT PRICING</p>
            <h2 className="landing-section-title">Plans Tailored for Every Organization</h2>
            <p className="landing-section-subtitle">
              Start free with your community circle, or upgrade as your commercial transaction volume expands.
            </p>
          </div>

          <div className="landing-pricing-grid">
            <div className="landing-pricing-card">
              <div className="pricing-badge">STARTER</div>
              <h3>Community Circle</h3>
              <div className="pricing-price">
                <strong>Free</strong>
                <span>forever</span>
              </div>
              <p className="pricing-desc">Ideal for chamas, family funds, and community savings circles.</p>
              <ul className="pricing-features">
                <li><Check size={14} className="text-emerald-600" /> Up to 20 Members</li>
                <li><Check size={14} className="text-emerald-600" /> Rotating Savings Cycles (Merry-Go-Round)</li>
                <li><Check size={14} className="text-emerald-600" /> Table Banking Loans & Repayments</li>
                <li><Check size={14} className="text-emerald-600" /> Automated Member Dues Schedules</li>
                <li><Check size={14} className="text-emerald-600" /> Standard Financial Reports</li>
              </ul>
              <button className="landing-btn-secondary full" onClick={user ? onEnterApp : onLoginClick}>
                Get Started Free
              </button>
            </div>

            <div className="landing-pricing-card featured">
              <div className="pricing-featured-badge">MOST POPULAR</div>
              <div className="pricing-badge">GROWTH</div>
              <h3>Cooperative & SME</h3>
              <div className="pricing-price">
                <strong>KES 4,500</strong>
                <span>/ month</span>
              </div>
              <p className="pricing-desc">For commercial businesses, growing cooperatives, and formal trade associations.</p>
              <ul className="pricing-features">
                <li><Check size={14} className="text-emerald-600" /> Unlimited Members & Team Roles</li>
                <li><Check size={14} className="text-emerald-600" /> Invoicing with Automated VAT Allocation</li>
                <li><Check size={14} className="text-emerald-600" /> 2-Tier Supplier Bill Approvals</li>
                <li><Check size={14} className="text-emerald-600" /> Full Double-Entry General Ledger</li>
                <li><Check size={14} className="text-emerald-600" /> Multi-Rail Mobile & Bank Sync</li>
                <li><Check size={14} className="text-emerald-600" /> Autonomous Financial Copilot</li>
              </ul>
              <button className="landing-btn-primary full" onClick={user ? onEnterApp : onLoginClick}>
                Start 14-Day Free Trial
              </button>
            </div>

            <div className="landing-pricing-card">
              <div className="pricing-badge">ENTERPRISE</div>
              <h3>Institutional Treasury</h3>
              <div className="pricing-price">
                <strong>Custom</strong>
                <span>annual billing</span>
              </div>
              <p className="pricing-desc">For regional federations, corporate treasuries, and multi-entity operations.</p>
              <ul className="pricing-features">
                <li><Check size={14} className="text-emerald-600" /> Multi-Entity Workspace Hierarchy</li>
                <li><Check size={14} className="text-emerald-600" /> Tamper-Evident Statement Verification</li>
                <li><Check size={14} className="text-emerald-600" /> Custom Multi-Currency FX Spreads</li>
                <li><Check size={14} className="text-emerald-600" /> Dedicated SLA & Priority Support</li>
                <li><Check size={14} className="text-emerald-600" /> Comprehensive Regulatory Audit Exports</li>
              </ul>
              <button className="landing-btn-secondary full" onClick={user ? onEnterApp : onLoginClick}>
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="landing-faq">
        <div className="landing-container max-w-3xl">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">FREQUENTLY ASKED QUESTIONS</p>
            <h2 className="landing-section-title">Clear Answers to Common Questions</h2>
          </div>

          <div className="landing-faq-accordion">
            {[
              {
                q: 'How does HESABU guarantee balanced books?',
                a: 'HESABU enforces transactional double-entry accounting in its core ledger. Every payment, settlement, fee, loan disbursement, or expense creates equal debits and credits. Entries cannot be deleted; only standard contra-reversals are permitted.'
              },
              {
                q: 'How does the Rotating Savings (Merry-Go-Round) cycle work?',
                a: 'When an administrator configures a circle, HESABU sets the turn order. In each round, members contribute their share. The system verifies that the pot is 100% funded before enabling the payout to the scheduled beneficiary, advancing automatically to the next turn.'
              },
              {
                q: 'Can members submit claims for out-of-pocket expenses?',
                a: 'Yes. Members can submit reimbursement claims directly through the platform. Authorized finance officers review the receipts, approve the requests, and disburse settlements directly to the member.'
              },
              {
                q: 'How does HESABU prevent financial fraud and overspending?',
                a: 'HESABU enforces segregation of duties: the creator of an expense or bill cannot approve their own transaction. Furthermore, budget tracking provides automatic alerts when department or project spend reaches 80% and 100% of allocations.'
              }
            ].map((faq, i) => (
              <div
                key={i}
                className={`landing-faq-item ${activeFaq === i ? 'open' : ''}`}
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
              >
                <div className="landing-faq-question">
                  <span>{faq.q}</span>
                  <ChevronRight size={18} className="landing-faq-chevron" />
                </div>
                {activeFaq === i && (
                  <div className="landing-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action Banner */}
      <section className="landing-cta-banner">
        <div className="landing-container text-center">
          <h2>Ready to Modernize Your Financial Operations?</h2>
          <p>Join chamas, cooperatives, and growing businesses managing treasury with mathematical precision and total transparency.</p>
          <div className="flex justify-center gap-4 mt-6">
            <button className="landing-btn-hero-primary" onClick={user ? onEnterApp : onLoginClick}>
              <span>{user ? 'Enter Your Workspace' : 'Launch Free Workspace Today'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-grid">
            <div className="landing-footer-brand">
              <div className="landing-brand">
                <div className="landing-brand-mark">H</div>
                <div className="landing-brand-text">
                  <span className="landing-brand-title">HESABU</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                Collaborative Financial Operations & Treasury Operating System. Engineered for chamas, cooperatives, and commercial enterprises.
              </p>
              <div className="landing-footer-status">
                <span className="status-dot" /> All financial services operational
              </div>
            </div>

            <div className="landing-footer-col">
              <h5>PRODUCT</h5>
              <a href="#chama">Rotating Savings & Loans</a>
              <a href="#commercial">Invoicing & AP/AR</a>
              <a href="#simulator">Multi-Currency Treasury</a>
              <a href="#rails">Payment Rails</a>
              <a href="#features">Double-Entry Accounting</a>
            </div>

            <div className="landing-footer-col">
              <h5>SOLUTIONS</h5>
              <a href="#features">Investment Groups</a>
              <a href="#features">Agricultural SACCOs</a>
              <a href="#features">Commercial Businesses</a>
              <a href="#pricing">Enterprise Treasury</a>
            </div>

            <div className="landing-footer-col">
              <h5>GOVERNANCE</h5>
              <a href="#simulator">GAAP / IFRS Ledger</a>
              <a href="#features">Segregation of Duties</a>
              <a href="#features">Budget Variance</a>
              <a href="#features">Audit Trail & Compliance</a>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <span>© {new Date().getFullYear()} HESABU Platform. All rights reserved.</span>
            <div className="flex gap-4 text-xs text-slate-400">
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
              <a href="#security">Security & Governance</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

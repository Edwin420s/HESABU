import React, { useState } from 'react';
import {
  ShieldCheck, ArrowRight, CheckCircle2, ChevronRight, Zap, RefreshCw,
  Building2, Users, Wallet, CreditCard, Sparkles, Lock, TrendingUp,
  BarChart3, Globe, Layers, ArrowUpRight, Check, HelpCircle, FileText,
  PiggyBank, Play, Star, ExternalLink, Bot, Landmark
} from 'lucide-react';

export function LandingPage({ onEnterApp, user, onLoginClick }) {
  const [calculatorTab, setCalculatorTab] = useState('rosca'); // 'rosca' | 'fx' | 'anchor'
  const [memberCount, setMemberCount] = useState(12);
  const [monthlyContribution, setMonthlyContribution] = useState(10000); // KES 10,000
  const [loanInterestPct, setLoanInterestPct] = useState(10); // 10%
  const [fxFrom, setFxFrom] = useState('USD');
  const [fxTo, setFxTo] = useState('KES');
  const [fxAmount, setFxAmount] = useState(500);
  const [activeFaq, setActiveFaq] = useState(null);

  // Calculations
  const roundPot = memberCount * monthlyContribution;
  const cycleTotal = roundPot * memberCount;
  const loanFundPool = Math.round(roundPot * 0.4);
  const estimatedLoanYield = Math.round(loanFundPool * (loanInterestPct / 100));

  // FX Calculation
  const rates = { USD: { KES: 129.50, ZAR: 18.25, EUR: 0.92 }, EUR: { KES: 140.20, ZAR: 19.80, USD: 1.08 }, ZAR: { KES: 7.10, USD: 0.055, EUR: 0.051 }, KES: { USD: 0.0077, ZAR: 0.14, EUR: 0.0071 } };
  const fxRate = rates[fxFrom]?.[fxTo] || 1;
  const fxConverted = Math.round(fxAmount * fxRate * 100) / 100;

  return (
    <div className="landing-root">
      {/* Navigation Bar */}
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
            <a href="#features">Features</a>
            <a href="#simulator">Simulator</a>
            <a href="#chama">Chamas & Saccos</a>
            <a href="#commercial">Commercial AP/AR</a>
            <a href="#rails">Payment Rails</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="landing-nav-actions">
            {user ? (
              <button className="landing-btn-primary" onClick={onEnterApp}>
                <span>Enter Workspace</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button className="landing-btn-ghost" onClick={onLoginClick}>
                  Sign in
                </button>
                <button className="landing-btn-primary" onClick={onLoginClick}>
                  <span>Get Started Free</span>
                  <ArrowRight size={16} />
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
            <span className="landing-hero-pill-text">HESABU 2.0 Enterprise Financial Engine</span>
            <ChevronRight size={14} className="text-emerald-400" />
          </div>

          <h1 className="landing-hero-title">
            Collaborative Financial Operations & Treasury for African Enterprises
          </h1>

          <p className="landing-hero-subtitle">
            Unify Safaricom M-Pesa, South African PayShap, and Stellar Horizon with GAAP double-entry precision. Orchestrate rotating Chama savings, commercial AP/AR, multi-currency treasury, and cryptographic statement anchors.
          </p>

          <div className="landing-hero-cta-group">
            <button className="landing-btn-hero-primary" onClick={user ? onEnterApp : onLoginClick}>
              <span>{user ? 'Open Your Workspace' : 'Launch Free Workspace'}</span>
              <ArrowRight size={18} />
            </button>
            <a href="#simulator" className="landing-btn-hero-secondary">
              <Play size={16} className="text-emerald-600 fill-emerald-600" />
              <span>Explore Live Calculator</span>
            </a>
          </div>

          {/* Trust Metrics Bar */}
          <div className="landing-trust-bar">
            <div className="landing-trust-item">
              <ShieldCheck size={18} className="text-emerald-500" />
              <span>GAAP / IFRS Double-Entry</span>
            </div>
            <div className="landing-trust-divider" />
            <div className="landing-trust-item">
              <Zap size={18} className="text-amber-500" />
              <span>Instant Rails: M-Pesa & PayShap</span>
            </div>
            <div className="landing-trust-divider" />
            <div className="landing-trust-item">
              <Lock size={18} className="text-cyan-500" />
              <span>Soroban Cryptographic Anchors</span>
            </div>
            <div className="landing-trust-divider" />
            <div className="landing-trust-item">
              <Bot size={18} className="text-emerald-400" />
              <span>Autonomous AI Copilot</span>
            </div>
          </div>

          {/* Live Hero Dashboard Preview Mockup */}
          <div className="landing-hero-mockup">
            <div className="landing-mockup-header">
              <div className="landing-mockup-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="landing-mockup-search">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>app.hesabu.co/workspace/enterprise-treasury</span>
              </div>
              <div className="landing-mockup-badge">
                <span className="status-dot" /> Live System Connected
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
                    <span>99.8% on-time rate</span>
                  </div>
                </div>
                <div className="landing-mockup-stat-card">
                  <span className="stat-label">MERRY-GO-ROUND POT (ROUND 4)</span>
                  <div className="stat-value">KES 1,200,000.00</div>
                  <div className="stat-sub alert">
                    <span>Fully funded • Payout ready</span>
                  </div>
                </div>
                <div className="landing-mockup-stat-card">
                  <span className="stat-label">AUDIT TRIAL BALANCE</span>
                  <div className="stat-value text-emerald-600">BALANCED</div>
                  <div className="stat-sub positive">
                    <CheckCircle2 size={13} /> Zero ledger discrepancy
                  </div>
                </div>
              </div>

              {/* Mock Activity Stream */}
              <div className="landing-mockup-stream">
                <div className="landing-stream-row">
                  <div className="landing-stream-icon mpesa">M</div>
                  <div className="landing-stream-info">
                    <b>M-Pesa C2B Obligation Settlement</b>
                    <small>Received from Amina Wanjiku • Ref: QDH8291KL0</small>
                  </div>
                  <span className="landing-stream-amount positive">+ KES 25,000.00</span>
                  <span className="landing-stream-status settled">Confirmed</span>
                </div>
                <div className="landing-stream-row">
                  <div className="landing-stream-icon payshap">P</div>
                  <div className="landing-stream-info">
                    <b>PayShap Instant Supplier Payment</b>
                    <small>To Sovereign Telecommunications Ltd • 2-Tier Authorized</small>
                  </div>
                  <span className="landing-stream-amount negative">- ZAR 8,500.00</span>
                  <span className="landing-stream-status settled">Settled</span>
                </div>
                <div className="landing-stream-row">
                  <div className="landing-stream-icon stellar">S</div>
                  <div className="landing-stream-info">
                    <b>Stellar Soroban Statement Merkle Anchor</b>
                    <small>Quarterly Balance Sheet Hash: 0x9f4a...8d2b</small>
                  </div>
                  <span className="landing-stream-amount text-slate-500">Block #48,192,041</span>
                  <span className="landing-stream-status anchor">Anchored</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regional Rails Strip */}
      <section className="landing-rails-strip" id="rails">
        <div className="landing-container">
          <p className="landing-section-eyebrow text-center">NATIVE REGIONAL SETTLEMENT INFRASTRUCTURE</p>
          <div className="landing-rails-grid">
            <div className="landing-rail-card">
              <div className="landing-rail-badge kenya">🇰🇪 KENYA</div>
              <h3>Safaricom M-Pesa</h3>
              <p>Direct C2B paybill and automated STK Push payment authorization with instant webhook reconciliation.</p>
              <div className="landing-rail-specs">
                <span>⚡ Sub-second settlement</span>
                <span>📋 Auto receipt voucher</span>
              </div>
            </div>
            <div className="landing-rail-card">
              <div className="landing-rail-badge sa">🇿🇦 SOUTH AFRICA</div>
              <h3>PayShap & Instant EFT</h3>
              <p>Instant interbank settlement for South African cooperatives, associations, and commercial suppliers.</p>
              <div className="landing-rail-specs">
                <span>🏦 Rapid clearing</span>
                <span>🔐 Two-officer dual sign-off</span>
              </div>
            </div>
            <div className="landing-rail-card">
              <div className="landing-rail-badge global">🌐 CROSS-BORDER</div>
              <h3>Stellar Horizon & Soroban</h3>
              <p>Cryptographic smart contract escrow, cross-border liquidity rails, and Merkle statement verification.</p>
              <div className="landing-rail-specs">
                <span>⚓ Immutable ledger proof</span>
                <span>💵 USDC / XLM native</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Calculator Section */}
      <section className="landing-simulator" id="simulator">
        <div className="landing-container">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">INTERACTIVE FINANCIAL SIMULATOR</p>
            <h2 className="landing-section-title">Experience the Power of HESABU</h2>
            <p className="landing-section-subtitle">
              Simulate rotating savings circles, multi-currency treasury conversions, and cryptographic proof of reserves in real-time.
            </p>
          </div>

          <div className="landing-calculator-card">
            <div className="landing-calc-tabs">
              <button
                className={`landing-calc-tab ${calculatorTab === 'rosca' ? 'active' : ''}`}
                onClick={() => setCalculatorTab('rosca')}
              >
                <PiggyBank size={16} />
                <span>Chama ROSCA & Table Loans</span>
              </button>
              <button
                className={`landing-calc-tab ${calculatorTab === 'fx' ? 'active' : ''}`}
                onClick={() => setCalculatorTab('fx')}
              >
                <RefreshCw size={16} />
                <span>Multi-Currency Treasury (FX)</span>
              </button>
              <button
                className={`landing-calc-tab ${calculatorTab === 'anchor' ? 'active' : ''}`}
                onClick={() => setCalculatorTab('anchor')}
              >
                <Lock size={16} />
                <span>Cryptographic Proof Engine</span>
              </button>
            </div>

            <div className="landing-calc-content">
              {calculatorTab === 'rosca' && (
                <div className="landing-calc-grid">
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
                    <h4>ROTATING CYCLE OUTPUT</h4>
                    <div className="calc-result-row">
                      <span>Monthly Pot per Turn:</span>
                      <strong>KES {roundPot.toLocaleString()}</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Full Cycle Value ({memberCount} months):</span>
                      <strong>KES {cycleTotal.toLocaleString()}</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Available Table Loan Liquidity:</span>
                      <strong>KES {loanFundPool.toLocaleString()}</strong>
                    </div>
                    <div className="calc-result-row highlight">
                      <span>Projected Group Interest Surplus:</span>
                      <strong className="text-emerald-600">+ KES {estimatedLoanYield.toLocaleString()}</strong>
                    </div>
                    <button className="landing-btn-primary full mt-4" onClick={user ? onEnterApp : onLoginClick}>
                      Start this circle on HESABU
                    </button>
                  </div>
                </div>
              )}

              {calculatorTab === 'fx' && (
                <div className="landing-calc-grid">
                  <div className="landing-calc-inputs">
                    <div className="landing-input-group">
                      <label className="block text-xs font-bold text-slate-700 mb-2">Source Amount & Currency</label>
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
                      <label className="block text-xs font-bold text-slate-700 mb-2">Target Settlement Currency</label>
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

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                      <b>Guaranteed 15-Minute Quote Window:</b> HESABU locks the rate and automatically creates balanced clearing legs in account <code>1040-FX-CLEARING</code>.
                    </div>
                  </div>

                  <div className="landing-calc-results">
                    <h4>INSTANT TREASURY QUOTE</h4>
                    <div className="calc-result-row">
                      <span>Base Conversion Rate:</span>
                      <strong>1 {fxFrom} = {fxRate} {fxTo}</strong>
                    </div>
                    <div className="calc-result-row">
                      <span>Liquidity Spread:</span>
                      <strong>0.50% (50 bps)</strong>
                    </div>
                    <div className="calc-result-row highlight">
                      <span>Target Amount Minor / Net:</span>
                      <strong className="text-emerald-600 text-lg">{fxTo} {fxConverted.toLocaleString()}</strong>
                    </div>
                    <button className="landing-btn-primary full mt-4" onClick={user ? onEnterApp : onLoginClick}>
                      Execute Conversion in Treasury
                    </button>
                  </div>
                </div>
              )}

              {calculatorTab === 'anchor' && (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">Cryptographic Statement Anchoring</h3>
                      <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        Financial statements in HESABU aren't just database rows. Each quarter's general ledger, trial balance, and asset positions are hashed into a cryptographic Merkle tree. The canonical root hash is permanently anchored to the Soroban smart contract network.
                      </p>
                      <ul className="space-y-2 text-xs text-slate-700 mb-4">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                          <span>Tamper-evident mathematical proof for SACCO regulators</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                          <span>Zero-knowledge auditability for cooperative members</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                          <span>Sub-second inclusion verification with SHA-256 Merkle proofs</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-slate-900 text-slate-200 p-5 rounded-xl font-mono text-xs shadow-inner">
                      <div className="text-emerald-400 mb-2 font-bold">// Cryptographic Proof Sample</div>
                      <div className="text-slate-400 text-[11px] mb-3">Soroban Contract: CBG4...9H8A</div>
                      <div className="p-2 bg-slate-800 rounded border border-slate-700 break-all mb-2 text-emerald-300">
                        root_hash: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
                      </div>
                      <div className="text-slate-400 text-[10px]">Proof Verification Status: <span className="text-emerald-400 font-bold">100% MATCH (VALID)</span></div>
                    </div>
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
            <p className="landing-section-eyebrow">ENTERPRISE CAPABILITIES</p>
            <h2 className="landing-section-title">Everything You Need for Collaborative Finance</h2>
            <p className="landing-section-subtitle">
              Built from first principles for chamas, SACCOs, multi-member associations, and high-growth African enterprises.
            </p>
          </div>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-emerald-50 text-emerald-700">
                <Users size={22} />
              </div>
              <h3>Chama & SACCO Automation</h3>
              <p>Rotating merry-go-round (ROSCA) cycles, automatic turn disbursement, and table banking with customizable penalty rules.</p>
              <ul className="landing-feature-bullets">
                <li>Automated round rotation & pot collection</li>
                <li>Flat or reducing-balance table loans</li>
                <li>Strict anti-overpayment validations</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-blue-50 text-blue-700">
                <FileText size={22} />
              </div>
              <h3>Commercial Invoicing & AP/AR</h3>
              <p>Full lifecycle accounts receivable and payable. Issue KRA-compliant VAT invoices, credit notes, and 2-tier approval supplier bills.</p>
              <ul className="landing-feature-bullets">
                <li>Automated 16% VAT line-item allocation</li>
                <li>Supplier bill payment authorization</li>
                <li>Purchase requisitions with budget checks</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-emerald-50 text-emerald-700">
                <Landmark size={22} />
              </div>
              <h3>Authoritative Double-Entry Ledger</h3>
              <p>No shortcuts. Every transaction creates balanced debits and credits following GAAP/IFRS standards with contra-reversal support.</p>
              <ul className="landing-feature-bullets">
                <li>Real-time Trial Balance & Income Statement</li>
                <li>Multi-currency leg balancing (1040-FX-CLEARING)</li>
                <li>Strict immutability and audit logging</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-brand-50 text-brand-800">
                <Bot size={22} />
              </div>
              <h3>Agentic Treasury Copilot</h3>
              <p>Built-in autonomous AI financial intelligence. Run conversational inquiries on balances, detect anomalies, and audit reconciliation.</p>
              <ul className="landing-feature-bullets">
                <li>Instant collection rate & liability queries</li>
                <li>Automated reconciliation gap detection</li>
                <li>Policy compliance and risk flagging</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-amber-50 text-amber-700">
                <BarChart3 size={22} />
              </div>
              <h3>Budget Variance & Analytics</h3>
              <p>Track real-time spend across operational categories with automated threshold warnings and historical variance charts.</p>
              <ul className="landing-feature-bullets">
                <li>Category utilization tracking</li>
                <li>Overspend alert thresholds (80% / 100%)</li>
                <li>Collaborative financial health scoring</li>
              </ul>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box bg-cyan-50 text-cyan-700">
                <ShieldCheck size={22} />
              </div>
              <h3>Cryptographic Statement Proofs</h3>
              <p>Permanently anchor quarterly balance sheets and trial balances onto Stellar Soroban smart contracts for tamper-proof compliance.</p>
              <ul className="landing-feature-bullets">
                <li>Merkle tree root generation</li>
                <li>Cryptographic leaf verification</li>
                <li>Exportable audit-grade PDF vouchers</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-how-it-works">
        <div className="landing-container">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">EFFORTLESS ONBOARDING</p>
            <h2 className="landing-section-title">Up and Running in 3 Steps</h2>
            <p className="landing-section-subtitle">
              Transition your group or company from scattered spreadsheets to an enterprise-grade financial engine.
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
              <h4>Connect Rails & Team</h4>
              <p>Invite finance officers with role-based permissions (Approvers, Admins) and configure M-Pesa or PayShap rails.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-number">03</div>
              <h4>Automate & Verify</h4>
              <p>Collect dues, disburse loans, pay supplier bills, and let the double-entry engine balance your books in real time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="landing-pricing" id="pricing">
        <div className="landing-container">
          <div className="landing-section-header text-center">
            <p className="landing-section-eyebrow">TRANSPARENT PRICING</p>
            <h2 className="landing-section-title">Plans Scaled for Every Organization</h2>
            <p className="landing-section-subtitle">
              Start free with your community circle, or upgrade to enterprise rails for commercial operations.
            </p>
          </div>

          <div className="landing-pricing-grid">
            <div className="landing-pricing-card">
              <div className="pricing-badge">STARTER</div>
              <h3>Chama Circle</h3>
              <div className="pricing-price">
                <strong>Free</strong>
                <span>forever</span>
              </div>
              <p className="pricing-desc">Perfect for chamas, family funds, and community investment groups.</p>
              <ul className="pricing-features">
                <li><Check size={14} className="text-emerald-500" /> Up to 20 Members</li>
                <li><Check size={14} className="text-emerald-500" /> Rotating Merry-Go-Round</li>
                <li><Check size={14} className="text-emerald-500" /> Table Banking Loans</li>
                <li><Check size={14} className="text-emerald-500" /> M-Pesa Integration</li>
                <li><Check size={14} className="text-emerald-500" /> Basic Financial Reports</li>
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
              <p className="pricing-desc">For growing SACCOs, commercial SMEs, and formal trade associations.</p>
              <ul className="pricing-features">
                <li><Check size={14} className="text-emerald-500" /> Unlimited Members & Users</li>
                <li><Check size={14} className="text-emerald-500" /> Invoicing with KRA VAT</li>
                <li><Check size={14} className="text-emerald-500" /> 2-Tier Supplier Bill Approvals</li>
                <li><Check size={14} className="text-emerald-500" /> Full Double-Entry General Ledger</li>
                <li><Check size={14} className="text-emerald-500" /> PayShap & M-Pesa Auto-Sync</li>
                <li><Check size={14} className="text-emerald-500" /> AI Treasury Copilot</li>
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
              <p className="pricing-desc">For large SACCO federations, regional traders, and cross-border enterprises.</p>
              <ul className="pricing-features">
                <li><Check size={14} className="text-emerald-500" /> Multi-Entity Workspace Hierarchy</li>
                <li><Check size={14} className="text-emerald-500" /> Stellar Soroban Cryptographic Anchors</li>
                <li><Check size={14} className="text-emerald-500" /> Custom Multi-Currency FX Spreads</li>
                <li><Check size={14} className="text-emerald-500" /> Dedicated SLA & Bank Rails</li>
                <li><Check size={14} className="text-emerald-500" /> Custom Compliance & Audit Exports</li>
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
            <h2 className="landing-section-title">Got Questions? We’ve Got Answers.</h2>
          </div>

          <div className="landing-faq-accordion">
            {[
              {
                q: 'How does HESABU guarantee double-entry balance?',
                a: 'HESABU enforces transactional GAAP double-entry posting through an authoritative backend engine. Transactions cannot be saved unless Debits equal Credits for every currency leg. Overpayment checks and contra-reversal rules strictly preserve ledger integrity.'
              },
              {
                q: 'Which payment rails can I connect immediately?',
                a: 'Out of the box, HESABU connects to Safaricom M-Pesa (Kenya KES), PayShap & Instant EFT (South Africa ZAR), and Stellar Horizon (USDC/XLM cross-border settlement).'
              },
              {
                q: 'How does the Merry-Go-Round (ROSCA) rotation work?',
                a: 'When you create a circle, HESABU generates all turn orders. In each round, members contribute their share. The system verifies that the pot is 100% funded before enabling the payout to the scheduled beneficiary, automatically advancing to the next round.'
              },
              {
                q: 'What is a Cryptographic Statement Anchor?',
                a: 'Statement anchoring hashes your financial records into a Merkle tree and records the canonical root on Stellar Soroban smart contracts. This allows third-party auditors and regulators to verify that statements have never been altered.'
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
          <h2>Ready to Transform Your Financial Operations?</h2>
          <p>Join hundreds of chamas, cooperatives, and growing businesses managing treasury with mathematical precision.</p>
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
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Collaborative Financial Operations & Multi-Rail Treasury Platform. Engineered for African chamas, cooperatives, and commercial enterprises.
              </p>
              <div className="landing-footer-status">
                <span className="status-dot" /> All regional rails operational
              </div>
            </div>

            <div className="landing-footer-col">
              <h5>PRODUCT</h5>
              <a href="#chama">Chama & ROSCA</a>
              <a href="#commercial">Invoicing & AP/AR</a>
              <a href="#simulator">Treasury & FX</a>
              <a href="#rails">Payment Rails</a>
              <a href="#features">Smart Contracts</a>
            </div>

            <div className="landing-footer-col">
              <h5>SOLUTIONS</h5>
              <a href="#features">Investment Groups</a>
              <a href="#features">Agricultural SACCOs</a>
              <a href="#features">Cross-Border SMEs</a>
              <a href="#pricing">Enterprise Treasury</a>
            </div>

            <div className="landing-footer-col">
              <h5>SECURITY & LEDGER</h5>
              <a href="#anchor">GAAP Double-Entry</a>
              <a href="#anchor">Soroban Anchoring</a>
              <a href="#anchor">KRA VAT Compliance</a>
              <a href="#anchor">Audit Logs & Export</a>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <span>© {new Date().getFullYear()} HESABU Platform. All rights reserved.</span>
            <div className="flex gap-4 text-xs text-slate-400">
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
              <a href="#security">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

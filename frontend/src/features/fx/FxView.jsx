import React, { useState, useEffect } from 'react';
import { api, money } from '../../api';
import { PageHeader, Field } from '../shared/CommonComponents';

export function FxView({ workspaceId, currency, setNotice }) {
  const [rates, setRates] = useState({});
  const [fromCurr, setFromCurr] = useState('KES');
  const [toCurr, setToCurr] = useState('ZAR');
  const [calcAmount, setCalcAmount] = useState('');
  const [calcResult, setCalcResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/fx/rates').then(r => setRates(r.rates || {})).catch(() => {});
  }, []);

  async function handleConvert(e) {
    if (e) e.preventDefault();
    if (!calcAmount || parseFloat(calcAmount) <= 0) return;
    setBusy(true);
    try {
      const decimals = (fromCurr === 'UGX' || fromCurr === 'TZS') ? 0 : 2;
      const amountMinor = Math.round(Number(calcAmount) * Math.pow(10, decimals));
      const res = await api('/fx/convert', {
        method: 'POST',
        body: JSON.stringify({
          amountMinor,
          fromCurrency: fromCurr,
          toCurrency: toCurr,
          spreadPercentage: 0.005 // 0.5% spread
        })
      });
      setCalcResult(res);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="MULTI-CURRENCY TREASURY"
        title="Foreign Exchange & Cross-Border Rates"
        description="Real-time multi-market conversion rates across Kenya Shillings (KES), South African Rand (ZAR), USD, and regional currencies."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
        <div className="metric-card">
          <small>1 USD → KES</small>
          <strong>{rates.KES?.rateToUsd ? `KES ${rates.KES.rateToUsd.toFixed(2)}` : '—'}</strong>
        </div>
        <div className="metric-card">
          <small>1 USD → ZAR</small>
          <strong>{rates.ZAR?.rateToUsd ? `ZAR ${rates.ZAR.rateToUsd.toFixed(2)}` : '—'}</strong>
        </div>
        <div className="metric-card">
          <small>1 ZAR → KES (Cross)</small>
          <strong>
            {rates.KES && rates.ZAR ? `KES ${(rates.KES.rateToUsd / rates.ZAR.rateToUsd).toFixed(2)}` : '—'}
          </strong>
        </div>
        <div className="metric-card">
          <small>1 EUR → USD</small>
          <strong>{rates.EUR?.rateToUsd ? `$${(1 / rates.EUR.rateToUsd).toFixed(2)}` : '—'}</strong>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: '640px' }}>
        <div className="panel-heading">
          <div>
            <h2>Cross-Border Currency Calculator</h2>
            <p>Compute exact minor-unit conversions with institutional spread deduction</p>
          </div>
        </div>

        <form onSubmit={handleConvert} className="stack" style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="From Currency">
              <select value={fromCurr} onChange={e => setFromCurr(e.target.value)}>
                <option value="KES">KES - Kenyan Shilling</option>
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="UGX">UGX - Ugandan Shilling</option>
                <option value="TZS">TZS - Tanzanian Shilling</option>
              </select>
            </Field>
            <Field label="To Currency">
              <select value={toCurr} onChange={e => setToCurr(e.target.value)}>
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="KES">KES - Kenyan Shilling</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="UGX">UGX - Ugandan Shilling</option>
                <option value="TZS">TZS - Tanzanian Shilling</option>
              </select>
            </Field>
          </div>

          <Field label={`Amount to Convert in ${fromCurr}`}>
            <input type="number" step="0.01" required value={calcAmount} onChange={e => setCalcAmount(e.target.value)} placeholder="e.g. 10000.00" />
          </Field>

          <button className="primary" disabled={busy}>
            {busy ? 'Calculating...' : 'Calculate Institutional Rate'}
          </button>

          {calcResult && (
            <div style={{ background: '#f6f8fa', padding: '16px', borderRadius: '8px', marginTop: '12px', border: '1px solid #d0d7de' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="subtle">Mid-Market Cross Rate:</span>
                <b>1 {fromCurr} = {calcResult.baseRate} {toCurr}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="subtle">Spread Applied:</span>
                <span>{(calcResult.spreadPercentage * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', borderTop: '1px solid #d0d7de', paddingTop: '8px' }}>
                <span>Converted Payout:</span>
                <b style={{ color: '#0969da' }}>
                  {money(calcResult.targetAmountMinor, toCurr)}
                </b>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

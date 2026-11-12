import React from 'react';
import { Wallet, Receipt, Activity, Target } from 'lucide-react';
import { money } from '../../api';
import { PageHeader } from '../shared/CommonComponents';

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

export function BudgetVarianceView({ workspaceId, variance, currency }) {
  if (!variance?.categories?.length) {
    return (
      <>
        <PageHeader
          eyebrow="TREASURY DISCIPLINE"
          title="Budget vs Actual Variance"
          description="Track category allocations, operational spending, and prevent budget overruns."
        />
        <div style={{ textAlign: 'center', padding: '36px', color: '#7b8780' }}>
          No budget limits configured for this workspace yet.
        </div>
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

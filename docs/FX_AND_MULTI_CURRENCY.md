# HESABU Multi-Currency & Foreign Exchange Architecture

## 1. Overview
HESABU enables cross-border financial operations for diaspora chamas, international cooperatives, and East African regional SMEs. Members contributing in foreign currencies (USD, EUR, GBP) or regional peers (UGX, TZS) have their transactions converted cleanly into the workspace base currency (typically KES) with zero fractional penny leaks.

---

## 2. Integer Minor Unit Precision Model
Floating-point arithmetic in web applications introduces catastrophic rounding drift. HESABU strictly prohibits native floating-point representations for ledger balances.

Each supported currency is scaled to its official ISO minor unit:

| Currency | ISO Code | Minor Unit Scale | Divisor / Factor | Decimal Representation |
|---|---|---|---|---|
| Kenyan Shilling | KES | 2 (Cents) | 100 | KES 1,500.00 = 150000 |
| US Dollar | USD | 2 (Cents) | 100 | USD 50.00 = 5000 |
| Euro | EUR | 2 (Cents) | 100 | EUR 40.00 = 4000 |
| British Pound | GBP | 2 (Pence) | 100 | GBP 35.00 = 3500 |
| Ugandan Shilling | UGX | 0 (Whole) | 1 | UGX 100,000 = 100000 |
| Tanzanian Shilling | TZS | 0 (Whole) | 1 | TZS 50,000 = 50000 |

---

## 3. Cross-Rate Conversion Algorithm
1. Convert source amount from minor units into major units:
   ```
   sourceMajor = sourceAmountMinor / (10 ^ sourceDecimals)
   ```
2. Compute mid-market cross-rate relative to USD:
   ```
   midRate = ratesToUsd[target] / ratesToUsd[source]
   ```
3. Apply configurable liquidity buffer or spread percentage (e.g. 0.5%):
   ```
   effectiveRate = midRate * (1 - spreadPercentage)
   ```
4. Calculate target major amount and round to the nearest integer minor unit:
   ```
   targetMinor = Math.round(sourceMajor * effectiveRate * (10 ^ targetDecimals))
   ```

---

## 4. Time-Locked FX Quotes
To protect both the contributing member and the treasury from market slippage during bank transfer or mobile money confirmations:
- The system generates an FX quote with a cryptographically unique identifier (`fxq_...`).
- The rate is locked for exactly 15 minutes (`expiresAt = now + 15m`).
- Upon settlement within the validity window, the exact quote amount is posted to the double-entry journal.
- Expired quotes cannot be settled and require generating a fresh quote.

---

## 5. Endpoints
- `GET /api/fx/rates`: Active currency table and mid-market rates against USD.
- `POST /api/fx/convert`: Direct conversion simulation between any supported pair.
- `POST /api/workspaces/:id/fx/quote`: Authenticated generation of a 15-minute locked quote.
- `GET /api/fx/quotes/:quoteId`: Status verification for an existing quote.

# Change Log: Portfolio Menu Upgrade (v12) — Sub Tab Asset Intelligence System

## 1. New Architecture
The wealth portfolio tracking system has been refactored from a linear flat widget list to an advanced, multi-dimensional **Multi-Subtab Architecture**.
Within the **Assets Tab**, users can now switch between 7 top-tier wealth perspectives:
1. **Overview**: Key portfolio snap metrics, the ancient Babylonian Wisdome tablet, real-time insights, and data reconciliations.
2. **Allocation**: Bar chart composition detailing actual asset weights side-by-side with target percentages.
3. **Holdings**: Interactive Asset Inventory table complete with categorical additions, item mapping, and modification controls.
4. **Asset Ledger**: A multi-filtering event-driven ledger tracking deposits, extractions, trading earnings, cash distributions, and transfers.
5. **Diagnostics**: AI-driven heuristic scanner evaluating portfolio alignment, asset underweight/overweight exposures, cash drag, SWR metrics, and family safety index.
6. **Rebalance Center**: Gap evaluation grid detailing required capital adjustments alongside automated surplus routing recommendations.
7. **Asset Intelligence Workspace**: A premium, executive light-mode dashboard that synthesizes all metrics under an elegant Apple Finance-inspired light glassmorphism style.

---

## 2. Calculation Engine enhancements
- **Total Investable Assets**: Aggregates all institutional balances excluding primary residence, emergency stash, or vehicular capital.
- **Liquidity Ratio**: Calculates the percentage of High-Liquidity assets (Cash, Emergency Funds, Gold, RDPU) to guard against cash flow crunches:
  $$\text{Liquidity Ratio} = \frac{\text{Cash} + \text{Emergency Fund} + \text{RDPU} + \text{Emas}}{\text{Total Assets}}$$
- **Growth Ratio**: Formulates the velocity projection of compounding assets (Stocks, Crypto, Mutual Funds):
  $$\text{Growth Ratio} = \frac{\text{Saham} + \text{Crypto} + \text{RDPT} + \text{SBN}}{\text{Total Assets}}$$
- **SWR (Safe Withdrawal Rate) Alignment**: Bridges the Gap between total interest-generating holdings and the current recurring cost-of-living.

---

## 3. Diagnostics Engine Heuristics
- **Cash Drag**: Triggers a warning if local non-interest-earning Cash exceeds 20% of net worth.
- **Exposure Drag**: Warns if high-volatility Crypto exceeds 10% of total wealth.
- **Family Resilience Score**:
  $$\text{Score} = 100 - (15 \times \text{Weakness Count})$$
  Evaluated across 5 dimensions: Liquidity sufficiency, Growth rate, Cash Drag, Emergency backing, and Over-concentration.
- **Heuristic Quality Statuses**: Critical, Weak, Stable, Strong, Optimal.

---

## 4. Rebalance Engine Formulas
- **Allocation Delta**: Computes exact gaps and corrective capital flows:
  $$\Delta_i = \text{ActualValue}_i - (\text{TotalPortfolio} \times \text{TargetPercentage}_i)$$
- **Corrective Routing Recommendation**: Automatically generates actionable monthly cash injection advice to close asset delta deviations over a 3-month window.

---

## 5. Wealth Evolution Timeline Stages
- **Chaos Survival**: Total Assets < Rp10,000,000
- **Stability FIRE**: Rp10,000,000 to Rp50,000,000
- **Building FIRE**: Rp50,000,000 to Rp150,000,000
- **Coast FIRE**: Rp150,000,000 to Rp500,000,000
- **Stable Family Wealth**: Rp500,000,000 to Rp1,500,000,000
- **Lean FIRE**: Rp1,500,000,000 to Rp3,000,000,000
- **Full FIRE Family**: Assets exceeding Rp3,000,000,000

---

## 6. Migration & Sync Notes
- Data schema fields (liquidityLevel, riskLevel, notes, monthlyContribution) persist cleanly inside standard `actualAssets` list maps.
- Dedicated `assetTransactions` are automatically cached in local storage under the root tracking key and synced in real-time to Supabase securely.

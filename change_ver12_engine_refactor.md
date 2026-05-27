# Change Version 12 Engine Refactor - System Documentation

Our goal in this update was to completely decouple the layout of the user interface from the underlying mathematical, statistical, and compound-projecting calculators. By removing inline operations inside `App.tsx` and standard UI cards, the app transitions into an isolated, predictable, and fully testable financial execution engine.

---

## 1. Extracted Architecture & Engine Responsibilities

We established a specialized `/src/engines/` namespace. Each mathematical scope belongs to its individual engine file:

| Engine File Name | Category | Functional Responsibilities |
| :--- | :--- | :--- |
| **`utilityCalculators.ts`** | Core Helpers | Normalizes platform and asset categorizations; formats currency values with custom compaction (Rp Jt, Rp M). |
| **`incomeAllocationEngine.ts`** | Income Distribution | Groups monthly inflows dynamically; applies fixed, variable, and bonus rules with restriction configurations. |
| **`liabilityEngine.ts`** | Burdens & Debts | Summarizes bills and active installments; computes good vs. bad debt margins against overall monthly income. |
| **`budgetEngine.ts`** | Spending Limits | Coordinates total budgets; handles operational costs vs. savings transfers. |
| **`plannerEngine.ts`** | Plan & Inflation | Computes inflation ratios, Future Value targets, retirement milestones, and ages. |
| **`ledgerEngine.ts`** | Savings Ledger | Compiles deposits, goals (planned & reason-specific) with interactive progress markers, and withdrawal balances. |
| **`assetAllocationEngine.ts`** | Asset Grouping | Determines asset targets, emergency balances, and selected FIRE holdings. |
| **`rebalanceEngine.ts`** | Rebalancing Gaps | Flags deviations from target weight rules; suggests actions (Beli / Jual / Hold) per asset category. |
| **`portfolioEngine.ts`** | Portfolio Insights | Calculates risk layers, liquid metrics, and produces diagnostic recommendations. |
| **`kakeiboEngine.ts`** | Kakeibo Groupings | Aligns expenses to Japanese envelope values (Survival, Optional, Culture, Extra). |
| **`realizationEngine.ts`** | Budget Tracking | Analyzes operational leakages; maps expenditure efficiency grades (Optimized down to Critical). |
| **`analyticsEngine.ts`** | Historical Stats | Compiles historical series; tracks best/worst monthly net-flows. |
| **`financialFlowEngine.ts`** | Coordinating Flow | Coordinates general financial allocations and surplus-speed ratios. |
| **`recurringExpenseEngine.ts`** | Bills & Alerts | Checks upcoming due dates; alarms about overdue payments before penalties occur. |
| **`netWorthEngine.ts`** | Wealth Standing | Subtracts active liabilities from assets to produce liquid compounding standing. |

---

## 2. Shared Hooks & State Synchronization

To connect our static calculations cleanly into the React runtime, we introduced dedicated custom hooks within `/src/hooks`:

1. **`useFinancialFlow`**: Bridges month-specific incomes and security buffers to partition liquid funds.
2. **`useFireProjection`**: Computes the compounding path over 30 years and evaluates safety tiers.
3. **`usePortfolioHealth`**: Audits asset-mix exposures and supplies structured action directions.
4. **`usePlannerSummary`**: Resolves long-term retirement target timelines.
5. **`useRecurringExpenses`**: Keeps track of upcoming monthly bill balances.

---

## 3. Eliminated Duplications & Performance Wins

* **Single Source of Truth**: All components (`FinancialFlowEngine`, `WealthOSDashboard`, tab renderers) share identical calculation patterns rather than inventing custom sum filters and maps.
* **Memoization & Selectors**: React components call custom selector hooks which memoize calculation runs unless the absolute primitive references change in the store. This entirely guards the container from rendering stutter.
* **Normalized Memory**: Normalizers are standardly referenced, meaning slight variations in categories (`"saham"`, `"Saham "`, `"RD saham"`) map to unified entries before calculation.

---

## 4. Remaining Risks & Future Recommendations

* **Stale Local State**: High frequency data mutations must synchronize with localized caching strategies reliably. Our use of Zustand persistent keys completely isolates database syncing from calculations.
* **Infinite Rerenders**: Guard against state modifications in standard UI bodies. Keep all data additions inside the store operations.

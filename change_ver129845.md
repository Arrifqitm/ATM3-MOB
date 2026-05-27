# Architectural Audit & Decoupling Report (Version 129845)

This report details the audit, verification, and refactoring of the WealthOS Financial Core architecture. To prevent mathematical slippage, duplicate calculations, card redundancies, and stale derived states, we have decoupled all mathematical formulas from the visual React layer and consolidated them into a centralized calculation library.

---

## 1. Unified Ledger Classification Engine
The system enforces strict classification tags at the inflow and outflow layers:
```ts
classifyIncome(i) -> "fixed" | "variable" | "bonus"
classifyExpense(e) -> "fixed_bill" | "debt_liability" | "variable_spending" | "savings_movement" | "social_allocation"
```
*   **Income Categorization**: 
    - `"bonus"` triggers on descriptions containing `thr`, `gaji 13`, `gaji-13`, `bonus besar`, or type `bonus`.
    - `"variable"` triggers on descriptions containing `dinas`, `freelance`, `side`, `sampingan`, or type `extra`.
    - `"fixed"` acts as the fallback baseline (standard wages and salary).
*   **Leakage and Spent Realization Checks**:
    - **Savings Movements** are strictly excluded from spending analytics to prevent transfer/deposit noise from spoofing operational expenses.
    - **Zakat, Infaq, Shodaqoh (Social Allocation)** are properly exempted from discipline leakage scoring to reward philanthropic stability without marking it as luxury leakage.
    - **Real Spending** relates purely to actual operational paid expenses.

---

## 2. Income Allocation Engine
Given the collection of period incomes, current Emergency Fund balance ($E_{fund}$), and Emergency Target ($E_{target}$), the routing rules resolve allocations as follows:

$$\text{Emergency Fund Ratio } (R_{em}) = \min\left(2.0, \frac{E_{fund}}{E_{target}}\right)$$

### Underfunded Dynamic Redirection ($R_{em} < 1.0$)
When the emergency fund has a deficit, a dynamic savings boost ($S_{boost} = (1.0 - R_{em}) \times 15.0\%$) is scaled dynamically. To balance the ledger:
- Living and lifestyle rewards are decreased proportionally.
- Variable income triggers a steeper redirect to savings ($V_{boost} = (1.0 - R_{em}) \times 20.0\%$).

### Fully Funded Stage ($R_{em} \ge 1.0$)
When fully funded, savings buffers scale down by 50% for fixed income and 60% for variable income, and are immediately reallocated to wealth portfolio engines.

---

## 3. Realization Auditor & Spent Real Insight Engine
Spending efficiency and budget track calculations follow strict ratios:

$$\text{Spend efficiency} = \max\left(0, \min\left(100, (1 - \text{Ratio}_{\text{adj}}) \times 100 + 40\right)\right)$$

Where $\text{Ratio}_{\text{adj}}$ is computed excluding the manual flat social deductions so that charity remains isolated from spending discipline metrics:

$$\text{Ratio}_{\text{adj}} = \frac{\text{Total Operational Expense} - \text{Flat Social Deducts}}{\text{Effective Budget}}$$

Insights are calculated by sorting Kakeibo summaries continuously:
- **Highest Spending**: Resolved by sorting actuals in descending order.
- **Controlled Categories**: Pillars that have active budgets and whose spending remains below or equal to the plan.

---

## 4. Asset Allocation Engine
All asset holdings are systematically normalized:
$$\text{normalizeCategory}(C) \to C_{\text{normalized}}$$
Assets are categorized into `Dana Darurat`, `RDPU`, `RDPT`, `Saham`, `Emas`, `Crypto`, or `Cash`.
- **Full Emergency Fund**: Calculated as the combination of $\text{Dana Darurat} + \text{RDPU}$.
- **Liquid Capital**: Grouping of $\text{Cash} + \text{Dana Darurat} + \text{RDPU}$.

---

## 5. FIRE Projection Engine
Calculates FI numbers and years-to-target projection with monthly compound interest:

$$\text{FI Number} = \frac{\text{Annual Expenses}}{\text{Average Return Rate}}$$

$$\text{Effective Goal} = \begin{cases} 
      \frac{\text{FI Number}}{4} & \text{quarter mode} \\
      \frac{\text{FI Number}}{3} & \text{third mode} \\
      \dots \\
      \text{FI Number} & \text{full mode}
   \end{cases}$$

Years-to-target compounds recurring contributions with rate $r = \frac{\text{Average Return Rate}}{12}$:

$$A_{t} = (A_{t-1} + C_{monthly}) \times (1 + r)$$

This ensures that "Years to Target Main" and "Years to Target Combined" (including monthly surpluses) are projected with mathematical fidelity and loop protection.

---

### Architectural Consistency Verification Clearances
*   [Verified] Centralized Calculation Engine at `/src/lib/financialEngines.ts`.
*   [Verified] Eliminated duplicated mappings and classes inside `/src/components/tabs/IncomeTab.tsx`.
*   [Verified] Integrated `/src/App.tsx` state derivation with `calculateIncomeAllocation`.
*   [Verified] No redundant or overlapping metrics on individual view screens.

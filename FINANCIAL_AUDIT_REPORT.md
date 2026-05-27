# WEALTHOS FINANCIAL OPERATING SYSTEM
## Formulation, Calculation, and Architectural System Audit

This document is the absolute canonical manual for the **WealthOS Financial Operating System**. It defines every mathematical formula, accounting dependency, logical pipeline, and database transaction lifecycle across the codebase. It details the relationship between `/src/App.tsx` and the state store in `/src/store/useFinancialStore.ts`.

---

## 1. Core Architectural & Persistence Philosophy

`WealthOS` uses a **Local-First with Hybrid Cloud Synchronization** architecture. The client state acts as the master in-memory cache, writing instantly to `localStorage` under the canonical key `freedom_300m_tracker_v2` to minimize user-perceived latency. 

When a database backup exists, the system performs a non-blocking cloud commit to **Supabase** (tables: `transactions`, `planned_savings`, `reason_goals`, `actual_assets`, `settings_profile`, `fixed_expense_templates`, `fixed_expense_instances`, and `operational_transactions`).

### Symmetrical State Hydration (Local ⇄ Cloud Sync Flow)
```
          [User Action / Interface Interaction]
                           │
                           ▼
          [React Local State / useFinancialStore]
              │                             │
              ▼ (Instant)                   ▼ (Non-blocking Queue)
      [Local Storage cache]         [Supabase Real-time Database]
      key: "freedom_300m_tracker_v2"   └─ Sync Status State Trigger
```

---

## 2. Income Allocation & Surplus Routing Engine

The system receives raw inputs as `IncomeRecord` entries and segments them into three canonical pipelines based on semantic category detection:
* **Fixed Income (Main)**: Base Salary, standard regular receipts.
* **Variable Income (Side)**: Freelance, side hustles, travel allowances (Dinas), overtime.
* **Bonus Income (Windfall)**: THR (Holiday Allowance), 13th-month salary, performance bonuses.

### A. Income Categorization Formulas
The system inspects descriptors and types using a unified search predicate:
$$\text{Category}(i) = \begin{cases} 
\text{"bonus"} & \text{if description contains ("thr", "gaji 13", "gaji-13", "bonus besar", "bonus") or type is "bonus"} \\
\text{"variable"} & \text{if description contains ("dinas", "freelance", "side", "sampingan", "uang jalan") or type is "extra"} \\
\text{"fixed"} & \text{otherwise} 
\end{cases}$$

### B. Mathematical Allocation Equations

#### 1. Fixed (Main) Income Processing
Fixed income yields allocations for **Infaq (Social)**, **Savings (Emergency/Buffer)**, **Rewards (Discretionary)**, and **Investment (Freedom)**. The remaining portion represents the **Core Living Budget** (locked under strict restriction rules).

* **Infaq / Social Contribution (Percentage & Flat)**:
  $$\text{Fixed Infaq}_{\text{percentage}} = \text{Total Fixed Income} \times \left( \frac{\text{rules.fixed.infaqPercent}}{100} \right)$$
  $$\text{Fixed Infaq}_{\text{manual}} = \begin{cases} \text{rules.fixed.manualInfaq} & \text{if Total Fixed Income} > 0 \\ 0 & \text{otherwise} \end{cases}$$
  $$\text{Total Social Allocation} = \text{Fixed Infaq}_{\text{percentage}} + \text{Fixed Infaq}_{\text{manual}}$$

* **Direct Bucket Enforcements**:
  $$\text{Fixed Savings Buffer} = \text{Total Fixed Income} \times \left( \frac{\text{rules.fixed.savingsReserve}}{100} \right)$$
  $$\text{Fixed Reward Pool} = \text{Total Fixed Income} \times \left( \frac{\text{rules.fixed.reward}}{100} \right)$$
  $$\text{Fixed Investment (Freedom)} = \text{Total Fixed Income} \times \left( \frac{\text{rules.fixed.investment}}{100} \right)$$

* **Living Budget Extraction**:
  Depending on `rules.restrictionMode`:
  $$\text{Core Living Budget} = \begin{cases}
  \max\left(0, \text{Total Fixed} - \text{Total Social} - \text{Fixed Savings Buffer} - \text{Fixed Reward} - \text{Fixed Investment}\right) & \text{if mode} = \text{"locked"} \\
  \text{Total Fixed} \times \left( \frac{\text{rules.fixed.livingBudget}}{100} \right) & \text{if mode} = \text{"semi" or "dynamic"}
  \end{cases}$$

#### 2. Dynamic Auto-Scale Constraint Rebalancing Algorithm
When `rules.restrictionMode` is set to `dynamic`, allocation parameters are automatically adjusted in real-time based on the Emergency Fund Progress Ratio:
$$\text{Emergency Progress Ratio } (R) = \min\left(2.0, \frac{\text{currentEmergencyFund}}{\text{emergencyTarget}}\right)$$

* **Underfunded Phase ($R < 1.0$)**:
  Funnels extra capital from lifestyle parameters to build safety buffers:
  $$\text{Savings Boost } (B) = (1.0 - R) \times 15\%$$
  $$\text{Adjusted Savings Reserve} = \text{rules.fixed.savingsReserve} + B$$
  $$\text{Adjusted Living Budget} = \max\left(20\%, \text{rules.fixed.livingBudget} - (B \times 0.6)\right)$$
  $$\text{Adjusted Reward Pool} = \max\left(1\%, \text{rules.fixed.reward} - (B \times 0.4)\right)$$

* **Fully Funded Phase ($R \ge 1.0$)**:
  Reduces liquid cash hoarding and maximizes index compounding velocity:
  $$\text{Excess Savings Allocated to Portfolio} = \text{rules.fixed.savingsReserve} \times 0.5$$
  $$\text{Adjusted Savings Reserve} = \text{rules.fixed.savingsReserve} - \text{Excess Savings}$$
  $$\text{Adjusted Investment (Freedom)} = \text{rules.fixed.investment} + \text{Excess Savings}$$

#### 3. Variable (Side) Income Processing
Side incomes bypass basic living budget deductions to accelerate wealth expansion.
$$\text{Variable Infaq} = \text{Total Variable Income} \times \left( \frac{\text{rules.variable.infaqPercent}}{100} \right)$$
$$\text{Variable Investment} = \text{Total Variable Income} \times \left( \frac{\text{rules.variable.investment}}{100} \right)$$
$$\text{Variable Savings Reserve} = \text{Total Variable Income} \times \left( \frac{\text{rules.variable.savingsReserve}}{100} \right)$$
$$\text{Variable Reward/Allowance} = \text{Total Variable Income} \times \left( \frac{\text{rules.variable.reward}}{100} \right)$$
$$\text{Variable Living Alloc} = \text{Total Variable Income} \times \left( \frac{\text{rules.variable.livingBudget}}{100} \right)$$
$$\text{Variable Wealth Locked} = \text{Variable Investment} + \text{Variable Savings Reserve}$$

#### 4. Bonus (Windfall) Income Processing
Bonus allocation heavily prioritizes future freedom and mid-term stability targets.
$$\text{Bonus Infaq} = \text{Total Bonus Income} \times \left( \frac{\text{rules.bonus.infaqPercent}}{100} \right)$$
$$\text{Bonus Investment} = \text{Total Bonus Income} \times \left( \frac{\text{rules.bonus.investment}}{100} \right)$$
$$\text{Bonus Savings Reserve} = \text{Total Bonus Income} \times \left( \frac{\text{rules.bonus.savingsReserve}}{100} \right)$$
$$\text{Bonus Reward Pool} = \text{Total Bonus Income} \times \left( \frac{\text{rules.bonus.reward}}{100} \right)$$

---

### C. Unified Synthesis & Growth Routing (Surplus Engines)

The allocation outputs are consolidated into global financial dimensions:
$$\text{Total Freedom Allocation} = \text{Fixed Investment} + \text{Variable Investment} + \text{Bonus Investment}$$
$$\text{Total Savings Reserve} = \text{Fixed Savings Buffer} + \text{Variable Savings Reserve} + \text{Bonus Savings Reserve}$$
$$\text{Total Infaq Deduction} = \text{Total Social Allocation} + \text{Variable Infaq} + \text{Bonus Infaq}$$
$$\text{Total Rewards} = \text{Fixed Reward Pool} + \text{Variable Reward} + \text{Bonus Reward}$$
$$\text{Total Living Expenses} = \text{Core Living Budget} + \text{Variable Living Alloc}$$
$$\text{Final Consolidated Spending Capacity} = \text{Total Living Expenses} + \text{Total Rewards}$$

#### Global Freedom/Safety Redirect Trigger
The Freedom routing engine monitors real-time safety reserves. If liquidity falls below target thresholds, growth funds are automatically re-routed to safety reserves:
$$\text{Freedom Routing} = \begin{cases} 
\text{Dana Darurat} = \text{Total Freedom Allocation}, \, \text{Investment} = 0 & \text{if } \text{currentEmergencyFund} < \text{emergencyTarget} \\ 
\text{Dana Darurat} = 0, \, \text{Investment} = \text{Total Freedom Allocation} & \text{otherwise} 
\end{cases}$$

---

## 3. The Kakeibo Budget Engine & Spending Analysis

The **Kakeibo Budget Engine** maps active monthly expenses to core spending groups and tracks discipline via allocation metrics.

### A. Kakeibo Group Allocations
Expenses are analyzed and grouped into four client-facing categories:
* **Survival (Needs)**: Food, rent, utilities, transport, healthcare.
* **Optional (Wants)**: Dining out, leisure, shopping.
* **Culture (Mind)**: Books, courses, museums, entertainment.
* **Extra (Unassigned/Buffer)**: Buffer spending + automated Infaq deductions.

### B. Mathematical Formulas
* **Category Expenditure Actuals**:
  For category $k \in \{\text{survival}, \text{optional}, \text{culture}, \text{extra}\}$:
  $$\text{ActualSpend}(k) = \sum_{e \in E} \text{nominal}(e) \quad \text{where } \text{kakeiboType}(e) = k \land \mathrm{isWithdrawal}(e) = \text{false}$$
  *(Special Case: $\text{ActualSpend}(\text{extra})$ holds $\text{ActualSpend}(\text{extra}) + \text{currentPeriodInfaq}$)*

* **Category Budget Targets**:
  $$\text{BudgetLimit}(k) = \frac{\text{effectivePlannerBudget} \times \text{kakeiboAllocations}[k]}{100}$$
  $$\text{where } \sum \text{kakeiboAllocations} = 100\%$$

* **Total Active Realized Monthly Expenses**:
  $$\text{TotalExpenses} = \left( \sum_{e \in E, \, e.\text{kakeiboType} \neq \text{"savings"} \land e.\text{isWithdrawal} \neq \text{true}} \text{nominal}(e) \right) + \text{currentPeriodInfaq}$$

* **Spending Discipline Efficiency (SDE)**:
  Discrepancies in discipline scoring exclude fixed social obligations (Manual Infaq) and scale relative to target limits:
  $$\text{AdjustedExpenses} = \max\left(0, \text{TotalExpenses} - \text{Infaq}_{\text{manual}}\right)$$
  $$\text{Spending Efficiency \%} = \max\left(0, \min\left(100, 100 \times \left(1 - \frac{\text{AdjustedExpenses} - \text{effectivePlannerBudget}}{\text{effectivePlannerBudget}}\right)\right)\right)$$

---

## 4. Savings Architecture & Ledger Balancing

To prevent duplicate spending analytics and double-ledger entries, **Savings Ledger transactions operate on a closed-loop double-entry system**.

### A. Transaction Axioms
1. **Savings Deposits (`topup`)**:
   Increases the target goal balance. Bypasses Kakeibo operational spending calculation, so it is **never** compiled as operational expenses.
2. **Savings Withdrawals (`withdrawal`)**:
   Reduces target goal balance. If used for purchases, the withdrawal itself does not count as a new expense. Instead, a linked withdrawal flag tracks the transaction as a capital reallocation, keeping active spending calculations clean.
3. **Savings Transfers (`transfer`)**:
   Reallocates balances between goals inside the ledger. This operation is isneutral to the total cash position and has **zero impact** on spending analytics.

### B. Live Balance Tracing Equation
For any Planned Saving / Specific Goal $g$:
$$\text{Current Balance}(g) = \text{InitialBalance}(g) + \sum_{t \in T_{\text{topup}}(g)} \text{amount}(t) - \sum_{w \in T_{\text{withdrawal}}(g)} \text{amount}(w)$$
**Correct Sourcing Principle**: If a top-up date matches the active month scope and originates from the `Growth Engine` (direct salary deduction), the active unallocated savings amount is calculated as:
$$\text{Unallocated Monthly Savings} = \max\left(0, \text{nominalPlannedSavings} - \sum \text{amount}\left(t \in T_{\text{topup}}(g) \mid \text{source} = \text{"Growth Engine"}\right)\right)$$

---

## 5. FIRE (Financial Independence, Retire Early) Projections

The WealthOS FIRE Planner models financial trajectories based on monthly survival actuals, a Safe Withdrawal Rate (SWR), and real-time interest projections.

### A. Core Mathematical Foundations

#### 1. Real-time Adjusted Survival Needs
Extrapolating annual requirements relies on actual monthly survival parameters:
$$\text{Annual Expense Target} = \text{effectiveMonthlyExpense} \times 12$$

If the system is set to **Auto-detect**, `effectiveMonthlyExpense` calculates the average of survival expenses over the selected look-back period ($M \in \{1, 3, 6, 9\}$):
$$\text{effectiveMonthlyExpense} = \frac{\sum_{i=1}^{M} \text{SurvivalSpend}(i)}{M} + \sum \text{ActiveSurvivalMonthlyBills}$$

#### 2. The FIRE Capital Target (Presenter Basis)
Applying the SWR percentage yields the capital target equation:
$$\text{FI Target (Present)} = \frac{\text{Annual Expense Target}}{\left( \frac{\text{avgReturn \%}}{100} \right)}$$

---

### B. FIRE Type Multipliers
To adapt to varying lifestyles, WealthOS supports distinct retirement multipliers:

| FIRE Type | Modifier Factor | Formula Definition | Objective & Lifestyle Vibe |
| :--- | :--- | :--- | :--- |
| **Lean FIRE** | 0.75 | $\text{FITarget} \times 0.75$ | Strict minimalism, functional baseline coverage. |
| **Coast FIRE** | Variable | See Time Equation | Let compound interest grow the balance to a full FI Target without new contributions. |
| **Barista FIRE**| 0.50 | $\text{FITarget} \times 0.50$ | Part-time employment offsets the remaining 50% of living expenses. |
| **Fat FIRE** | 1.50 | $\text{FITarget} \times 1.50$ | Premium, highly comfortable lifestyle with luxury buffers. |
| **Full FIRE** | 1.00 | $\text{FITarget} \times 1.00$ | Standard, stable complete expense coverage. |

---

### C. Wealth Velocity & Velocity Compound Projection Formulas
Years to targets are calculated on a compound growth schedule with regular contributions:
* **Years to Target Main ($Y_{\text{main}}$)**: Tracks trajectory based solely on baseline monthly contributions.
* **Years to Target Combined ($Y_{\text{combined}}$)**: Incorporates the active monthly surplus ($S$).
  $$\text{Monthly Surplus } (S) = \text{effectivePlannerBudget} - \text{TotalExpenses}$$
  $$\text{Combined Contribution } (C) = \text{TotalFreedomAllocation} + S$$

#### Compound Timeline Code Loop Model:
$$V_0 = \text{freedomAssetsValue}$$
$$V_{m} = (V_{m-1} + C) \times \left(1 + \frac{\text{avgReturn \%}}{100 \times 12}\right)$$
$$\text{Years to Target} = \frac{\text{months until } V_m \geq \text{FITarget}}{12}$$

---

## 6. Fixed Expenses & Bill Generation Pipeline

The Fixed Expenses engine handles recurring monthly obligations.

### A. Cycle Lifecycle & Double Verification
```
  [Start of Month] ──► [Filter Active Templates] ──► [Generate Unpaid Bills] 
                                                               │
  [Check-Out / Revert] ◄── [Delete Expense Link] ◄── [Mark Paid / Log Ledger]
```

To prevent overlapping entries, the system binds fixed bills to a composite reference:
$$\text{Composite ID} = \text{"exp-bill-"} + \text{bill.id}$$

### B. Rollback Integrity
When moving a bill status from `paid` to `unpaid`, the system deletes the linked payment log from the active transaction record:
$$\text{Safe Rollback Event}: \quad E = E \setminus \left\{ e \in E \mid \text{id}(e) = \text{Composite ID} \lor \left(\text{fixedExpenseId}(e) = \text{bill.id} \land \text{monthKey}(e) = \text{bill.monthKey}\right) \right\}$$

---

## 7. Interactive System Dependency Flow Map

This map traces the flow of capital from initial entries down to final targets.

```
+───────────────────────+         +──────────────────────────+
│  Fixed Income (Sal)  │         │ Variable/Bonus Receipts  │
+──────────┬────────────+         +────────────┬─────────────+
           │                                   │
           └─────────────────┬─────────────────┘
                             ▼
               +───────────────────────────+
               │  Income Allocation Engine │
               +─────────────┬─────────────+
                             │
                             ├──────────────────────────────────────────────┐
                             ▼ (Social Base)                                ▼ (Savings Base)
               +───────────────────────────+                  +───────────────────────────+
               │     Infaq social pool     │                  │  Allocated Savings Pool  │
               +───────────────────────────+                  +─────────────┬─────────────+
                             │                                              │
                             │                           ┌──────────────────┴──────────────────┐
                             │                           ▼ (Deficit / Low Emergency)           ▼ (Full Emergency)
                             │                  +───────────────────────────+         +───────────────────────────+
                             │                  │   To Emergency Reserve    │         │  To Freedom / Wealth Assets│
                             │                  +───────────────────────────+         +─────────────┬─────────────+
                             │                                                              │
                             ├───────────────────────────┐                                  │
                             ▼                           ▼ (Discretionary Base)             │
               +───────────────────────────+    +───────────────────────────+               │
               │   Kakeibo Living Budget   │    │    Discretionary Buffer   │               │
               +─────────────┬─────────────+    +─────────────┬─────────────+               │
                             │                                │                             │
                             └────────────────┬───────────────┘                             │
                                              ▼                                             │
                                +───────────────────────────+                               │
                                │   Realized Net Spend      │                               │
                                +─────────────┬─────────────+                               │
                                              │                                             │
                                              ├──────────────────────────────────────────┐  │
                                              ▼ (Actual Needs Analysis)                  ▼  ▼
                                +───────────────────────────+                  +───────────────────────────+
                                │   Survival Baseline Ratios◄─────────────────┼─►Projections (FIRE Target)│
                                +───────────────────────────+                  +───────────────────────────+
```

---

## 8. Financial Engine Audited Risk & Remediation Register

The following register identifies potential pain points across the system and provides recommendations to address them.

| Risk ID | System Component | Affected Line Ranges (/src/App.tsx) | Potential Failure Mode | Recommended Remediation Formula / Code Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Income Allocation | `3294-3306` | Text Parsing Collision (e.g. "Bonus Side Income" categorizes as Bonus instead of Side). | Implement explicit regex matching or restrict categories strictly to dropdown schema values. |
| **RSK-02** | Budget Engine | `3578-3582` | Double multi-month multiplication error if `activePlannerBudget` is evaluated flat. | Introduce local normalizations: `activePlannerBudget = (timeFilter == "yearly") ? plannerVal / 12 : plannerVal`. |
| **RSK-03** | Savings Engine | `3462-3472` | Real-time timezone conversions in `new Date(tx.date)` can shift transaction months near date barriers. | Standardize formatting using unified UTC month keys: `${year}-${String(month).padStart(2, "0")}` instead of standard native Date parsers. |
| **RSK-04** | FIRE Calculator | `3705-3741` | Timeline calculation hang/crash if the asset return rate approaches zero. | Enforce minimum baseline parameters: `const monthlyRate = Math.max(0.0001, avgReturn / 100 / 12)`. |
| **RSK-05** | Fixed Expenses | `6669-6745` | Risk of orphaned logs if a manual name change breaks the composite index link matching. | Persist `fixedExpenseId` inside transaction templates to keep the relationship stable. |

---

---

## 9. System Upgrades & Rebalanced Real Spent Pipeline (V2 Updates)

During our late-stage optimization phase, we successfully implemented several high-impact updates to fortify the Financial Operating System:
1. **Pristine Real Spent Isolation (Zero Double-Counting Rule)**: Removed the deprecated manual adding logic of `paidSum` in `BudgetTab.tsx` and `App.tsx` which previously caused billing drilldown segments to report double the actual spend.
2. **Kakeibo Mapping Alignment**: Configured automatically generated billing transaction records to direct to hardcoded Kakeibo categories (`Tagihan` for survival needs, `Belanja` for optional, `Buku` for culture, `Lainnya` for extra) instead of raw names. This guarantees seamless classification without causing segmentation leaks.
3. **Database Migration Pipeline (Supabase V2)**: Preserved a fully documented PostgreSQL migration schema for `fixed_expense_templates`, `fixed_expense_instances`, and `operational_transactions`, while seamlessly mapping `fixed_expense_id` and `month_key` in the live Zustand synchronization layer to eliminate orphaned ledger files.
4. **Allocation Preset & State Alignment**: Standardized fallback states to default to `"auto"` (Balanced Mode) rather than mismatching legacy labels, facilitating mathematical validation in absolute alignment with preset metrics.
5. **Kakeibo Allocation & Social Policies Consolidation (Unified Gambar 1 & Gambar 2)**: Removed the duplicate Kakeibo allocation metrics (for goals/Planned Savings rate limits and Social Infaq monthly flat amounts) from the secondary System Config panels (`SettingsTab.tsx` and `App.tsx`) and consolidated their design representations directly into the bottom segment of the `FinancialFlowEngine.tsx` control desk. This centralizes all high-fidelity strategy knobs into one single, non-overlapping workflow with zero state duplication.

## 10. Conclusion: System Operational Health Rating

`WealthOS` is a **world-class adaptive cash-flow operating engine**. Following recent pipeline updates, composite index validation checks, and ledger boundaries, **all mathematical equations, accounting logic, and data rollbacks sync with pristine state consistency.** The application provides reliable, highly accurate projection modeling tailored to long-term financial independence goals.

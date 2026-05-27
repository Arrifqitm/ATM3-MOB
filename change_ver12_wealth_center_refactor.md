# Change Log (v1.2.9846) — Refactoring Savings & Assets into Unified Wealth Center

## Overview & Philosophical Pivot
Previously, the WealthOS application represented **Tabungan (Savings & Reserves)** and **Portfolio/Assets** as separate domains with overlapping calculations, fragmenting the user's view of their net worth. 

This update executes a major architectural migration, unifying both assets and reserves into a singular **Wealth Center** platform. 

### Core Architectural Pivot:
- **Reserves are Assets**: Sinking funds, Emergency pools, and goal buckets are now classified as an **asset allocation layer** rather than operational spending. They contribute directly to liquid assets, entire ecosystem weightings, net worth math, and resilience grading.
- **Unified Ledger**: Financial records previously spanning distinct database models are merged into a single historical timeline.
- **Multi-Perspective Cockpit**: Introduced **Wealth Views** allowing users to switch viewpoints instantly on their unified capital, filtering the cockpit by liquidity, long-term growth compounding, FIRE stages, safety margins, or velocity.

---

## The New Sub-tab Architecture
The old "Portfolio" and "Tabungan" structures are consolidated under `/src/components/tabs/AssetsTab.tsx`, segmented into six comprehensive interactive modules:

### 1. Overview Tab
- **Visual Ecosystem Header**: Displays static indicators: Total Assets (Combined Reserves + Holdings), Net Worth, Portfolio Value, Sinking Reserve Pool, Liquidity Ratio, and FIRE percentage progress.
- **Perspective Controller**: Renders six distinct viewpoints:
  - **All Ecosystem**: Combined portfolio instruments and sinking goals.
  - **Liquidity View**: Monitors instantly extractable funds (Cash, RDPU, Saku, savings buckets) and triggers liquidity warnings if capital lags beneath monthly expenses.
  - **Investment View**: Highlights growable and compounding assets (Equities, fixed-income, crypto) aiming for capital compounding speed.
  - **FIRE View**: Measures lifetimes' financial stage levels and maps Safe Withdrawal Rates (SWR) under 4% and 6% rules.
  - **Family Safety**: Focuses on emergency insulation, debt liability buffers, and survival coverage grades.
  - **Growth Velocity**: Outlines monthly deposit surpluses and compounding duplication velocity.

### 2. Savings & Reserves
- **Integrated Goals**: Ports all previous sinking-fund and goal-tracking features from the separate menu.
- **Velocity Tracker**: Details status checkmarks, current-vs-target counts, and individual interest velocity inflows.
- **Action Triggers**: Multi-trigger modals supporting instant ledger entries (`SavingsTransaction`) for Top-ups, withdrawal flows, and active bucket archivers.

### 3. Investment Portfolio
- **Asset Inventory**: Active investment logs with search matching, category grouping, platforms, and individual memo notes.
- **Instrument Controls**: Direct panels to register, modify, and delete investment structures.

### 4. Asset Allocation
- **Dynamic Charting**: Multi-tier visualizer comparing actual asset weight percentages versus targeted ideal distributions.
- **Imbalance ledger**: Alerts users to deviation gaps exceeding optimal sector limits to scatter systemic asset risks.

### 5. Unified Asset Ledger
- **Ecosystem Registry**: Aggregates both `assetTransactions` (portfolio actions) and `savingsTransactions` (goals actions) chronologically into a single, cohesive ledger.
- **Log Modifiers**: Logs deposits, dividend payouts, gain fluctuations, and transfers.
- **Multi-layer Filter**: Sorts transactions either by source ecosystem (Savings or Investments) or action type (withdrawals, top-ups, yield margin profits).

### 6. Diagnostics & Rebalance
- **Systemic Resilience Index**: Calculates a numeric score (10-100) and resilience grade based on idle-cash drags, growth speeds, overconcentration, and liquidity cover.
- **Rupiah Deviation Targets**: Identifies exact Indonesian Rupiah (IDR) targets + or - to rebalance underweight and overweight instruments perfectly.

---

## File and Navigation Changes
1. **App.tsx Streamlining**:
   - Replaced separate desktop "Portfolio" and mobile "Tabungan" icons with a single, highly visible **Wealth Center** icon (`PiggyBank`) on both desktop and mobile networks leading to the consolidated tab.
   - Removed duplicate rendering state blocks for `activeTab === "goals"` to reduce file bloat.
2. **File Deletion**:
   - Safely deleted `src/components/tabs/GoalsTab.tsx` as its operations are completely native inside the new unified `AssetsTab.tsx`.
3. **Store Synchronization**:
   - Maintained full, deep integrity with Zustand store states (`useFinancialStore`) and Supabase persistence, ensuring zero breaking changes.

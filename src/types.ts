export interface IncomeRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "gaji" | "tukin" | "extra" | "uangMakan" | "bonus";
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  nominal: number;
  category: string;
  kakeiboType: "survival" | "optional" | "culture" | "extra" | "savings";
  linkedGoalId?: string;
  isWithdrawal?: boolean;
  paymentSource?: "Budget" | "Alasan Tertentu";
  savingsSource?: "Growth Engine" | "Sumber Lain";
  fixedExpenseId?: string;
  monthKey?: string;
}

export interface FinancialSettings {
  emergencyTarget: number;
  emergencyFundThreshold?: number;
  financialFlowRules?: {
    fixed: {
      infaqPercent: number;
      manualInfaq: number;
      savingsReserve: number;
      reward: number;
      investment: number;
      livingBudget: number;
    };
    variable: {
      infaqPercent: number;
      investment: number;
      savingsReserve: number;
      reward: number;
      livingBudget: number;
    };
    bonus: {
      infaqPercent: number;
      investment: number;
      savingsReserve: number;
      reward: number;
    };
    restrictionMode: "locked" | "dynamic";
    mode: "auto" | "manual";
  };
}

export interface LiteSettings {
  emergencyTarget: number;
  currentEmergencyFund: number;
  financialFlowRules: any;
}

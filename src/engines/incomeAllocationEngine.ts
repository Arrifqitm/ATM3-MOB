import { IncomeRecord, FinancialSettings } from "../types";

export interface IncomeRoutingOutput {
  categories: {
    fixed: number;
    variable: number;
    bonus: number;
  };
  allocations: {
    social: number;
    savings: number;
    freedom: number;
    living: number;
    reward: number;
  };
  activeRules: {
    fixed: any;
    variable: any;
    bonus: any;
  };
  unallocated: number;
  emergencyRatio: number;
}

export function getIncomeCategory(i: IncomeRecord): "fixed" | "variable" | "bonus" {
  const desc = (i.description || "").toLowerCase();
  const type = i.type || "";
  
  if (
    desc.includes("thr") ||
    desc.includes("gaji 13") ||
    desc.includes("gaji-13") ||
    desc.includes("bonus besar") ||
    (desc.includes("bonus") && !desc.includes("side")) ||
    type === "bonus"
  ) {
    return "bonus";
  }
  if (
    desc.includes("dinas") ||
    desc.includes("freelance") ||
    desc.includes("side income") ||
    desc.includes("side") ||
    desc.includes("uang jalan") ||
    desc.includes("sampingan") ||
    type === "extra"
  ) {
    return "variable";
  }
  return "fixed";
}

export function runIncomeAllocationEngine(
  incomes: IncomeRecord[],
  settings: FinancialSettings,
  currentEmergencyFund: number
): IncomeRoutingOutput {
  const fixedIncoming = incomes
    .filter((i) => getIncomeCategory(i) === "fixed")
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const variableIncoming = incomes
    .filter((i) => getIncomeCategory(i) === "variable")
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const bonusIncoming = incomes
    .filter((i) => getIncomeCategory(i) === "bonus")
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const rules = settings.financialFlowRules || {
    fixed: { infaqPercent: 2.5, manualInfaq: 214000, savingsReserve: 10, reward: 5, investment: 25, livingBudget: 57.5 },
    variable: { infaqPercent: 2.5, investment: 40, savingsReserve: 15, reward: 15, livingBudget: 27.5 },
    bonus: { infaqPercent: 2.5, investment: 50, savingsReserve: 20, reward: 27.5 },
    restrictionMode: "locked",
    mode: "auto",
  };

  const activeFixed = { ...rules.fixed };
  const activeVariable = { ...rules.variable };
  const activeBonus = { ...rules.bonus };

  const eTarget = Number(settings.emergencyTarget) || 5000000;
  const emergencyRatio = eTarget > 0 ? Math.min(2.0, currentEmergencyFund / eTarget) : 1.0;

  if (rules.restrictionMode === "dynamic") {
    if (emergencyRatio < 1.0) {
      const deficit = 1.0 - emergencyRatio;
      const savingsBoost = deficit * 15.0;
      
      const originalLiving = rules.fixed.livingBudget || 57.5;
      const originalReward = rules.fixed.reward || 5;
      const totalPullable = originalLiving + originalReward;

      if (totalPullable > 0) {
        const livingPull = Math.min(savingsBoost * 0.6, Math.max(0, originalLiving - 20.0));
        const rewardPull = Math.min(savingsBoost - livingPull, Math.max(0, originalReward - 1.0));
        
        activeFixed.savingsReserve = parseFloat((rules.fixed.savingsReserve + (livingPull + rewardPull)).toFixed(2));
        activeFixed.livingBudget = parseFloat((originalLiving - livingPull).toFixed(2));
        activeFixed.reward = parseFloat((originalReward - rewardPull).toFixed(2));
      }

      const vOriginalLiving = rules.variable.livingBudget || 27.5;
      const vOriginalReward = rules.variable.reward || 15;
      const vTotalPullable = vOriginalLiving + vOriginalReward;
      const vSavingsBoost = deficit * 20.0;

      if (vTotalPullable > 0) {
        const vLivingPull = Math.min(vSavingsBoost * 0.5, Math.max(0, vOriginalLiving - 10.0));
        const vRewardPull = Math.min(vSavingsBoost - vLivingPull, Math.max(0, vOriginalReward - 1.0));
        
        activeVariable.savingsReserve = parseFloat((rules.variable.savingsReserve + (vLivingPull + vRewardPull)).toFixed(2));
        activeVariable.livingBudget = parseFloat((vOriginalLiving - vLivingPull).toFixed(2));
        activeVariable.reward = parseFloat((vOriginalReward - vRewardPull).toFixed(2));
      }
    } else {
      const excessSavingsToPortfolio = rules.fixed.savingsReserve * 0.5;
      activeFixed.savingsReserve = parseFloat((rules.fixed.savingsReserve - excessSavingsToPortfolio).toFixed(2));
      activeFixed.investment = parseFloat((rules.fixed.investment + excessSavingsToPortfolio).toFixed(2));

      const vExcessSavingsToPortfolio = rules.variable.savingsReserve * 0.6;
      activeVariable.savingsReserve = parseFloat((rules.variable.savingsReserve - vExcessSavingsToPortfolio).toFixed(2));
      activeVariable.investment = parseFloat((rules.variable.investment + vExcessSavingsToPortfolio).toFixed(2));
    }
  }

  const fixedInfaqValue = fixedIncoming * (activeFixed.infaqPercent / 100);
  const fixedManualInfaq = fixedIncoming > 0 ? (Number(activeFixed.manualInfaq) || 0) : 0;
  const fixedSocial = fixedInfaqValue + fixedManualInfaq;
  const fixedSavings = fixedIncoming * (activeFixed.savingsReserve / 100);
  const fixedReward = fixedIncoming * (activeFixed.reward / 100);
  const fixedFreedom = fixedIncoming * (activeFixed.investment / 100);
  
  let fixedLiving = 0;
  if (rules.restrictionMode === "locked") {
    fixedLiving = Math.max(0, fixedIncoming - fixedSocial - fixedSavings - fixedReward - fixedFreedom);
  } else {
    fixedLiving = fixedIncoming * (activeFixed.livingBudget / 100);
  }

  const variableSocial = variableIncoming * (activeVariable.infaqPercent / 100);
  const variableFreedom = variableIncoming * (activeVariable.investment / 100);
  const variableSavings = variableIncoming * (activeVariable.savingsReserve / 100);
  const variableReward = variableIncoming * (activeVariable.reward / 100);
  
  let variableLiving = 0;
  if (rules.restrictionMode === "locked") {
    variableLiving = Math.max(0, variableIncoming - variableSocial - variableFreedom - variableSavings - variableReward);
  } else {
    variableLiving = variableIncoming * (activeVariable.livingBudget / 100);
  }

  const bonusSocial = bonusIncoming * (activeBonus.infaqPercent / 100);
  const bonusFreedom = bonusIncoming * (activeBonus.investment / 100);
  const bonusSavings = bonusIncoming * (activeBonus.savingsReserve / 100);
  const bonusReward = bonusIncoming * (activeBonus.reward / 100);
  
  const totalInfaq = fixedSocial + variableSocial + bonusSocial;
  const totalSavings = fixedSavings + variableSavings + bonusSavings;
  const totalFreedom = fixedFreedom + variableFreedom + bonusFreedom;
  const totalLiving = fixedLiving + variableLiving;
  const totalReward = fixedReward + variableReward + bonusReward;

  return {
    categories: {
      fixed: fixedIncoming,
      variable: variableIncoming,
      bonus: bonusIncoming,
    },
    allocations: {
      social: totalInfaq,
      savings: totalSavings,
      freedom: totalFreedom,
      living: totalLiving,
      reward: totalReward,
    },
    activeRules: {
      fixed: activeFixed,
      variable: activeVariable,
      bonus: activeBonus,
    },
    unallocated: 0,
    emergencyRatio,
  };
}

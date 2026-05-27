import React, { useState, useEffect, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getMonthKey } from "./defaults";
import { runIncomeAllocationEngine, getIncomeCategory } from "./engines/incomeAllocationEngine";
import { IncomeRecord, Expense, LiteSettings } from "./types";
import {
  Home,
  PlusCircle,
  TrendingUp,
  RefreshCw,
  Clock,
  Check,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Smartphone,
  Trash2,
  Edit,
  Sparkles,
  AlertCircle
} from "lucide-react";

const DEFAULT_FLOW_RULES = {
  fixed: { infaqPercent: 2.5, manualInfaq: 214000, savingsReserve: 10, reward: 5, investment: 25, livingBudget: 57.5 },
  variable: { infaqPercent: 2.5, investment: 40, savingsReserve: 15, reward: 15, livingBudget: 27.5 },
  bonus: { infaqPercent: 2.5, investment: 50, savingsReserve: 20, reward: 27.5 },
  restrictionMode: "locked",
  mode: "auto",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "expense" | "income" | "ledger" | "sync">("home");
  const [syncStatus, setSyncStatus] = useState<"connected" | "syncing" | "synced" | "offline" | "error">("connected");
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Core lists in memory + localCache
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [liteSettings, setLiteSettings] = useState<LiteSettings>({
    emergencyTarget: 20000000,
    currentEmergencyFund: 1200000,
    financialFlowRules: DEFAULT_FLOW_RULES
  });

  // Offline Pending Queues (Store items waiting to push to Supabase)
  const [pendingExpensesQueue, setPendingExpensesQueue] = useState<any[]>([]);
  const [pendingIncomesQueue, setPendingIncomesQueue] = useState<any[]>([]);

  // Local state for Fast Input Form - EXPENSE
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    category: "Groceries",
    segment: "survival" as Expense["kakeiboType"],
    date: new Date().toISOString().split("T")[0],
    notes: "",
    paymentSource: "Budget" as Expense["paymentSource"]
  });

  // Local state for Fast Input Form - INCOME
  const [incomeForm, setIncomeForm] = useState({
    source: "",
    amount: "",
    incomeType: "fixed" as IncomeRecord["type"],
    date: new Date().toISOString().split("T")[0],
    notes: ""
  });

  // Success States Previews
  const [savedExpensePreview, setSavedExpensePreview] = useState<any>(null);
  const [savedIncomePreview, setSavedIncomePreview] = useState<any>(null);

  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [monthlyBills, setMonthlyBills] = useState<any[]>([]);

  // Search & Filters on Simple Ledger
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "expense" | "income" | "savings" | "social" | "fixed">("all");
  const [ledgerSort, setLedgerSort] = useState<"newest" | "oldest" | "amount" | "category">("newest");

  // Load Initial Data from Cache and try to Fetch
  useEffect(() => {
    const cachedIncomes = localStorage.getItem("lite_cache_incomes");
    const cachedExpenses = localStorage.getItem("lite_cache_expenses");
    const cachedSettings = localStorage.getItem("lite_cache_settings");
    const queueExpenses = localStorage.getItem("lite_pending_expenses");
    const queueIncomes = localStorage.getItem("lite_pending_incomes");
    const lastSync = localStorage.getItem("lite_last_synced");

    if (cachedIncomes) setIncomes(JSON.parse(cachedIncomes));
    if (cachedExpenses) setExpenses(JSON.parse(cachedExpenses));
    if (cachedSettings) setLiteSettings(JSON.parse(cachedSettings));
    if (queueExpenses) setPendingExpensesQueue(JSON.parse(queueExpenses));
    if (queueIncomes) setPendingIncomesQueue(JSON.parse(queueIncomes));
    if (lastSync) setLastSyncedTime(lastSync);

    fetchEcosystem();
  }, []);

  // Sync state observer to cache locally
  useEffect(() => {
    localStorage.setItem("lite_cache_incomes", JSON.stringify(incomes));
    localStorage.setItem("lite_cache_expenses", JSON.stringify(expenses));
    localStorage.setItem("lite_cache_settings", JSON.stringify(liteSettings));
  }, [incomes, expenses, liteSettings]);

  useEffect(() => {
    localStorage.setItem("lite_pending_expenses", JSON.stringify(pendingExpensesQueue));
    localStorage.setItem("lite_pending_incomes", JSON.stringify(pendingIncomesQueue));
  }, [pendingExpensesQueue, pendingIncomesQueue]);

  const fetchEcosystem = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("syncing");
    try {
      const [resIncomes, resExpenses, resSettings, resGoals, resAssets, resEmergencyFund, resTemplates, resInstances] = await Promise.all([
        supabase.from("income_ledger").select("*"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("settings").select("*").maybeSingle(),
        supabase.from("savings_goals").select("*"),
        supabase.from("portfolio_assets").select("*"),
        (async () => {
          try {
            return await supabase.from("emergency_funds").select("*").maybeSingle();
          } catch (err) {
            console.warn("Table emergency_funds might not exist yet, skipping:", err);
            return { data: null, error: err };
          }
        })(),
        (async () => {
          try {
            return await supabase.from("fixed_expense_templates").select("*");
          } catch (err) {
            console.warn("Table fixed_expense_templates might not exist yet:", err);
            return { data: null, error: err };
          }
        })(),
        (async () => {
          try {
            return await supabase.from("fixed_expense_instances").select("*");
          } catch (err) {
            console.warn("Table fixed_expense_instances might not exist yet:", err);
            return { data: null, error: err };
          }
        })()
      ]);

      if (resIncomes.error || resExpenses.error) {
        throw new Error("Gagal mengambil data dari Supabase.");
      }

      // Map incomes
      const mappedIncomes: IncomeRecord[] = (resIncomes.data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        amount: Number(row.amount),
        type: row.type || "gaji",
      }));

      // Map expenses
      const mappedExpenses: Expense[] = (resExpenses.data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        nominal: Number(row.nominal),
        category: row.category,
        kakeiboType: row.kakeibo_type || "survival",
        linkedGoalId: row.linked_goal_id,
        isWithdrawal: row.is_withdrawal,
        paymentSource: row.payment_source || "Budget",
        savingsSource: row.savings_source,
        fixedExpenseId: row.fixed_expense_id,
        monthKey: row.month_key,
      }));

      setIncomes(mappedIncomes);
      setExpenses(mappedExpenses);

      const s = resSettings.data;
      const currentRules = s?.financial_flow_rules || DEFAULT_FLOW_RULES;

      // Extract Emergency Fund data from Savings Goals
      const goalsData = resGoals.data || [];
      setGoals(goalsData);

      // Extract Emergency Fund data from Portfolio Assets
      const assetsData = resAssets.data || [];
      setAssets(assetsData);

      // Calculate total emergency assets following identical logic to parent: "Dana Darurat" + "RDPU"
      const emergencyAssetSum = assetsData
        .filter((a: any) => {
          const cat = (a.category || "").toLowerCase();
          return cat.includes("darurat") || cat.includes("rdpu") || cat.includes("pasar uang");
        })
        .reduce((sum: number, a: any) => sum + (Number(a.value) || 0), 0);

      // Calculate goals emergency fund sums
      const emergencyGoalSum = goalsData
        .filter((g: any) => g.name && g.name.toLowerCase().includes("darurat"))
        .reduce((sum: number, g: any) => sum + (Number(g.current_amount) || 0), 0);

      // Unified comprehensive sum
      let finalEmergencyTotal = emergencyAssetSum > 0 ? emergencyAssetSum : (emergencyGoalSum > 0 ? emergencyGoalSum : 1200000);
      let finalEmergencyTarget = Number(s?.emergency_target) || 20000000;

      // Override with direct emergency_funds table cache if present
      if (resEmergencyFund && resEmergencyFund.data) {
        if (resEmergencyFund.data.current_amount !== undefined && resEmergencyFund.data.current_amount !== null) {
          finalEmergencyTotal = Number(resEmergencyFund.data.current_amount);
        }
        if (resEmergencyFund.data.target_amount !== undefined && resEmergencyFund.data.target_amount !== null) {
          finalEmergencyTarget = Number(resEmergencyFund.data.target_amount);
        }
      }

      // Force exactly 20.000.000 for emergency target as requested by user
      finalEmergencyTarget = 20000000;

      // Map monthly bills
      const templatesData = resTemplates && !resTemplates.error ? resTemplates.data || [] : [];
      const instancesData = resInstances && !resInstances.error ? resInstances.data || [] : [];
      let mappedBills: any[] = [];
      if (templatesData.length > 0 && instancesData.length > 0) {
        mappedBills = instancesData.map((inst: any) => {
          const tmpl = templatesData.find((t: any) => t.id === inst.template_id);
          return {
            id: inst.id,
            name: tmpl?.name || "Kewajiban Bulanan",
            amount: Number(inst.amount),
            isPaid: inst.status === "paid",
            type: tmpl?.category || "survival",
            dueDate: tmpl?.due_day || "10",
            monthKey: inst.month_key
          };
        });
      }
      setMonthlyBills(mappedBills);

      setLiteSettings({
        emergencyTarget: finalEmergencyTarget,
        currentEmergencyFund: finalEmergencyTotal,
        financialFlowRules: currentRules
      });

      setSyncStatus("synced");
      const timestampString = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " • " + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      setLastSyncedTime(timestampString);
      localStorage.setItem("lite_last_synced", timestampString);
      setErrorMessage(null);

      // Flush offline backlogs if online
      await flushPendingQueues();

    } catch (e: any) {
      console.error(e);
      setSyncStatus("error");
      setErrorMessage(e.message || "Gagal melakukan sinkronisasi otomatis.");
    }
  };

  // Process Offline Backlog Sync
  const flushPendingQueues = async () => {
    if (!isSupabaseConfigured || !supabase) return;

    const savedPendingExpenses = [...pendingExpensesQueue];
    const savedPendingIncomes = [...pendingIncomesQueue];

    if (savedPendingExpenses.length === 0 && savedPendingIncomes.length === 0) return;

    setSyncStatus("syncing");
    try {
      // Push pending expenses
      for (const exp of savedPendingExpenses) {
        await supabase.from("transactions").insert({
          id: exp.id,
          date: exp.date,
          description: exp.description,
          nominal: exp.nominal,
          category: exp.category,
          kakeibo_type: exp.kakeiboType,
          payment_source: exp.paymentSource,
          month_key: exp.monthKey || getMonthKey()
        });
      }

      // Push pending incomes
      for (const inc of savedPendingIncomes) {
        await supabase.from("income_ledger").insert({
          id: inc.id,
          date: inc.date,
          description: inc.description,
          amount: inc.amount,
          type: inc.type
        });
      }

      setPendingExpensesQueue([]);
      setPendingIncomesQueue([]);
      setSyncStatus("synced");
      setErrorMessage(null);

      // Refresh data
      fetchEcosystem();
    } catch (err: any) {
      console.error("Backlog synchronization failed.", err);
      setSyncStatus("error");
      setErrorMessage("Antrean offline gagal tersimpan ke database cloud.");
    }
  };

  // Actions — Create Expense
  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;

    const nominalValue = parseFloat(expenseForm.amount);
    const newId = "exp-lite-" + Date.now();
    const curMonthKey = getMonthKey();

    const newExpense: Expense = {
      id: newId,
      date: expenseForm.date,
      description: expenseForm.title,
      nominal: nominalValue,
      category: expenseForm.category,
      kakeiboType: expenseForm.segment,
      paymentSource: expenseForm.paymentSource,
      monthKey: curMonthKey
    };

    // Update locally first
    const nextExpensesList = [newExpense, ...expenses];
    setExpenses(nextExpensesList);

    if (isSupabaseConfigured && supabase && syncStatus !== "offline") {
      try {
        setSyncStatus("syncing");
        const { error } = await supabase.from("transactions").insert({
          id: newId,
          date: expenseForm.date,
          description: expenseForm.title,
          nominal: nominalValue,
          category: expenseForm.category,
          kakeibo_type: expenseForm.segment,
          payment_source: expenseForm.paymentSource,
          month_key: curMonthKey
        });

        if (error) throw error;
        setSyncStatus("synced");
      } catch (err) {
        console.warn("Offline fallback triggered for transaction upload", err);
        setSyncStatus("offline");
        setPendingExpensesQueue(prev => [...prev, newExpense]);
      }
    } else {
      setSyncStatus("offline");
      setPendingExpensesQueue(prev => [...prev, newExpense]);
    }

    setSavedExpensePreview({
      description: expenseForm.title,
      nominal: nominalValue,
      segment: expenseForm.segment,
      category: expenseForm.category,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    });

    setExpenseForm({
      title: "",
      amount: "",
      category: "Groceries",
      segment: "survival",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      paymentSource: "Budget"
    });
  };

  // Actions — Create Income with pos-allocation Engine
  const submitIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeForm.source || !incomeForm.amount) return;

    const amountValue = parseFloat(incomeForm.amount);
    const newId = "inc-lite-" + Date.now();

    const newIncome: IncomeRecord = {
      id: newId,
      date: incomeForm.date,
      description: incomeForm.source,
      amount: amountValue,
      type: incomeForm.incomeType
    };

    const nextIncomesList = [newIncome, ...incomes];
    setIncomes(nextIncomesList);

    const splitReport = runIncomeAllocationEngine(
      [newIncome],
      {
        financialFlowRules: liteSettings.financialFlowRules,
        emergencyTarget: liteSettings.emergencyTarget
      },
      liteSettings.currentEmergencyFund
    );

    if (isSupabaseConfigured && supabase && syncStatus !== "offline") {
      try {
        setSyncStatus("syncing");
        const { error } = await supabase.from("income_ledger").insert({
          id: newId,
          date: incomeForm.date,
          description: incomeForm.source,
          amount: amountValue,
          type: incomeForm.incomeType
        });
        if (error) throw error;
        setSyncStatus("synced");
      } catch (err) {
        console.warn("Offline fallback triggered for income upload", err);
        setSyncStatus("offline");
        setPendingIncomesQueue(prev => [...prev, newIncome]);
      }
    } else {
      setSyncStatus("offline");
      setPendingIncomesQueue(prev => [...prev, newIncome]);
    }

    setSavedIncomePreview({
      description: incomeForm.source,
      amount: amountValue,
      splitting: splitReport.allocations,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    });

    setIncomeForm({
      source: "",
      amount: "",
      incomeType: "fixed",
      date: new Date().toISOString().split("T")[0],
      notes: ""
    });
  };

  // Delete transaction locally & supabase
  const handleDeleteTransaction = async (id: string, type: "income" | "expense") => {
    if (type === "income") {
      setIncomes(prev => prev.filter(i => i.id !== id));
      if (isSupabaseConfigured && supabase) {
        await supabase.from("income_ledger").delete().eq("id", id);
      }
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id));
      if (isSupabaseConfigured && supabase) {
        await supabase.from("transactions").delete().eq("id", id);
      }
    }
    fetchEcosystem();
  };

  // Toggle Monthly Bill payment status in cloud & local State
  const handleToggleBillPaid = async (billId: string, currentPaid: boolean) => {
    setMonthlyBills(prev => prev.map(b => b.id === billId ? { ...b, isPaid: !currentPaid } : b));
    if (isSupabaseConfigured && supabase) {
      try {
        const nextStatus = !currentPaid ? "paid" : "unpaid";
        const nextPaidAt = !currentPaid ? new Date().toISOString() : null;
        await supabase.from("fixed_expense_instances")
          .update({ status: nextStatus, paid_at: nextPaidAt })
          .eq("id", billId);
      } catch (err) {
        console.warn("Gagal mengubah status tagihan di Supabase:", err);
      }
    }
    fetchEcosystem();
  };

  // Update existing income or expense transaction in cloud & local State
  const handleUpdateTransaction = async (updated: {
    id: string;
    type: "income" | "expense";
    date: string;
    description: string;
    amount: number;
    category?: string;
    metaType?: string;
  }) => {
    if (updated.type === "income") {
      setIncomes(prev => prev.map(i => i.id === updated.id ? {
        ...i,
        date: updated.date,
        description: updated.description,
        amount: updated.amount,
        type: updated.metaType || i.type
      } : i));

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from("income_ledger").update({
            date: updated.date,
            description: updated.description,
            amount: updated.amount,
            type: updated.metaType
          }).eq("id", updated.id);
        } catch (err) {
          console.error("Gagal update income_ledger di Supabase:", err);
        }
      }
    } else {
      setExpenses(prev => prev.map(e => e.id === updated.id ? {
        ...e,
        date: updated.date,
        description: updated.description,
        nominal: updated.amount,
        category: updated.category || e.category,
        kakeiboType: (updated.metaType as any) || e.kakeiboType
      } : e));

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from("transactions").update({
            date: updated.date,
            description: updated.description,
            nominal: updated.amount,
            category: updated.category,
            kakeibo_type: updated.metaType
          }).eq("id", updated.id);
        } catch (err) {
          console.error("Gagal update transactions di Supabase:", err);
        }
      }
    }
    fetchEcosystem();
  };

  const totalIncomesComp = useMemo(() => incomes.reduce((sum, i) => sum + i.amount, 0), [incomes]);
  const totalExpensesComp = useMemo(() => expenses.reduce((sum, e) => sum + e.nominal, 0), [expenses]);

  const combinedLedger = useMemo(() => {
    const records: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      category: string;
      type: "income" | "expense";
      metaType?: string;
    }> = [];

    incomes.forEach(i => {
      records.push({
        id: i.id,
        date: i.date,
        description: i.description,
        amount: i.amount,
        category: getIncomeCategory(i).toUpperCase(),
        type: "income",
        metaType: i.type
      });
    });

    expenses.forEach(e => {
      records.push({
        id: e.id,
        date: e.date,
        description: e.description,
        amount: e.nominal,
        category: e.category,
        type: "expense",
        metaType: e.kakeiboType
      });
    });

    let filtered = records.filter(r => {
      const matchSearch = r.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(ledgerSearch.toLowerCase());
      
      if (!matchSearch) return false;

      if (ledgerFilter === "all") return true;
      if (ledgerFilter === "income") return r.type === "income";
      if (ledgerFilter === "expense") return r.type === "expense";
      if (ledgerFilter === "savings") return r.type === "expense" && r.metaType === "savings";
      if (ledgerFilter === "social") return r.type === "expense" && r.metaType === "culture";
      if (ledgerFilter === "fixed") return r.type === "expense" && r.metaType === "survival";

      return true;
    });

    return filtered.sort((a, b) => {
      if (ledgerSort === "newest") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (ledgerSort === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (ledgerSort === "amount") return b.amount - a.amount;
      if (ledgerSort === "category") return a.category.localeCompare(b.category);
      return 0;
    });
  }, [incomes, expenses, ledgerSearch, ledgerFilter, ledgerSort]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans antialiased text-sm">
      
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white p-1.5 rounded-xl shadow-md">
            <Smartphone className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 leading-none">WalletOS Lite</h1>
            <span className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase">Standalone Terminal</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={fetchEcosystem}
            className="p-1.5 hover:bg-slate-50 rounded-lg active:scale-95 transition-transform text-slate-500 hover:text-slate-800"
            title="Klik untuk sync ulang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === "syncing" ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          {syncStatus === "connected" || syncStatus === "synced" ? (
            <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          ) : syncStatus === "syncing" ? (
            <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-indigo-100 animate-pulse">
              Syncing
            </span>
          ) : (
            <span className="bg-amber-50 text-amber-600 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-amber-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Offline Cache
            </span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 py-4">
        {activeTab === "home" && (
          <div className="space-y-4">
            {/* Cash Balance Display */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-5050/5 rounded-full translate-x-12 -translate-y-12"></div>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest">Available Cash Balance</span>
                  <p className="text-3xl font-display font-extrabold tracking-tight mt-1 text-white">
                    {formatIDR(totalIncomesComp - totalExpensesComp)}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold text-left">Pemasukan Bulan Ini</span>
                    <p className="text-sm font-extrabold text-emerald-400 mt-0.5">{formatIDR(totalIncomesComp)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold text-left">Pengeluaran Bulan Ini</span>
                    <p className="text-sm font-extrabold text-rose-400 mt-0.5">{formatIDR(totalExpensesComp)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Reserve Progress Card */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Dana Darurat (Unified)</span>
                <span className="font-mono text-indigo-600 font-extrabold">
                  {((liteSettings.currentEmergencyFund / liteSettings.emergencyTarget) * 100).toFixed(0)}%
                </span>
              </div>
              
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (liteSettings.currentEmergencyFund / liteSettings.emergencyTarget) * 100)}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Terkumpul: {formatIDR(liteSettings.currentEmergencyFund)}</span>
                <span>Target: {formatIDR(liteSettings.emergencyTarget)}</span>
              </div>
            </div>

            {/* Offline Queues Banner */}
            {(pendingExpensesQueue.length > 0 || pendingIncomesQueue.length > 0) && (
              <div 
                onClick={() => setActiveTab("sync")}
                className="bg-amber-50 hover:bg-amber-100/70 border border-amber-200/50 p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors"
              >
                <div className="bg-amber-500 text-white p-2 rounded-xl">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-amber-800">Antrean Offline Menunggu Sync</h4>
                  <p className="text-[10px] text-amber-600">Ada {pendingExpensesQueue.length + pendingIncomesQueue.length} transaksi tertunda di cache local.</p>
                </div>
              </div>
            )}

            {/* Fast Form Shortlinks */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setSavedExpensePreview(null); setActiveTab("expense"); }}
                className="bg-white hover:bg-slate-50 active:scale-95 transition-all text-slate-800 border border-slate-100 p-4 rounded-3xl text-left shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="bg-rose-50 text-rose-500 p-2.5 rounded-2xl w-fit">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">Pengeluaran Baru</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Struk kakeibo cepat</p>
                </div>
              </button>

              <button 
                onClick={() => { setSavedIncomePreview(null); setActiveTab("income"); }}
                className="bg-white hover:bg-slate-50 active:scale-95 transition-all text-slate-800 border border-slate-100 p-4 rounded-3xl text-left shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-2xl w-fit">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">Pemasukan / Gaji</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Split pos otomatis</p>
                </div>
              </button>
            </div>

            {/* Recent Mini List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aktivitas Terkini</span>
                <button onClick={() => setActiveTab("ledger")} className="text-xs text-indigo-600 font-black hover:underline cursor-pointer">
                  Semua
                </button>
              </div>

              <div className="bg-white rounded-3xl divide-y divide-slate-50 shadow-sm border border-slate-100 overflow-hidden">
                {combinedLedger.slice(0, 5).map((r) => (
                  <div key={r.id} className="p-3.5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl text-xs font-extrabold ${r.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                        {r.type === "income" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{r.description}</h4>
                        <span className="text-[9.5px] text-slate-400 font-mono tracking-wide mt-1 block">
                          {r.date} • {r.category}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-extrabold font-mono ${r.type === "income" ? "text-emerald-600" : "text-slate-800"}`}>
                      {r.type === "income" ? "+" : "-"}{formatIDR(r.amount)}
                    </span>
                  </div>
                ))}

                {combinedLedger.length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Belum ada transaksi terekam di cache.
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Bills / Kewajiban Bulanan */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kewajiban Bulanan</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full">
                  {monthlyBills.filter(b => b.isPaid).length}/{monthlyBills.length} Lunas
                </span>
              </div>

              <div className="bg-white rounded-3xl divide-y divide-slate-50 shadow-sm border border-slate-100 overflow-hidden">
                {monthlyBills.map((b) => (
                  <div key={b.id} className="p-3.5 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl text-xs font-extrabold ${b.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                        {b.isPaid ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{b.name}</h4>
                        <span className="text-[9.5px] text-slate-400 font-mono tracking-wide mt-1 block">
                          Jatuh Tempo: Hari ke-{b.dueDate || "10"} • {b.type === "survival" ? "Survival" : "Lainnya"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold font-mono text-slate-700 mr-1">
                        {formatIDR(b.amount)}
                      </span>
                      <button
                        onClick={() => handleToggleBillPaid(b.id, b.isPaid)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 ${
                          b.isPaid
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-100"
                        }`}
                      >
                        {b.isPaid ? "Lunas" : "Bayar"}
                      </button>
                    </div>
                  </div>
                ))}

                {monthlyBills.length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Belum ada kewajiban bulanan kustom terdaftar. Atur di Dashboard Utama.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expense Form */}
        {activeTab === "expense" && (
          <div className="space-y-4">
            {savedExpensePreview ? (
              <div className="bg-white rounded-3xl p-5 shadow-lg border border-slate-100 space-y-4 text-center">
                <div className="mx-auto bg-rose-50 text-rose-500 p-3 rounded-full w-fit">
                  <Check className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Expense Cached Successfully</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{savedExpensePreview.time} • Saved locally</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl text-left space-y-2">
                  <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5 text-xs">
                    <span className="text-slate-500">Deskripsi:</span>
                    <strong className="text-slate-800">{savedExpensePreview.description}</strong>
                  </div>
                  <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5 text-xs">
                    <span className="text-slate-500">Nominal:</span>
                    <strong className="text-rose-600 font-mono">{formatIDR(savedExpensePreview.nominal)}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Kategori / Segment:</span>
                    <span className="bg-slate-200/60 px-2 py-0.5 rounded text-[9.5px] text-slate-600 font-bold uppercase">{savedExpensePreview.category} | {savedExpensePreview.segment}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSavedExpensePreview(null)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold active:scale-95 transition-all text-xs">
                    Tambah Lagi
                  </button>
                  <button onClick={() => setActiveTab("home")} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold active:scale-95 transition-all text-xs">
                    Ke Beranda
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 shadow-md border border-slate-100 space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h2 className="text-sm font-bold text-slate-900">Catat Pengeluaran Cepat</h2>
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Low Latency Form</span>
                </div>

                <form onSubmit={submitExpense} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block uppercase text-[10px]">Nama Pengeluaran *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Nasi Padang, Belanja Mingguan" 
                      value={expenseForm.title}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                      required
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block uppercase text-[10px]">Nominal (Rupiah) *</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 25000" 
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block uppercase text-[10px]">Tanggal Pengeluaran *</label>
                      <input 
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block uppercase text-[10px]">Kategori</label>
                      <select 
                        value={expenseForm.category}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                      >
                        <option value="Groceries">Bahan Makanan / Groceries</option>
                        <option value="Dining Out">Makan di Luar / Resto</option>
                        <option value="Transport">Transportasi / BBM</option>
                        <option value="Utilities">Token Listrik / Wi-Fi</option>
                        <option value="Health">Kesehatan / Obat</option>
                        <option value="Entertainment">Entertainment / Liburan</option>
                        <option value="Self Invest">Pengembangan Diri / Buku</option>
                        <option value="Others">Lain-Lain</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block uppercase text-[10px]">Segmen Kakeibo</label>
                      <select 
                        value={expenseForm.segment}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, segment: e.target.value as any }))}
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                      >
                        <option value="survival">Survival (Kebutuhan Pokok)</option>
                        <option value="optional">Optional (Keinginan / Gaya Hidup)</option>
                        <option value="culture">Culture (Spiritual / Sosial / Buku)</option>
                        <option value="extra">Extra (Mendadak)</option>
                        <option value="savings">Savings Segment</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block uppercase text-[10px]">Metode Pembayaran</label>
                    <select 
                      value={expenseForm.paymentSource}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, paymentSource: e.target.value as any }))}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                    >
                      <option value="Budget">Dompet Living Utama / Cash</option>
                      <option value="Alasan Tertentu">Sinking / Tabungan Mandiri</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl shadow-md active:scale-95 transition-all text-xs"
                  >
                    Simpan Transaksi
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Income Form */}
        {activeTab === "income" && (
          <div className="space-y-4">
            {savedIncomePreview ? (
              <div className="bg-white rounded-3xl p-5 shadow-lg border border-slate-100 space-y-4 text-center">
                <div className="mx-auto bg-emerald-50 text-emerald-500 p-3 rounded-full w-fit">
                  <Check className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Income Logged Successfully</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{savedIncomePreview.time} • Automatic pos splitting</span>
                </div>

                <div className="bg-[#f8fafc] border border-slate-100 p-4 rounded-2xl text-left space-y-3">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-dashed border-slate-200">
                    <span className="text-slate-400">Total Pendapatan:</span>
                    <strong className="text-emerald-600 font-mono text-sm">{formatIDR(savedIncomePreview.amount)}</strong>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Alokasi Gateway Otomatis:</h5>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                        <span className="text-slate-400 block font-bold">Freedom Fund (FIRE)</span>
                        <strong className="text-emerald-600 font-mono">{formatIDR(savedIncomePreview.splitting.freedom)}</strong>
                      </div>

                      <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl">
                        <span className="text-slate-400 block font-bold">Planned Sinking Saving</span>
                        <strong className="text-amber-600 font-mono">{formatIDR(savedIncomePreview.splitting.savings)}</strong>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-100 p-2 rounded-xl">
                        <span className="text-slate-400 block font-bold">Personal Reward</span>
                        <strong className="text-indigo-600 font-mono">{formatIDR(savedIncomePreview.splitting.reward)}</strong>
                      </div>

                      <div className="bg-rose-50 border border-rose-100 p-2 rounded-xl">
                        <span className="text-slate-400 block font-bold">Social Infaq</span>
                        <strong className="text-rose-500 font-mono">{formatIDR(savedIncomePreview.splitting.social)}</strong>
                      </div>
                    </div>

                    <div className="bg-cyan-50 border border-cyan-100 p-2.5 rounded-xl flex justify-between items-center text-[10px]">
                      <span className="text-slate-500 font-bold">Cash Living Budget</span>
                      <strong className="text-cyan-600 font-mono">{formatIDR(savedIncomePreview.splitting.living)}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSavedIncomePreview(null)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold active:scale-95 transition-all">
                    Tambah Lagi
                  </button>
                  <button onClick={() => setActiveTab("home")} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold active:scale-95 transition-all">
                    Ke Beranda
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 shadow-md border border-slate-100 space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h2 className="text-sm font-bold text-slate-900">Catat Pendapatan Baru</h2>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-display">Splits Engine v2.1</span>
                </div>

                <form onSubmit={submitIncome} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block uppercase text-[10px]">Sumber Pendapatan *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Gaji Bulanan, Hasil Proyek" 
                      value={incomeForm.source}
                      onChange={(e) => setIncomeForm(prev => ({ ...prev, source: e.target.value }))}
                      required
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block uppercase text-[10px]">Nominal (Rupiah) *</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 5000000" 
                        value={incomeForm.amount}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block uppercase text-[10px]">Tanggal Kas Masuk *</label>
                      <input 
                        type="date"
                        value={incomeForm.date}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block uppercase text-[10px]">Tipe Alokasi</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        type="button" 
                        onClick={() => setIncomeForm(prev => ({ ...prev, incomeType: "gaji" }))}
                        className={`p-2 rounded-xl border text-center font-bold text-[10px] transition-all uppercase ${incomeForm.incomeType === "fixed" || incomeForm.incomeType === "gaji" ? "bg-emerald-50 text-emerald-600 border-emerald-400/50 shadow-sm" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                      >
                        Fixed (Gaji)
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIncomeForm(prev => ({ ...prev, incomeType: "extra" }))}
                        className={`p-2 rounded-xl border text-center font-bold text-[10px] transition-all uppercase ${incomeForm.incomeType === "variable" || incomeForm.incomeType === "extra" ? "bg-indigo-50 text-indigo-600 border-indigo-400/50 shadow-sm" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                      >
                        Variable (Insentif)
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIncomeForm(prev => ({ ...prev, incomeType: "bonus" }))}
                        className={`p-2 rounded-xl border text-center font-bold text-[10px] transition-all uppercase ${incomeForm.incomeType === "bonus" ? "bg-amber-50 text-amber-600 border-amber-400/50 shadow-sm" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                      >
                        Bonus / THR
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md active:scale-95 transition-all text-xs"
                  >
                    Simpan & Distribusikan Ke Pos
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Ledger */}
        {activeTab === "ledger" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 rounded-xl flex items-center px-3 gap-2 border border-slate-100 focus-within:bg-white focus-within:border-indigo-600 transition-all">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari transaksi..." 
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full py-2 bg-transparent text-xs text-slate-800 outline-none font-medium"
                  />
                </div>

                <select 
                  value={ledgerSort}
                  onChange={(e) => setLedgerSort(e.target.value as any)}
                  className="bg-slate-50 text-xs font-bold px-3 py-2 rounded-xl border border-slate-100 outline-none focus:border-indigo-600 transition-all"
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="amount">Nominal</option>
                  <option value="category">Kategori</option>
                </select>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                <button 
                  onClick={() => setLedgerFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${ledgerFilter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                >
                  Semua
                </button>
                <button 
                  onClick={() => setLedgerFilter("expense")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${ledgerFilter === "expense" ? "bg-rose-500 text-white border-rose-500" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                >
                  Keluar
                </button>
                <button 
                  onClick={() => setLedgerFilter("income")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${ledgerFilter === "income" ? "bg-emerald-500 text-white border-emerald-500" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                >
                  Masuk
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl divide-y divide-slate-50 shadow-sm border border-slate-100 overflow-hidden">
              {combinedLedger.map((r) => (
                <div key={r.id} className="p-3.5 flex justify-between items-center hover:bg-slate-50/55 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl text-xs font-extrabold ${r.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                      {r.type === "income" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{r.description}</h4>
                      <span className="text-[9.5px] text-slate-400 font-mono tracking-wide mt-0.5 block">
                        {r.date} • {r.category}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-extrabold font-mono ${r.type === "income" ? "text-emerald-600" : "text-slate-800"} mr-1.5`}>
                      {r.type === "income" ? "+" : "-"}{formatIDR(r.amount)}
                    </span>
                    <button 
                      onClick={() => setEditingTx({
                        id: r.id,
                        type: r.type,
                        date: r.date,
                        description: r.description,
                        amount: r.amount,
                        category: r.category,
                        metaType: r.metaType || ""
                      })}
                      className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-xl hover:bg-slate-50 duration-150"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(`Hapus transaksi "${r.description}"?`)) {
                          handleDeleteTransaction(r.id, r.type);
                        }
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1.5 rounded-xl hover:bg-slate-50 duration-150"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {combinedLedger.length === 0 && (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Tidak ada transaksi yang cocok dengan filter aktif.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sync Offline Queue Details */}
        {activeTab === "sync" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Terminal Integrasi Cloud</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                WalletOS Lite mendukung offline-first. Transaksi yang terekam saat koneksi terputus akan berada di antrean local storage dan siap disinkronkan saat kembali online.
              </p>

              <div className="pt-2 flex gap-3 text-xs">
                <button 
                  onClick={fetchEcosystem} 
                  disabled={syncStatus === "syncing"}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
                  Sync Paksa Ke Cloud
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">Antrean Pending Offline</span>
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingExpensesQueue.length + pendingIncomesQueue.length} Item
                </span>
              </div>

              <div className="space-y-3">
                {pendingExpensesQueue.map((e) => (
                  <div key={e.id} className="text-xs flex justify-between items-center rounded-xl bg-orange-50/50 p-3 border border-orange-100/50">
                    <div>
                      <span className="text-[10px] text-amber-700 font-extrabold uppercase bg-amber-100 px-1.5 py-0.5 rounded mr-1.5">Pengeluaran</span>
                      <strong className="text-slate-800 font-bold">{e.description}</strong>
                      <p className="text-[9.5px] text-slate-400 mt-1">{e.date} • {e.category}</p>
                    </div>
                    <strong className="text-rose-600 font-mono font-bold text-xs">{formatIDR(e.nominal)}</strong>
                  </div>
                ))}

                {pendingIncomesQueue.map((i) => (
                  <div key={i.id} className="text-xs flex justify-between items-center rounded-xl bg-emerald-50/50 p-3 border border-emerald-100/50">
                    <div>
                      <span className="text-[10px] text-emerald-700 font-extrabold uppercase bg-emerald-100 px-1.5 py-0.5 rounded mr-1.5">Pemasukan</span>
                      <strong className="text-slate-800 font-bold">{i.description}</strong>
                      <p className="text-[9.5px] text-slate-400 mt-1">{i.date}</p>
                    </div>
                    <strong className="text-emerald-600 font-mono font-bold text-xs">{formatIDR(i.amount)}</strong>
                  </div>
                ))}

                {pendingIncomesQueue.length === 0 && pendingExpensesQueue.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                    <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-500">Semua Data Sinkron!</p>
                    <p className="text-[10px] text-slate-400">Tidak ada backlog transaksi offline.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Styled Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 py-2.5 px-3 flex justify-around shadow-lg">
        <button 
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-colors ${activeTab === "home" ? "text-indigo-600 font-bold" : "text-slate-400 hover:text-slate-600"}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Beranda</span>
        </button>

        <button 
          onClick={() => { setSavedExpensePreview(null); setActiveTab("expense"); }}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-colors ${activeTab === "expense" ? "text-rose-500 font-bold" : "text-slate-400 hover:text-slate-600"}`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px]">Keluar</span>
        </button>

        <button 
          onClick={() => { setSavedIncomePreview(null); setActiveTab("income"); }}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-colors ${activeTab === "income" ? "text-emerald-600 font-bold" : "text-slate-400 hover:text-slate-600"}`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px]">Masuk</span>
        </button>

        <button 
          onClick={() => setActiveTab("ledger")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-colors ${activeTab === "ledger" ? "text-indigo-600 font-bold" : "text-slate-400 hover:text-slate-600"}`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px]">Ledger</span>
        </button>
      </nav>

      {/* Edit Transaction Modal / Sheet Overlay */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Edit Transaksi {editingTx.type === "income" ? "Masuk" : "Keluar"}
              </h3>
              <button 
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-xs px-2.5 py-1 hover:bg-slate-50 rounded-xl"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block uppercase text-[10px]">Deskripsi / Keterangan *</label>
                <input 
                  type="text" 
                  value={editingTx.description}
                  onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })}
                  className="w-full bg-slate-50 focus:bg-white text-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block uppercase text-[10px]">Nominal (Rupiah) *</label>
                  <input 
                    type="number" 
                    value={editingTx.amount}
                    onChange={(e) => setEditingTx({ ...editingTx, amount: Number(e.target.value) })}
                    className="w-full bg-slate-50 focus:bg-white text-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block uppercase text-[10px]">Tanggal *</label>
                  <input 
                    type="date" 
                    value={editingTx.date}
                    onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })}
                    className="w-full bg-slate-50 focus:bg-white text-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition-all text-xs font-bold"
                  />
                </div>
              </div>

              {editingTx.type === "expense" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block uppercase text-[10px]">Kategori</label>
                    <select
                      value={editingTx.category || "Groceries"}
                      onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                      className="w-full bg-slate-50 focus:bg-white text-slate-800 px-3 py-2.5 rounded-xl border border-slate-100 outline-none text-xs font-bold"
                    >
                      <option value="Groceries">Groceries</option>
                      <option value="Snacks & Coffee">Snacks & Coffee</option>
                      <option value="Dining Out">Dining Out</option>
                      <option value="Internet & Bills">Internet & Bills</option>
                      <option value="Subscriptions">Subscriptions</option>
                      <option value="Transport / Fuel">Transport / Fuel</option>
                      <option value="Infaq & Sodaqoh">Infaq & Sodaqoh</option>
                      <option value="Self Care & Health">Self Care & Health</option>
                      <option value="Fun & Reward">Fun & Reward</option>
                      <option value="Investasi Saham / Reksadana">Investasi Saham / Reksadana</option>
                      <option value="Zakat Maal">Zakat Maal</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block uppercase text-[10px]">Pos Alokasi</label>
                    <select
                      value={editingTx.metaType || "survival"}
                      onChange={(e) => setEditingTx({ ...editingTx, metaType: e.target.value })}
                      className="w-full bg-slate-50 focus:bg-white text-slate-800 px-3 py-2.5 rounded-xl border border-slate-100 outline-none text-xs font-bold"
                    >
                      <option value="survival">Survival (Kebutuhan)</option>
                      <option value="optional">Optional (Keinginan)</option>
                      <option value="culture">Culture (Pengembangan)</option>
                      <option value="extra">Extra (Lainnya)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block uppercase text-[10px]">Tipe Pendapatan</label>
                  <select
                    value={editingTx.metaType || "gaji"}
                    onChange={(e) => setEditingTx({ ...editingTx, metaType: e.target.value })}
                    className="w-full bg-slate-50 focus:bg-white text-slate-800 px-3 py-2.5 rounded-xl border border-slate-100 outline-none text-xs font-bold"
                  >
                    <option value="gaji">Gaji Pokok / Tetap</option>
                    <option value="extra">Insentif / Tambahan</option>
                    <option value="bonus">Bonus / THR</option>
                  </select>
                </div>
              )}

              <div className="pt-3 flex gap-2.5">
                <button 
                  onClick={() => {
                    if (window.confirm("Hapus transaksi ini secara permanen?")) {
                      handleDeleteTransaction(editingTx.id, editingTx.type);
                      setEditingTx(null);
                    }
                  }}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-black uppercase text-[10px] tracking-wider px-4 py-3 rounded-xl transition-all"
                >
                  Hapus
                </button>
                
                <button 
                  onClick={() => setEditingTx(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider py-3 rounded-xl transition-all"
                >
                  Batal
                </button>

                <button 
                  onClick={() => {
                    handleUpdateTransaction(editingTx);
                    setEditingTx(null);
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-wider py-3 rounded-xl shadow-md shadow-indigo-100 transition-all font-bold"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

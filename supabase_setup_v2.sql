-- ====================================================================
-- ⚡ SUPABASE POSTGRESQL MIGRATION & REBALANCE SCHEMA (V2)
-- DESCRIPTION: Master templates, monthly instances, operational spending ledger
-- ====================================================================

-- 1. Create fixed_expense_templates table
CREATE TABLE IF NOT EXISTS fixed_expense_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL CHECK (category IN ('survival', 'optional', 'culture', 'extra', 'savings')),
    due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    recurring BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create fixed_expense_instances table with unique constraint
CREATE TABLE IF NOT EXISTS fixed_expense_instances (
    id TEXT PRIMARY KEY,
    template_id TEXT REFERENCES fixed_expense_templates(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue', 'skipped')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_template_and_month UNIQUE (template_id, month_key)
);

-- 3. Create operational_transactions table
CREATE TABLE IF NOT EXISTS operational_transactions (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'fixed_expense_instance')),
    source_id TEXT, -- references fixed_expense_instances(id)
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL,
    kakeibo_type TEXT NOT NULL CHECK (kakeibo_type IN ('survival', 'optional', 'culture', 'extra')),
    transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'withdrawal')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Alter the primary ledger "transactions" table to support sync and rollbacks gracefully!
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fixed_expense_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS month_key TEXT;

-- 5. Indexes for optimal lookup speeds
CREATE INDEX IF NOT EXISTS idx_templates_active ON fixed_expense_templates(active);
CREATE INDEX IF NOT EXISTS idx_instances_lookup ON fixed_expense_instances(month_key, status);
CREATE INDEX IF NOT EXISTS idx_operational_kakeibo ON operational_transactions(kakeibo_type, category);
CREATE INDEX IF NOT EXISTS idx_transactions_fixed_expense ON transactions(fixed_expense_id, month_key);

-- 6. Row Level Security (RLS) Policies
-- Grant read/write access for all developers / anonymous users in AI Studio demo context
ALTER TABLE fixed_expense_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expense_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select of templates" ON fixed_expense_templates;
CREATE POLICY "Allow public select of templates" ON fixed_expense_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert of templates" ON fixed_expense_templates;
CREATE POLICY "Allow public insert of templates" ON fixed_expense_templates FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update of templates" ON fixed_expense_templates;
CREATE POLICY "Allow public update of templates" ON fixed_expense_templates FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete of templates" ON fixed_expense_templates;
CREATE POLICY "Allow public delete of templates" ON fixed_expense_templates FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public select of instances" ON fixed_expense_instances;
CREATE POLICY "Allow public select of instances" ON fixed_expense_instances FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert of instances" ON fixed_expense_instances;
CREATE POLICY "Allow public insert of instances" ON fixed_expense_instances FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update of instances" ON fixed_expense_instances;
CREATE POLICY "Allow public update of instances" ON fixed_expense_instances FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete of instances" ON fixed_expense_instances;
CREATE POLICY "Allow public delete of instances" ON fixed_expense_instances FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public select of operational_tx" ON operational_transactions;
CREATE POLICY "Allow public select of operational_tx" ON operational_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert of operational_tx" ON operational_transactions;
CREATE POLICY "Allow public insert of operational_tx" ON operational_transactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update of operational_tx" ON operational_transactions;
CREATE POLICY "Allow public update of operational_tx" ON operational_transactions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete of operational_tx" ON operational_transactions;
CREATE POLICY "Allow public delete of operational_tx" ON operational_transactions FOR DELETE USING (true);

-- 7. Updated At automatic trigger for templates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_fixed_expense_templates_changetimestamp ON fixed_expense_templates;
CREATE TRIGGER update_fixed_expense_templates_changetimestamp
    BEFORE UPDATE ON fixed_expense_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- ⚡ EXTRA MIGRATIONS FOR FIRE SELECTIONS & KAKEIBO ALLOCATION POSTS
-- ====================================================================

-- 8. Add is_fire_included column to portfolio_assets if it exists
ALTER TABLE portfolio_assets ADD COLUMN IF NOT EXISTS is_fire_included BOOLEAN DEFAULT true;

-- 9. Create allocation_posts table for budgeting
CREATE TABLE IF NOT EXISTS allocation_posts (
    category TEXT PRIMARY KEY,
    percentage NUMERIC NOT NULL CHECK (percentage BETWEEN 0 AND 100),
    amount NUMERIC DEFAULT 0
);

-- 10. Enable Row Level Security (RLS) and policies for allocation_posts
ALTER TABLE allocation_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select of allocation_posts" ON allocation_posts;
CREATE POLICY "Allow public select of allocation_posts" ON allocation_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert of allocation_posts" ON allocation_posts;
CREATE POLICY "Allow public insert of allocation_posts" ON allocation_posts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update of allocation_posts" ON allocation_posts;
CREATE POLICY "Allow public update of allocation_posts" ON allocation_posts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete of allocation_posts" ON allocation_posts;
CREATE POLICY "Allow public delete of allocation_posts" ON allocation_posts FOR DELETE USING (true);

-- 11. Create emergency_funds table for direct sync of computed values
CREATE TABLE IF NOT EXISTS emergency_funds (
    id TEXT PRIMARY KEY,
    current_amount NUMERIC NOT NULL DEFAULT 0,
    target_amount NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) and policies for emergency_funds
ALTER TABLE emergency_funds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select of emergency_funds" ON emergency_funds;
CREATE POLICY "Allow public select of emergency_funds" ON emergency_funds FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert of emergency_funds" ON emergency_funds;
CREATE POLICY "Allow public insert of emergency_funds" ON emergency_funds FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update of emergency_funds" ON emergency_funds;
CREATE POLICY "Allow public update of emergency_funds" ON emergency_funds FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete of emergency_funds" ON emergency_funds;
CREATE POLICY "Allow public delete of emergency_funds" ON emergency_funds FOR DELETE USING (true);


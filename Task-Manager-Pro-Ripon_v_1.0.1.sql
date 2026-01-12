-- ============================================
-- TASK MANAGER PRO - COMPLETE DATABASE SCHEMA
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. AUTHENTICATION & USER MANAGEMENT TABLES
-- ============================================

-- Main user authentication table
CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    role VARCHAR(50) NOT NULL CHECK (role IN ('Administrator', 'Shift Officer', 'Manager', 'GM', 'Worker')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- User responsibilities junction table
CREATE TABLE IF NOT EXISTS user_responsibilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id) ON DELETE CASCADE,
    responsibility VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by VARCHAR(50),
    UNIQUE(user_id, responsibility)
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Login audit log
CREATE TABLE IF NOT EXISTS login_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN,
    failure_reason TEXT
);

-- ============================================
-- 2. TASK MANAGEMENT TABLES
-- ============================================

-- Master task templates (for each shift)
CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift CHAR(1) NOT NULL CHECK (shift IN ('A', 'B', 'C', 'G')),
    task_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    UNIQUE(shift, task_text)
);

-- Task categories (for organization)
CREATE TABLE IF NOT EXISTS task_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color_code VARCHAR(7) DEFAULT '#2563eb',
    is_active BOOLEAN DEFAULT TRUE
);

-- Task template categories junction
CREATE TABLE IF NOT EXISTS task_template_categories (
    task_template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
    category_id UUID REFERENCES task_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (task_template_id, category_id)
);

-- Daily task reports
CREATE TABLE IF NOT EXISTS daily_task_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_date DATE NOT NULL,
    shift CHAR(1) NOT NULL CHECK (shift IN ('A', 'B', 'C', 'G')),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    operator_name VARCHAR(100) NOT NULL,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    completion_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    submission_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_by VARCHAR(50),
    verified_by VARCHAR(50),
    verification_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'verified', 'rejected')),
    remarks TEXT,
    UNIQUE(report_date, shift, user_id)
);

-- Individual task check records
CREATE TABLE IF NOT EXISTS task_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES daily_task_reports(id) ON DELETE CASCADE,
    task_template_id UUID REFERENCES task_templates(id),
    is_completed BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);

-- ============================================
-- 3. LEAVE MANAGEMENT TABLES
-- ============================================

-- Leave types
CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    max_days_per_year INTEGER,
    requires_approval BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    leave_type_id UUID REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT NOT NULL,
    emergency_contact VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(50),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Leave balances
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    leave_type_id UUID REFERENCES leave_types(id),
    year INTEGER NOT NULL,
    total_allotted INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    remaining INTEGER GENERATED ALWAYS AS (total_allotted - used) STORED,
    UNIQUE(user_id, leave_type_id, year)
);

-- ============================================
-- 4. OVERTIME MANAGEMENT TABLES
-- ============================================

-- Overtime requests
CREATE TABLE IF NOT EXISTS overtime_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    request_date DATE NOT NULL,
    shift CHAR(1) CHECK (shift IN ('A', 'B', 'C', 'G')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_hours DECIMAL(5,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(50),
    approved_at TIMESTAMP WITH TIME ZONE,
    rate_multiplier DECIMAL(3,2) DEFAULT 1.5,
    remarks TEXT,
    CONSTRAINT valid_times CHECK (end_time > start_time)
);

-- Overtime approvals workflow
CREATE TABLE IF NOT EXISTS overtime_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    overtime_id UUID REFERENCES overtime_requests(id) ON DELETE CASCADE,
    approver_id VARCHAR(50) REFERENCES auth_users(user_id),
    approval_level INTEGER DEFAULT 1,
    status VARCHAR(20) CHECK (status IN ('approved', 'rejected', 'pending')),
    comments TEXT,
    acted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(overtime_id, approver_id)
);

-- ============================================
-- 5. KPI & PERFORMANCE TABLES
-- ============================================

-- KPI categories
CREATE TABLE IF NOT EXISTS kpi_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    weight DECIMAL(5,2) DEFAULT 100,
    target_value DECIMAL(10,2),
    unit VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE
);

-- User KPI targets
CREATE TABLE IF NOT EXISTS user_kpi_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    kpi_category_id UUID REFERENCES kpi_categories(id),
    period_type VARCHAR(20) CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_value DECIMAL(10,2) NOT NULL,
    achieved_value DECIMAL(10,2) DEFAULT 0,
    achievement_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN target_value > 0 THEN (achieved_value / target_value) * 100
            ELSE 0
        END
    ) STORED,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, kpi_category_id, period_start, period_end)
);

-- KPI achievement records
CREATE TABLE IF NOT EXISTS kpi_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    kpi_category_id UUID REFERENCES kpi_categories(id),
    achievement_date DATE NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    remarks TEXT,
    recorded_by VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. NOTIFICATIONS & AUDIT TABLES
-- ============================================

-- System notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) CHECK (type IN ('info', 'warning', 'error', 'success', 'task', 'leave', 'overtime')),
    is_read BOOLEAN DEFAULT FALSE,
    related_module VARCHAR(50),
    related_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Activity audit log
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES auth_users(user_id),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. SYSTEM CONFIGURATION TABLES
-- ============================================

-- Department configuration
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_code VARCHAR(20) UNIQUE NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    manager_id VARCHAR(50) REFERENCES auth_users(user_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shift configuration
CREATE TABLE IF NOT EXISTS shift_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_code CHAR(1) UNIQUE NOT NULL CHECK (shift_code IN ('A', 'B', 'C', 'G')),
    shift_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'text',
    description TEXT,
    is_editable BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. CLOUD SYNC TABLE (For mobile/web app sync)
-- ============================================

-- Main sync table (as used in the JavaScript code)
CREATE TABLE IF NOT EXISTS task_manager_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT,
    tasks JSONB DEFAULT '{}',
    logs JSONB DEFAULT '[]',
    users JSONB DEFAULT '[]',
    auth_users JSONB DEFAULT '[]',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Auth users indexes
CREATE INDEX IF NOT EXISTS idx_auth_users_user_id ON auth_users(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_department ON auth_users(department);
CREATE INDEX IF NOT EXISTS idx_auth_users_is_active ON auth_users(is_active);

-- Task templates indexes
CREATE INDEX IF NOT EXISTS idx_task_templates_shift ON task_templates(shift);
CREATE INDEX IF NOT EXISTS idx_task_templates_active ON task_templates(is_active);

-- Daily reports indexes
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_task_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON daily_task_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_shift ON daily_task_reports(shift);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON daily_task_reports(status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date_shift_user ON daily_task_reports(report_date, shift, user_id);

-- Leave requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date_range ON leave_requests(start_date, end_date);

-- Overtime indexes
CREATE INDEX IF NOT EXISTS idx_overtime_user ON overtime_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON overtime_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON overtime_requests(status);

-- KPI indexes
CREATE INDEX IF NOT EXISTS idx_kpi_user ON user_kpi_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_period ON user_kpi_targets(period_start, period_end);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_module ON activity_log(module);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(performed_at);

-- Sync table indexes
CREATE INDEX IF NOT EXISTS idx_task_manager_data_device ON task_manager_data(device_id);
CREATE INDEX IF NOT EXISTS idx_task_manager_data_updated ON task_manager_data(last_updated);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- User dashboard view
CREATE OR REPLACE VIEW user_dashboard_view AS
SELECT 
    au.user_id,
    au.name,
    au.designation,
    au.department,
    au.role,
    COUNT(DISTINCT ur.responsibility) as responsibility_count,
    COUNT(DISTINCT CASE WHEN dtr.status = 'submitted' THEN dtr.id END) as reports_submitted,
    COUNT(DISTINCT lr.id) as leave_requests,
    COUNT(DISTINCT orr.id) as overtime_requests
FROM auth_users au
LEFT JOIN user_responsibilities ur ON au.user_id = ur.user_id
LEFT JOIN daily_task_reports dtr ON au.user_id = dtr.user_id
LEFT JOIN leave_requests lr ON au.user_id = lr.user_id
LEFT JOIN overtime_requests orr ON au.user_id = orr.user_id
WHERE au.is_active = TRUE
GROUP BY au.user_id, au.name, au.designation, au.department, au.role;

-- Monthly performance view
CREATE OR REPLACE VIEW monthly_performance_view AS
SELECT 
    dtr.user_id,
    au.name,
    DATE_TRUNC('month', dtr.report_date) as month,
    COUNT(DISTINCT dtr.id) as total_reports,
    AVG(dtr.completion_percentage) as avg_completion,
    SUM(dtr.completed_tasks) as total_completed_tasks
FROM daily_task_reports dtr
JOIN auth_users au ON dtr.user_id = au.user_id
WHERE dtr.status IN ('submitted', 'verified')
GROUP BY dtr.user_id, au.name, DATE_TRUNC('month', dtr.report_date);

-- ============================================
-- DEFAULT DATA INSERTIONS
-- ============================================

-- Insert default admin user (password: 'admin')
INSERT INTO auth_users (
    user_id, 
    password_hash, 
    name, 
    designation, 
    department, 
    role, 
    is_active
) VALUES (
    'admin',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeS7.6O2m2WUcBq5.2ZJ6Vp3v8J7q8kQa', -- bcrypt hash for 'admin'
    'System Administrator',
    'System Administrator',
    'IT',
    'Administrator',
    TRUE
) ON CONFLICT (user_id) DO NOTHING;

-- Insert default responsibilities for admin
INSERT INTO user_responsibilities (user_id, responsibility, granted_by)
SELECT 
    'admin', 
    responsibility,
    'system'
FROM (VALUES 
    ('Task Management'),
    ('User Profile'),
    ('Leave Management'),
    ('Overtime Management'),
    ('KPI'),
    ('User Management')
) AS responsibilities(responsibility)
ON CONFLICT (user_id, responsibility) DO NOTHING;

-- Insert default departments
INSERT INTO departments (department_code, department_name, is_active) VALUES
('PROD', 'Production', TRUE),
('MAINT', 'Maintenance', TRUE),
('QUAL', 'Quality Control', TRUE),
('LOG', 'Logistics', TRUE),
('HR', 'Human Resources', TRUE),
('ADMIN', 'Administration', TRUE),
('IT', 'Information Technology', TRUE)
ON CONFLICT (department_code) DO NOTHING;

-- Insert default shift configurations
INSERT INTO shift_configuration (shift_code, shift_name, start_time, end_time, description) VALUES
('A', 'Shift A', '06:00:00', '14:00:00', 'Morning Shift'),
('B', 'Shift B', '14:00:00', '22:00:00', 'Afternoon Shift'),
('C', 'Shift C', '22:00:00', '06:00:00', 'Night Shift'),
('G', 'Shift G', '08:00:00', '17:00:00', 'General Shift')
ON CONFLICT (shift_code) DO NOTHING;

-- Insert default leave types
INSERT INTO leave_types (type_name, description, max_days_per_year, requires_approval) VALUES
('Annual Leave', 'Paid annual vacation leave', 18, TRUE),
('Sick Leave', 'Leave due to illness', 14, TRUE),
('Casual Leave', 'Casual/personal leave', 10, TRUE),
('Maternity Leave', 'Maternity leave', 84, FALSE),
('Paternity Leave', 'Paternity leave', 7, FALSE),
('Emergency Leave', 'Emergency situations', 5, TRUE)
ON CONFLICT (type_name) DO NOTHING;

-- Insert default task categories
INSERT INTO task_categories (category_name, description, color_code) VALUES
('Safety', 'Safety-related tasks', '#ef4444'),
('Quality', 'Quality control tasks', '#10b981'),
('Production', 'Production-related tasks', '#3b82f6'),
('Maintenance', 'Equipment maintenance tasks', '#f59e0b'),
('Cleaning', 'Workspace cleaning tasks', '#8b5cf6'),
('Documentation', 'Record keeping tasks', '#06b6d4')
ON CONFLICT (category_name) DO NOTHING;

-- Insert default task templates for each shift
DO $$
DECLARE
    shift_code CHAR;
    task_texts TEXT[];
    v_task_text TEXT;
    category_id UUID;
BEGIN
    -- Safety category
    SELECT id INTO category_id 
    FROM task_categories 
    WHERE category_name = 'Safety';

    -- For each shift
    FOR shift_code IN SELECT unnest(ARRAY['A', 'B', 'C', 'G']) LOOP
        task_texts := ARRAY[
            'Check safety equipment functionality',
            'Verify emergency exits are clear',
            'Inspect fire extinguishers',
            'Review safety procedures with team',
            'Check first aid kit supplies'
        ];

        FOREACH v_task_text IN ARRAY task_texts LOOP
            INSERT INTO task_templates (shift, task_text, display_order, created_by)
            VALUES (shift_code, v_task_text, 1, 'system')
            ON CONFLICT (shift, task_text) DO NOTHING;

            INSERT INTO task_template_categories (task_template_id, category_id)
            SELECT tt.id, category_id
            FROM task_templates tt
            WHERE tt.shift = shift_code
              AND tt.task_text = v_task_text
            ON CONFLICT DO NOTHING;
        END LOOP;

        -- Production category
        SELECT id INTO category_id 
        FROM task_categories 
        WHERE category_name = 'Production';

        task_texts := ARRAY[
            'Check machine startup procedures',
            'Verify raw material availability',
            'Monitor production quality metrics',
            'Record production output data',
            'Check finished goods quality'
        ];

        FOREACH v_task_text IN ARRAY task_texts LOOP
            INSERT INTO task_templates (shift, task_text, display_order, created_by)
            VALUES (shift_code, v_task_text, 2, 'system')
            ON CONFLICT (shift, task_text) DO NOTHING;

            INSERT INTO task_template_categories (task_template_id, category_id)
            SELECT tt.id, category_id
            FROM task_templates tt
            WHERE tt.shift = shift_code
              AND tt.task_text = v_task_text
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;


-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('company_name', 'Task Manager Pro', 'text', 'Company name for display'),
('auto_sync_interval', '300', 'number', 'Auto-sync interval in seconds'),
('default_shift', 'A', 'text', 'Default shift for new reports'),
('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout'),
('password_expiry_days', '90', 'number', 'Password expiry in days'),
('session_timeout_minutes', '30', 'number', 'Session timeout in minutes'),
('enable_email_notifications', 'false', 'boolean', 'Enable email notifications')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default KPI categories
INSERT INTO kpi_categories (category_name, description, weight, target_value, unit) VALUES
('Task Completion Rate', 'Percentage of tasks completed', 30, 95, '%'),
('Report Submission', 'Timely report submission', 20, 100, '%'),
('Quality Compliance', 'Quality standard compliance', 25, 98, '%'),
('Safety Compliance', 'Safety procedure compliance', 15, 100, '%'),
('Team Collaboration', 'Team collaboration score', 10, 90, 'points')
ON CONFLICT (category_name) DO NOTHING;

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to relevant tables
DO $$
DECLARE
    tbl_name TEXT;
BEGIN
    FOR tbl_name IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'auth_users',
            'task_templates',
            'daily_task_reports',
            'leave_requests',
            'overtime_requests',
            'system_settings',
            'task_manager_data'
        )
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_updated_at ON %I;
            CREATE TRIGGER update_%s_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (
        user_id, 
        action, 
        module, 
        record_id, 
        old_values, 
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        NEW.user_id,
        TG_OP,
        TG_TABLE_NAME,
        NEW.id,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        NULL, -- In real app, get from application context
        NULL  -- In real app, get from application context
    );
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to create notification for new reports
CREATE OR REPLACE FUNCTION notify_report_submission()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        related_module,
        related_id
    ) VALUES (
        NEW.user_id,
        'Daily Report Submitted',
        format('Your daily report for %s (Shift %s) has been submitted successfully.', 
               NEW.report_date, NEW.shift),
        'success',
        'tasks',
        NEW.id
    );
    
    -- Also notify manager if user has one
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        related_module,
        related_id
    )
    SELECT 
        au.manager_id,
        'New Report Submitted',
        format('%s has submitted daily report for %s (Shift %s)', 
               NEW.operator_name, NEW.report_date, NEW.shift),
        'task',
        'tasks',
        NEW.id
    FROM auth_users au
    WHERE au.user_id = NEW.user_id AND au.manager_id IS NOT NULL;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply notification trigger to daily reports
DROP TRIGGER IF EXISTS trigger_notify_report_submission ON daily_task_reports;
CREATE TRIGGER trigger_notify_report_submission
AFTER INSERT ON daily_task_reports
FOR EACH ROW
EXECUTE FUNCTION notify_report_submission();

-- Function to calculate completion percentage
CREATE OR REPLACE FUNCTION calculate_completion_percentage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_tasks > 0 THEN
        NEW.completion_percentage = (NEW.completed_tasks::DECIMAL / NEW.total_tasks) * 100;
    ELSE
        NEW.completion_percentage = 0;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply completion percentage trigger
DROP TRIGGER IF EXISTS trigger_calculate_completion ON daily_task_reports;
CREATE TRIGGER trigger_calculate_completion
BEFORE INSERT OR UPDATE ON daily_task_reports
FOR EACH ROW
EXECUTE FUNCTION calculate_completion_percentage();

-- Function to update leave balance when leave is approved
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        UPDATE leave_balances lb
        SET used = used + NEW.total_days
        WHERE lb.user_id = NEW.user_id
        AND lb.leave_type_id = NEW.leave_type_id
        AND lb.year = EXTRACT(YEAR FROM NEW.start_date);
    END IF;
    
    IF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
        UPDATE leave_balances lb
        SET used = used - NEW.total_days
        WHERE lb.user_id = NEW.user_id
        AND lb.leave_type_id = NEW.leave_type_id
        AND lb.year = EXTRACT(YEAR FROM NEW.start_date);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply leave balance trigger
DROP TRIGGER IF EXISTS trigger_update_leave_balance ON leave_requests;
CREATE TRIGGER trigger_update_leave_balance
AFTER UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION update_leave_balance();

-- ============================================
-- STORED PROCEDURES
-- ============================================

-- Procedure to generate monthly report
CREATE OR REPLACE PROCEDURE generate_monthly_report(
    p_month DATE,
    p_department VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    report_data JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', au.user_id,
            'name', au.name,
            'designation', au.designation,
            'total_reports', COUNT(dtr.id),
            'avg_completion', AVG(dtr.completion_percentage),
            'total_completed_tasks', SUM(dtr.completed_tasks),
            'leave_days', COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days ELSE 0 END), 0),
            'overtime_hours', COALESCE(SUM(CASE WHEN orr.status = 'approved' THEN orr.total_hours ELSE 0 END), 0)
        )
    ) INTO report_data
    FROM auth_users au
    LEFT JOIN daily_task_reports dtr ON au.user_id = dtr.user_id 
        AND DATE_TRUNC('month', dtr.report_date) = DATE_TRUNC('month', p_month)
        AND dtr.status IN ('submitted', 'verified')
    LEFT JOIN leave_requests lr ON au.user_id = lr.user_id 
        AND DATE_TRUNC('month', lr.start_date) = DATE_TRUNC('month', p_month)
    LEFT JOIN overtime_requests orr ON au.user_id = orr.user_id 
        AND DATE_TRUNC('month', orr.request_date) = DATE_TRUNC('month', p_month)
    WHERE au.is_active = TRUE
        AND (p_department IS NULL OR au.department = p_department)
    GROUP BY au.user_id, au.name, au.designation;
    
    -- Here you could insert into a reports table or return the data
    RAISE NOTICE 'Monthly report generated for %: % records', p_month, jsonb_array_length(report_data);
    
    -- For demonstration, just raise notice
    -- In production, you might want to INSERT INTO a reports table
END;
$$;

-- Procedure to sync task manager data
CREATE OR REPLACE PROCEDURE sync_task_manager_data(
    p_device_id TEXT,
    p_tasks JSONB,
    p_logs JSONB,
    p_users JSONB,
    p_auth_users JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_record_id UUID;
BEGIN
    -- Check if record exists for this device
    SELECT id INTO v_record_id 
    FROM task_manager_data 
    WHERE device_id = p_device_id;
    
    IF v_record_id IS NOT NULL THEN
        -- Update existing record
        UPDATE task_manager_data 
        SET 
            tasks = p_tasks,
            logs = p_logs,
            users = p_users,
            auth_users = p_auth_users,
            last_updated = CURRENT_TIMESTAMP,
            sync_status = 'synced'
        WHERE id = v_record_id;
    ELSE
        -- Insert new record
        INSERT INTO task_manager_data (
            device_id,
            tasks,
            logs,
            users,
            auth_users,
            sync_status
        ) VALUES (
            p_device_id,
            p_tasks,
            p_logs,
            p_users,
            p_auth_users,
            'synced'
        );
    END IF;
    
    COMMIT;
END;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- In a production environment, you would create specific roles and grant permissions
-- This is a basic example:

/*
-- Create application role
CREATE ROLE task_manager_app LOGIN PASSWORD 'secure_password';

-- Grant basic permissions
GRANT CONNECT ON DATABASE your_database TO task_manager_app;
GRANT USAGE ON SCHEMA public TO task_manager_app;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO task_manager_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO task_manager_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO task_manager_app;
*/

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE auth_users IS 'Stores user authentication and profile information';
COMMENT ON TABLE user_responsibilities IS 'Junction table for user-responsibility mapping';
COMMENT ON TABLE task_templates IS 'Master list of tasks for each shift';
COMMENT ON TABLE daily_task_reports IS 'Daily task completion reports';
COMMENT ON TABLE task_checks IS 'Individual task completion records';
COMMENT ON TABLE leave_requests IS 'Employee leave requests and approvals';
COMMENT ON TABLE overtime_requests IS 'Overtime work requests and approvals';
COMMENT ON TABLE user_kpi_targets IS 'User performance targets and achievements';
COMMENT ON TABLE notifications IS 'System notifications for users';
COMMENT ON TABLE activity_log IS 'Audit log for user activities';
COMMENT ON TABLE task_manager_data IS 'Cloud sync data for mobile/web applications';

COMMENT ON COLUMN auth_users.password_hash IS 'BCrypt hashed password';
COMMENT ON COLUMN daily_task_reports.completion_percentage IS 'Automatically calculated percentage';
COMMENT ON COLUMN leave_balances.remaining IS 'Generated column: total_allotted - used';
COMMENT ON COLUMN user_kpi_targets.achievement_percentage IS 'Generated column: (achieved_value / target_value) * 100';

-- ============================================
-- MIGRATION SCRIPT FOR EXISTING DATA
-- ============================================

-- This script would be run to migrate existing data from localStorage
-- It's commented out as it's for reference only

/*
-- Example migration from JSON data (run once)
DO $$
DECLARE
    json_data JSONB;
BEGIN
    -- Get existing JSON data if stored somewhere
    -- json_data := '{"tasks": {...}, "logs": [...], "users": [...]}'::JSONB;
    
    -- Migrate users
    INSERT INTO auth_users (user_id, name, designation, department, role, password_hash, is_active)
    SELECT 
        'user_' || row_number() OVER (),
        u::TEXT,
        'Operator',
        'Production',
        'Worker',
        -- Default password hash for 'password123'
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeS7.6O2m2WUcBq5.2ZJ6Vp3v8J7q8kQa',
        TRUE
    FROM jsonb_array_elements_text(json_data->'users') u
    ON CONFLICT DO NOTHING;
    
    -- Additional migration logic here...
END $$;
*/

-- ============================================
-- COMPLETE SCHEMA CREATION SCRIPT ENDS
-- ============================================
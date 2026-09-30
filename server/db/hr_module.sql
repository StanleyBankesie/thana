-- Human Resources Module Schema
-- Version: 1.0.0
-- Description: Complete HR module for Seriana Mart ERP

SET FOREIGN_KEY_CHECKS = 0;

-- 👤 Core Tables

-- hr_departments
CREATE TABLE IF NOT EXISTS hr_departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  dept_code VARCHAR(20) NOT NULL,
  dept_name VARCHAR(100) NOT NULL,
  manager_id BIGINT UNSIGNED NULL,
  parent_dept_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_dept_code (company_id, dept_code),
  KEY idx_dept_company (company_id),
  KEY idx_dept_manager (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_positions
CREATE TABLE IF NOT EXISTS hr_positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  pos_code VARCHAR(20) NOT NULL,
  pos_name VARCHAR(100) NOT NULL,
  dept_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pos_code (company_id, pos_code),
  KEY idx_pos_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_employees
CREATE TABLE IF NOT EXISTS hr_employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL COMMENT 'Link to adm_users',
  emp_code VARCHAR(20) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) NULL,
  gender ENUM('MALE', 'FEMALE', 'OTHER') NULL,
  dob DATE NULL,
  joining_date DATE NOT NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  dept_id BIGINT UNSIGNED NULL,
  pos_id BIGINT UNSIGNED NULL,
  manager_id BIGINT UNSIGNED NULL,
  employment_type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN') NOT NULL DEFAULT 'FULL_TIME',
  status ENUM('PROBATION', 'ACTIVE', 'TERMINATED', 'RESIGNED', 'SUSPENDED') NOT NULL DEFAULT 'PROBATION',
  base_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
  address TEXT NULL,
  emergency_contact_name VARCHAR(100) NULL,
  emergency_contact_phone VARCHAR(20) NULL,
  bank_name VARCHAR(100) NULL,
  bank_account_no VARCHAR(50) NULL,
  tin VARCHAR(50) NULL,
  ssnit_no VARCHAR(50) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_emp_code (company_id, emp_code),
  KEY idx_emp_user (user_id),
  KEY idx_emp_dept (dept_id),
  KEY idx_emp_pos (pos_id),
  KEY idx_emp_manager (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_employee_documents
CREATE TABLE IF NOT EXISTS hr_employee_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  doc_type VARCHAR(50) NOT NULL,
  doc_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  expiry_date DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_emp_doc_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📢 Recruitment

-- hr_job_requisitions
CREATE TABLE IF NOT EXISTS hr_job_requisitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  req_no VARCHAR(20) NOT NULL,
  title VARCHAR(100) NOT NULL,
  dept_id BIGINT UNSIGNED NOT NULL,
  pos_id BIGINT UNSIGNED NOT NULL,
  vacancies INT NOT NULL DEFAULT 1,
  employment_type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN') NOT NULL,
  reason TEXT NULL,
  requirements TEXT NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_req_no (company_id, req_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_candidates
CREATE TABLE IF NOT EXISTS hr_candidates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NULL,
  resume_url VARCHAR(500) NULL,
  source VARCHAR(50) NULL,
  status ENUM('NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED') NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_job_posts (Connect Requisition to Candidates)
CREATE TABLE IF NOT EXISTS hr_job_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requisition_id BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  applied_date DATE NOT NULL,
  status ENUM('PENDING', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  remarks TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_app_req (requisition_id),
  KEY idx_app_cand (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ⏱️ Attendance & Leaves

-- hr_shifts
CREATE TABLE IF NOT EXISTS hr_shifts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shift_code (company_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_timesheets
CREATE TABLE IF NOT EXISTS hr_timesheets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_timesheet_day (employee_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_leave_balances
CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  leave_type_id BIGINT UNSIGNED NOT NULL,
  balance_days DECIMAL(6,2) NOT NULL DEFAULT 0,
  carried_forward DECIMAL(6,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_balance (employee_id, leave_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_attendance
CREATE TABLE IF NOT EXISTS hr_attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  clock_in DATETIME NULL,
  clock_out DATETIME NULL,
  status ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE') NOT NULL DEFAULT 'PRESENT',
  overtime_minutes INT NOT NULL DEFAULT 0,
  remarks VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_emp_date (employee_id, attendance_date),
  KEY idx_att_date (attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_leave_types
CREATE TABLE IF NOT EXISTS hr_leave_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  type_name VARCHAR(50) NOT NULL,
  days_per_year INT NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  carry_forward TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_leave_requests
CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  leave_type_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,2) NOT NULL,
  reason TEXT NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 💰 Payroll

-- hr_employee_salaries (optional overrides)
CREATE TABLE IF NOT EXISTS hr_employee_salaries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  basic_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
  allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
  deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_emp_salary_emp (employee_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_salary_structures
CREATE TABLE IF NOT EXISTS hr_salary_structures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_payroll (header)
CREATE TABLE IF NOT EXISTS hr_payroll (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  period_id BIGINT UNSIGNED NOT NULL,
  status ENUM('OPEN','GENERATED','CLOSED') NOT NULL DEFAULT 'OPEN',
  generated_at DATETIME NULL,
  closed_at DATETIME NULL,
  remarks VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_period (company_id, period_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_payroll_items (details)
CREATE TABLE IF NOT EXISTS hr_payroll_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payroll_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  basic_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
  allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
  deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
  net_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payroll_item_hdr (payroll_id),
  KEY idx_payroll_item_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_payroll_periods
CREATE TABLE IF NOT EXISTS hr_payroll_periods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  period_name VARCHAR(50) NOT NULL COMMENT 'e.g. March 2026',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('OPEN', 'PROCESSING', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_payslips
CREATE TABLE IF NOT EXISTS hr_payslips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  period_id BIGINT UNSIGNED NOT NULL,
  basic_salary DECIMAL(18,4) NOT NULL,
  allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
  deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
  net_salary DECIMAL(18,4) NOT NULL,
  status ENUM('DRAFT', 'PAID') NOT NULL DEFAULT 'DRAFT',
  paid_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_emp_period (employee_id, period_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_salary_components
-- Registry of every salary component column that exists in hr_payslips.
-- Fixed core columns (basic_salary, allowances, deductions, etc.) are seeded
-- on every payroll run. Dynamic columns (per-allowance, per-tax-bracket) are
-- registered automatically via generatePayroll() when payroll is processed.
CREATE TABLE IF NOT EXISTS hr_salary_components (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  column_name VARCHAR(100) NOT NULL COMMENT 'Exact column name in hr_payslips, e.g. basic_salary, allowance_3, income_tax_1',
  label VARCHAR(150) NOT NULL COMMENT 'Human-readable label shown on payslip',
  component_type ENUM(
    'BASIC',
    'ALLOWANCE',
    'INCOME_TAX',
    'SOCIAL_SECURITY',
    'PROVIDENT_FUND',
    'DEDUCTION',
    'NET_SALARY',
    'SUBTOTAL',
    'OTHER'
  ) NOT NULL DEFAULT 'OTHER',
  display_order INT NOT NULL DEFAULT 0 COMMENT 'Rendering order on payslip',
  is_earning TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = earning/addition, 0 = deduction',
  is_fixed TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = always present core column, 0 = dynamically added',
  source_type ENUM('NONE','ALLOWANCE','TAX_CONFIG') NOT NULL DEFAULT 'NONE' COMMENT 'Master table this component references',
  source_id BIGINT UNSIGNED NULL COMMENT 'FK to hr_allowances.id or hr_tax_config.id',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_comp_col (company_id, column_name),
  KEY idx_sc_company (company_id),
  KEY idx_sc_type (component_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🚪 Exit Management

-- hr_exits
CREATE TABLE IF NOT EXISTS hr_exits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  exit_type ENUM('RESIGNATION', 'TERMINATION', 'RETIREMENT') NOT NULL,
  resignation_date DATE NULL,
  last_working_day DATE NOT NULL,
  reason TEXT NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📢 Recruitment (extended)

-- hr_interviews
CREATE TABLE IF NOT EXISTS hr_interviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  interviewer_user_id BIGINT UNSIGNED NULL,
  scheduled_at DATETIME NOT NULL,
  status ENUM('SCHEDULED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  feedback TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_interviews_req (requisition_id),
  KEY idx_interviews_candidate (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_offers
CREATE TABLE IF NOT EXISTS hr_offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  offer_no VARCHAR(30) NOT NULL,
  offer_date DATE NOT NULL,
  position_id BIGINT UNSIGNED NULL,
  gross_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
  allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
  deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
  net_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
  status ENUM('DRAFT','PENDING','APPROVED','REJECTED','ACCEPTED') NOT NULL DEFAULT 'DRAFT',
  remarks TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_offer_no (company_id, offer_no),
  KEY idx_offers_req (requisition_id),
  KEY idx_offers_candidate (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🚀 Onboarding

-- hr_onboarding_checklists (templates)
CREATE TABLE IF NOT EXISTS hr_onboarding_checklists (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_onb_checklist (company_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_onboarding_tasks (template tasks)
CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  checklist_id BIGINT UNSIGNED NOT NULL,
  task_order INT NOT NULL DEFAULT 1,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  mandatory TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_onb_tasks_checklist (checklist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_onboarding_assignments (assignment of template to employee)
CREATE TABLE IF NOT EXISTS hr_onboarding_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  checklist_id BIGINT UNSIGNED NOT NULL,
  assigned_date DATE NOT NULL,
  status ENUM('PENDING','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'PENDING',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_onb_assign_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hr_onboarding_assignment_tasks (materialized tasks per assignment)
CREATE TABLE IF NOT EXISTS hr_onboarding_assignment_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL,
  task_order INT NOT NULL DEFAULT 1,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_onb_assignment_task (assignment_id, task_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📊 Performance
CREATE TABLE IF NOT EXISTS hr_kpis (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  target_value DECIMAL(12,2) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kpi_code (company_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  period_name VARCHAR(50) NOT NULL,
  reviewer_user_id BIGINT UNSIGNED NOT NULL,
  overall_rating DECIMAL(5,2) NULL,
  comments TEXT NULL,
  status ENUM('DRAFT','SUBMITTED','APPROVED') NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_perf_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🎓 Training
CREATE TABLE IF NOT EXISTS hr_training_programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_code (company_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hr_training_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  program_id BIGINT UNSIGNED NOT NULL,
  completion_date DATE NULL,
  status ENUM('ENROLLED','COMPLETED','FAILED') NOT NULL DEFAULT 'ENROLLED',
  remarks TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_training_emp (employee_id),
  KEY idx_training_program (program_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📂 Compliance
CREATE TABLE IF NOT EXISTS hr_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  title VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT NULL,
  attachment_name VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_policy_code (company_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hr_policy_acknowledgements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  policy_id BIGINT UNSIGNED NOT NULL,
  acknowledged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ack_policy (policy_id),
  KEY idx_ack_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🚪 Clearance
CREATE TABLE IF NOT EXISTS hr_clearance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  exit_id BIGINT UNSIGNED NOT NULL,
  department VARCHAR(100) NOT NULL,
  cleared TINYINT(1) NOT NULL DEFAULT 0,
  cleared_at DATETIME NULL,
  remarks TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_clearance_exit (exit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

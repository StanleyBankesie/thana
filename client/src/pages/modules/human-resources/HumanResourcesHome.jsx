/**
 * @fileoverview HumanResourcesHome component.
 * Provides functionality for HumanResourcesHome.
 */

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api } from "../../../api/client.js";

import EmployeeList from "./employees/EmployeeList.jsx";
import EmployeeForm from "./employees/EmployeeForm.jsx";
import HRSetup from "./HRSetup.jsx";
import OrganogramPage from "./organogram/OrganogramPage.jsx";
import LeaveSetupList from "./leave-setup/LeaveSetupList.jsx";
import LeaveSetupForm from "./leave-setup/LeaveSetupForm.jsx";
import ShiftList from "./shifts/ShiftList.jsx";
import ShiftForm from "./shifts/ShiftForm.jsx";
import WorkScheduleManagement from "./work-schedules/WorkScheduleManagement.jsx";
import RosterManagement from "./roster/RosterManagement.jsx";
import AttendanceList from "./attendance/AttendanceList.jsx";
import AttendanceForm from "./attendance/AttendanceForm.jsx";
import SalaryConfigList from "./salary-config/SalaryConfigList.jsx";
import SalaryConfigForm from "./salary-config/SalaryConfigForm.jsx";
import BaseSalariesPage from "./salary-config/BaseSalariesPage.jsx";
import SalaryStructurePage from "./salary-config/SalaryStructurePage.jsx";
import TaxConfigList from "./tax-config/TaxConfigList.jsx";
import TaxConfigForm from "./tax-config/TaxConfigForm.jsx";
import AllowanceList from "./allowances/AllowanceList.jsx";
import AllowanceForm from "./allowances/AllowanceForm.jsx";
import LoanList from "./loans/LoanList.jsx";
import LoanForm from "./loans/LoanForm.jsx";
import PayslipList from "./payslips/PayslipList.jsx";
import PayslipForm from "./payslips/PayslipForm.jsx";
import PromotionList from "./promotions/PromotionList.jsx";
import PromotionForm from "./promotions/PromotionForm.jsx";
import RequisitionList from "./recruitment/RequisitionList.jsx";
import RequisitionForm from "./recruitment/RequisitionForm.jsx";
import CandidatesList from "./recruitment/CandidatesList.jsx";
import CandidateForm from "./recruitment/CandidateForm.jsx";
import InterviewsList from "./recruitment/InterviewsList.jsx";
import InterviewForm from "./recruitment/InterviewForm.jsx";
import OffersList from "./recruitment/OffersList.jsx";
import OfferForm from "./recruitment/OfferForm.jsx";
import PayrollDashboard from "./payroll/PayrollDashboard.jsx";
import SalaryProcessing from "./payroll/SalaryProcessing.jsx";
import SalaryPostingPage from "./payroll/SalaryPostingPage.jsx";
import LeaveRequestForm from "./leave/LeaveRequestForm.jsx"; // Keeping file loosely to not break anything
import LeaveApprovals from "./leave/LeaveApprovals.jsx";
import LeaveCalendar from "./leave/LeaveCalendar.jsx";
import LeaveManagementDashboard from "./leave/LeaveManagementDashboard.jsx";
import LeaveScheduling from "./leave/LeaveScheduling.jsx";
import LeaveRoster from "./leave/LeaveRoster.jsx";
import LeaveBalances from "./leave/LeaveBalances.jsx";
import LeaveApplication from "./leave/LeaveApplication.jsx";
import LeaveRecords from "./leave/LeaveRecords.jsx";
import KPISetup from "./performance/KPISetup.jsx";
import AppraisalForm from "./performance/AppraisalForm.jsx";
import SubmitAppraisals from "./performance/SubmitAppraisals.jsx";
import TrainingPrograms from "./training/TrainingPrograms.jsx";
import TrainingHistory from "./training/TrainingHistory.jsx";
import PolicyList from "./compliance/PolicyList.jsx";
import PolicyForm from "./compliance/PolicyForm.jsx";
import PolicyViewer from "./compliance/PolicyViewer.jsx";
import ExitRequest from "./exit/ExitRequest.jsx";
import ClearanceTracking from "./exit/ClearanceTracking.jsx";
import TimesheetReport from "./attendance/TimesheetReport.jsx";
import AttendanceDashboard from "./attendance/AttendanceDashboard.jsx";
import BulkAttendance from "./attendance/BulkAttendance.jsx";
import TimesheetView from "./attendance/TimesheetView.jsx";
import MedicalPolicyList from "./medical-policies/MedicalPolicyList.jsx";
import MedicalPolicyForm from "./medical-policies/MedicalPolicyForm.jsx";
import HRReports from "./reports/HRReports.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";

export const humanResourcesSections = [
  {
    icon: "👔",
    title: "Employee Management",
    features: [
      {
        name: "Employee Setup",
        path: "/human-resources/employees",
        actions: [
          { label: "View", path: "/human-resources/employees", type: "outline" },
          { label: "New", path: "/human-resources/employees/new", type: "primary" }
        ],
        description: "Manage employee records and information",
        icon: "👥",
      },
      {
        name: "Promotions",
        path: "/human-resources/promotions",
        actions: [
          { label: "View", path: "/human-resources/promotions", type: "outline" },
          { label: "New", path: "/human-resources/promotions/new", type: "primary" }
        ],
        description: "Record employee promotions and salary changes",
        icon: "⬆",
      },
    ],
  },
  {
    title: "Organization & Structures",
    features: [
      {
        name: "Organogram",
        path: "/human-resources/organogram",
        actions: [
          { label: "View", path: "/human-resources/organogram", type: "outline" }
        ],
        description: "Interactive visual chart of company positions and reporting structure",
        icon: "📊",
      },
      {
        name: "Employee Information",
        path: "/human-resources/reports?type=employees",
        actions: [
          { label: "View", path: "/human-resources/reports?type=employees", type: "outline" }
        ],
        description: "View comprehensive employee information reports",
        icon: "👥",
      },
      {
        name: "SSF (SSNIT) Contributions",
        path: "/human-resources/reports?type=ssf",
        actions: [
          { label: "View", path: "/human-resources/reports?type=ssf", type: "outline" }
        ],
        description: "View SSF and SSNIT contribution breakdown reports",
        icon: "🛡️",
      },
      {
        name: "Income Tax (PAYE)",
        path: "/human-resources/reports?type=paye",
        actions: [
          { label: "View", path: "/human-resources/reports?type=paye", type: "outline" }
        ],
        description: "View statutory Income Tax and PAYE deduction reports",
        icon: "🧾",
      },
      {
        name: "Employee Loans",
        path: "/human-resources/reports?type=loans",
        actions: [
          { label: "View", path: "/human-resources/reports?type=loans", type: "outline" }
        ],
        description: "View employee loan statements and repayment reports",
        icon: "💳",
      },
      {
        name: "Employee Allowances",
        path: "/human-resources/reports?type=allowances",
        actions: [
          { label: "View", path: "/human-resources/reports?type=allowances", type: "outline" }
        ],
        description: "View recurring and statutory employee allowance reports",
        icon: "🎁",
      },
    ],
  },
  {
    title: "Time & Attendance",
    features: [
      {
        name: "Clock In/Out",
        path: "/human-resources/attendance",
        actions: [
          { label: "View", path: "/human-resources/attendance", type: "outline" },
          { label: "New", path: "/human-resources/attendance/new", type: "primary" }
        ],
        description: "Daily attendance dashboard and logging",
        icon: "⏰",
      },
      {
        name: "Timesheet Entry",
        path: "/human-resources/timesheet",
        actions: [
          { label: "View", path: "/human-resources/timesheet", type: "outline" },
          { label: "New", path: "/human-resources/timesheet/new", type: "primary" }
        ],
        description: "Track project and task work hours",
        icon: "⏱",
      },
      {
        name: "Timesheet Report",
        path: "/human-resources/timesheet-report",
        actions: [
          { label: "View", path: "/human-resources/timesheet-report", type: "outline" }
        ],
        description: "View and filter comprehensive timesheet logs and hours",
        icon: "📊",
      },
      {
        name: "Work Schedule Management",
        path: "/human-resources/work-schedules",
        actions: [
          { label: "View", path: "/human-resources/work-schedules", type: "outline" },
          { label: "New", path: "/human-resources/work-schedules/new", type: "primary" }
        ],
        description: "Define employee work schedules",
        icon: "📆",
      },
      {
        name: "Roster Management",
        path: "/human-resources/roster",
        actions: [
          { label: "View", path: "/human-resources/roster", type: "outline" },
          { label: "New", path: "/human-resources/roster/new", type: "primary" }
        ],
        description: "Manage shift rosters",
        icon: "📅",
      },
    ],
  },
  {
    title: "Leave Management",
    features: [
      {
        name: "Apply for Leave",
        path: "/human-resources/leave/apply",
        actions: [
          { label: "View", path: "/human-resources/leave/apply", type: "outline" },
          { label: "New", path: "/human-resources/leave/apply/new", type: "primary" }
        ],
        description: "Submit a new leave application",
        icon: "✍️",
      },
      {
        name: "My Leave Records",
        path: "/human-resources/leave/records",
        actions: [
          { label: "View", path: "/human-resources/leave/records", type: "outline" },
          { label: "New", path: "/human-resources/leave/records/new", type: "primary" }
        ],
        description: "View your personal leave history and status",
        icon: "📋",
      },
      {
        name: "Leave Scheduling",
        path: "/human-resources/leave-scheduling",
        actions: [
          { label: "View", path: "/human-resources/leave-scheduling", type: "outline" },
          { label: "New", path: "/human-resources/leave-scheduling/new", type: "primary" }
        ],
        description: "Annual leave planning and approvals",
        icon: "🗓",
      },
      {
        name: "Department Leave Roster",
        path: "/human-resources/leave-roster",
        actions: [
          { label: "View", path: "/human-resources/leave-roster", type: "outline" },
          { label: "New", path: "/human-resources/leave-roster/new", type: "primary" }
        ],
        description: "View department leave calendar",
        icon: "👥",
      },
      {
        name: "Staff Leave Balances",
        path: "/human-resources/leave-balances",
        actions: [
          { label: "View", path: "/human-resources/leave-balances", type: "outline" },
          { label: "New", path: "/human-resources/leave-balances/new", type: "primary" }
        ],
        description: "Track entitlement and days taken per staff",
        icon: "📊",
      },
    ],
  },
  {
    title: "Payroll & Benefits",
    features: [
      {
        name: "Process Payroll",
        path: "/human-resources/payroll/process",
        actions: [
          { label: "View", path: "/human-resources/payroll/process", type: "outline" },
          { label: "New", path: "/human-resources/payroll/process/new", type: "primary" }
        ],
        description: "Generate and finalize monthly payroll",
        icon: "💰",
      },
      {
        name: "Salary Configurations",
        path: "/human-resources/salary-config",
        actions: [
          { label: "View", path: "/human-resources/salary-config", type: "outline" },
          { label: "New", path: "/human-resources/salary-config/new", type: "primary" }
        ],
        description: "Configure employee base pay and structures",
        icon: "💵",
      },
      {
        name: "Statutory Contributions",
        path: "/human-resources/tax-config",
        actions: [
          { label: "View", path: "/human-resources/tax-config", type: "outline" },
          { label: "New", path: "/human-resources/tax-config/new", type: "primary" }
        ],
        description: "Configure payroll deductions and statutory taxes",
        icon: "📜",
      },
      {
        name: "Allowances",
        path: "/human-resources/allowances",
        actions: [
          { label: "View", path: "/human-resources/allowances", type: "outline" },
          { label: "New", path: "/human-resources/allowances/new", type: "primary" }
        ],
        description: "Manage employee recurring allowances",
        icon: "➕",
      },
      {
        name: "Employee Loans",
        path: "/human-resources/loans",
        actions: [
          { label: "View", path: "/human-resources/loans", type: "outline" },
          { label: "New", path: "/human-resources/loans/new", type: "primary" }
        ],
        description: "Track and manage staff loans",
        icon: "🏦",
      },
      {
        name: "Payslips",
        path: "/human-resources/payslips",
        actions: [
          { label: "View", path: "/human-resources/payslips", type: "outline" },
          { label: "New", path: "/human-resources/payslips/new", type: "primary" }
        ],
        description: "View and generate employee payslips",
        icon: "🧾",
      },
      {
        name: "Salary Posting",
        path: "/human-resources/payroll/salary-posting",
        actions: [
          { label: "View", path: "/human-resources/payroll/salary-posting", type: "outline" },
          { label: "New", path: "/human-resources/payroll/salary-posting/new", type: "primary" }
        ],
        description: "Post finalized salary to finance",
        icon: "💸",
      },
    ],
  },
  {
    title: "Settings & Setup",
    features: [
      {
        name: "HR Master Setup",
        path: "/human-resources/setup",
        actions: [
          { label: "View", path: "/human-resources/setup", type: "outline" }
        ],
        description: "Configure departments, shifts, categories, and HR parameters",
        icon: "🛠️",
      },
      {
        name: "Branches Setup",
        path: "/human-resources/setup?tab=locations",
        actions: [
          { label: "View", path: "/human-resources/setup?tab=locations", type: "outline" }
        ],
        description: "Manage company branch locations",
        icon: "📍",
      },
      {
        name: "Job Roles Setup",
        path: "/human-resources/setup?tab=positions",
        actions: [
          { label: "View", path: "/human-resources/setup?tab=positions", type: "outline" }
        ],
        description: "Define job roles and position hierarchy",
        icon: "📋",
      },
      {
        name: "Payroll Elements",
        path: "/human-resources/allowances",
        actions: [
          { label: "View", path: "/human-resources/allowances", type: "outline" },
          { label: "New", path: "/human-resources/allowances/new", type: "primary" }
        ],
        description: "Manage custom earnings and deduction types",
        icon: "⚙️",
      },
      {
        name: "Leave Parameters",
        path: "/human-resources/leave-setup",
        actions: [
          { label: "View", path: "/human-resources/leave-setup", type: "outline" }
        ],
        description: "Configure leave types and entitlements",
        icon: "🏖️",
      },
      {
        name: "Attendance Policies",
        path: "/human-resources/work-schedules",
        actions: [
          { label: "View", path: "/human-resources/work-schedules", type: "outline" },
          { label: "New", path: "/human-resources/work-schedules/new", type: "primary" }
        ],
        description: "Configure work shifts, grace periods, and rules",
        icon: "🕒",
      },
      {
        name: "Medical Policies",
        path: "/human-resources/medical-policies",
        actions: [
          { label: "View", path: "/human-resources/medical-policies", type: "outline" },
          { label: "New", path: "/human-resources/medical-policies/new", type: "primary" }
        ],
        description: "Manage staff health insurance and medical policies",
        icon: "🏥",
      },
    ],
  },
  {
    title: "Analytics & Performance",
    features: [
      {
        name: "HR Analytics Dashboard",
        path: "/human-resources/reports",
        actions: [
          { label: "View", path: "/human-resources/reports", type: "outline" }
        ],
        description: "Workforce demographics, turnover, and KPIs",
        icon: "📈",
      },
      {
        name: "Appraisal Form",
        path: "/human-resources/performance/appraisal",
        actions: [
          { label: "View", path: "/human-resources/performance/appraisal", type: "outline" },
          { label: "New", path: "/human-resources/performance/appraisal/new", type: "primary" }
        ],
        description: "Fill performance appraisal forms",
        icon: "📝",
      },
      {
        name: "Submit Appraisals",
        path: "/human-resources/performance/submit",
        actions: [
          { label: "View", path: "/human-resources/performance/submit", type: "outline" },
          { label: "New", path: "/human-resources/performance/submit/new", type: "primary" }
        ],
        description: "Submit or review employee performance appraisals",
        icon: "⭐",
      },
      {
        name: "KPI Parameters",
        path: "/human-resources/performance/kpis",
        actions: [
          { label: "View", path: "/human-resources/performance/kpis", type: "outline" },
          { label: "New", path: "/human-resources/performance/kpis/new", type: "primary" }
        ],
        description: "Set performance indicators per role",
        icon: "🎯",
      },
      {
        name: "Training Programs",
        path: "/human-resources/training",
        actions: [
          { label: "View", path: "/human-resources/training", type: "outline" },
          { label: "New", path: "/human-resources/training/new", type: "primary" }
        ],
        description: "Manage company training programs",
        icon: "🎓",
      },
      {
        name: "Training History",
        path: "/human-resources/training/history",
        actions: [
          { label: "View", path: "/human-resources/training/history", type: "outline" },
          { label: "New", path: "/human-resources/training/history/new", type: "primary" }
        ],
        description: "View employee training records",
        icon: "📜",
      },
      {
        name: "Company Policies",
        path: "/human-resources/compliance/policies",
        actions: [
          { label: "View", path: "/human-resources/compliance/policies", type: "outline" },
          { label: "New", path: "/human-resources/compliance/policies/new", type: "primary" }
        ],
        description: "Publish and enforce HR compliance policies",
        icon: "📜",
      },
      {
        name: "Offboarding & Clearance",
        path: "/human-resources/exit/clearance",
        actions: [
          { label: "View", path: "/human-resources/exit/clearance", type: "outline" },
          { label: "New", path: "/human-resources/exit/clearance/new", type: "primary" }
        ],
        description: "Manage exit requests and asset return",
        icon: "🚪",
      },
    ],
  },
];

function HRDashboard() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "total-employees",
      value: "—",
      label: "Total Employees",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/employees",
        actions: [
          { label: "View", path: "/human-resources/employees", type: "outline" },
          { label: "New", path: "/human-resources/employees/new", type: "primary" }
        ],
    },
    {
      rbac_key: "active-on-leave",
      value: "—",
      label: "Active on Leave",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/leave-balances",
        actions: [
          { label: "View", path: "/human-resources/leave-balances", type: "outline" },
          { label: "New", path: "/human-resources/leave-balances/new", type: "primary" }
        ],
    },
    {
      rbac_key: "monthly-payroll",
      value: "—",
      label: "Monthly Payroll",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/payroll/process",
        actions: [
          { label: "View", path: "/human-resources/payroll/process", type: "outline" },
          { label: "New", path: "/human-resources/payroll/process/new", type: "primary" }
        ],
    },
    {
      rbac_key: "pending-approvals",
      value: "—",
      label: "Pending Approvals",
      change: "Loading…",
      changeType: "neutral",
      path: "/human-resources/leave-scheduling",
        actions: [
          { label: "View", path: "/human-resources/leave-scheduling", type: "outline" },
          { label: "New", path: "/human-resources/leave-scheduling/new", type: "primary" }
        ],
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/hr/dashboard-stats");
        const d = resp?.data?.data || resp?.data;
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(d.activeEmployees ?? d.totalEmployees ?? "—"),
              change: `${d.activeEmployees ?? 0} active`,
              changeType: "positive",
            };
            next[1] = {
              ...next[1],
              value: String(d.onLeaveToday ?? d.onLeaveCount ?? "—"),
              change: `${d.presentToday ?? 0} present today`,
              changeType: "neutral",
            };
            next[2] = {
              ...next[2],
              value: String(d.payrollStatus || "Current month"),
              change: d.latestPayrollPeriod || "Status",
              changeType: "neutral",
            };
            next[3] = {
              ...next[3],
              value: String(d.pendingLeaveRequests ?? d.pendingLeaveCount ?? "0"),
              change:
                (d.pendingLeaveRequests || d.pendingLeaveCount) > 0
                  ? "Requires review"
                  : "All clear",
              changeType:
                (d.pendingLeaveRequests || d.pendingLeaveCount) > 0
                  ? "warning"
                  : "positive",
            };
            return next;
          });
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModuleDashboard
      useSectionNavigation={true}
      title="Human Resources"
      description="Employee management and payroll processing"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/human-resources/dashboard",
        actions: [
          { label: "View", path: "/human-resources/dashboard", type: "outline" }
        ], icon: "📊" },
      ]}
      sections={humanResourcesSections}
      features={humanResourcesFeatures}
    />
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function HumanResourcesHome() {
  return (
    <ModuleLayout sections={humanResourcesSections} moduleKey="human-resources">
      <Routes>
        <Route index element={<HRDashboard />} />
      <Route
        path="dashboard"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./HRDashboardPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route path="employees" element={<EmployeeList />} />
      <Route path="employees/new" element={<EmployeeForm />} />
      <Route path="employees/:id" element={<EmployeeForm />} />
      <Route path="setup" element={<HRSetup />} />
      <Route path="work-schedules" element={<WorkScheduleManagement />} />
      <Route path="roster" element={<RosterManagement />} />
      <Route path="requisitions" element={<RequisitionList />} />
      <Route path="requisitions/new" element={<RequisitionForm />} />
      <Route path="requisitions/:id" element={<RequisitionForm />} />
      <Route path="candidates" element={<CandidatesList />} />
      <Route path="candidates/new" element={<CandidateForm />} />
      <Route path="candidates/:id" element={<CandidateForm />} />
      <Route path="interviews" element={<InterviewsList />} />
      <Route path="interviews/new" element={<InterviewForm />} />
      <Route path="interviews/:id" element={<InterviewForm />} />
      <Route path="offers" element={<OffersList />} />
      <Route path="offers/new" element={<OfferForm />} />
      <Route path="offers/:id" element={<OfferForm />} />
      <Route path="payroll" element={<PayrollDashboard />} />
      <Route path="payroll/process" element={<SalaryProcessing />} />
      <Route path="payroll/salary-posting" element={<SalaryPostingPage />} />
      <Route path="leave" element={<LeaveManagementDashboard />} />
      <Route path="leave/request" element={<LeaveApplication />} />
      <Route path="leave/apply" element={<LeaveApplication />} />
      <Route path="leave/scheduling" element={<LeaveScheduling />} />
      <Route path="leave-scheduling" element={<LeaveScheduling />} />
      <Route path="leave/roster" element={<LeaveRoster />} />
      <Route path="leave-roster" element={<LeaveRoster />} />
      <Route path="leave/records" element={<LeaveRecords />} />
      <Route path="leave/calendar" element={<LeaveCalendar />} />
      <Route path="leave/balances" element={<LeaveBalances />} />
      <Route path="leave-balances" element={<LeaveBalances />} />

      {/* Organization & Structures routes */}
      <Route path="departments" element={<HRSetup />} />
      <Route path="designations" element={<HRSetup />} />
      <Route path="job-roles" element={<HRSetup />} />
      <Route path="branches" element={<HRSetup />} />
      <Route path="organogram" element={<OrganogramPage />} />

      <Route path="performance/kpis" element={<KPISetup />} />
      <Route path="performance/appraisal" element={<AppraisalForm />} />
      <Route path="performance/appraisal/:id" element={<AppraisalForm />} />
      <Route path="performance/submit" element={<SubmitAppraisals />} />
      <Route path="training" element={<TrainingPrograms />} />
      <Route path="training/history" element={<TrainingHistory />} />
      <Route path="policies" element={<PolicyList />} />
      <Route path="policies/new" element={<PolicyForm />} />
      <Route path="policies/view" element={<PolicyViewer />} />
      <Route path="policies/:id" element={<PolicyForm />} />
      <Route path="exit/request" element={<ExitRequest />} />
      <Route path="exit/clearance" element={<ClearanceTracking />} />
      <Route path="leave-setup" element={<LeaveSetupList />} />
      <Route path="leave/types" element={<LeaveSetupList />} />

      <Route path="leave-setup/new" element={<LeaveSetupForm />} />
      <Route path="leave-setup/:id" element={<LeaveSetupForm />} />
      <Route path="shifts" element={<ShiftList />} />
      <Route path="shifts/new" element={<ShiftForm />} />
      <Route path="shifts/:id" element={<ShiftForm />} />
      <Route path="work-schedules" element={<WorkScheduleManagement />} />
      <Route path="attendance-policies" element={<WorkScheduleManagement />} />
      <Route path="roster" element={<RosterManagement />} />
      <Route path="payroll/elements" element={<AllowanceList />} />
      {/* Time & Attendance extra routes */}
      <Route path="attendance" element={<AttendanceDashboard />} />
      <Route path="attendance/new" element={<AttendanceForm />} />
      <Route path="attendance/list" element={<AttendanceList />} />
      <Route path="attendance/bulk" element={<BulkAttendance />} />
      <Route path="bulk-attendance" element={<BulkAttendance />} />
      <Route path="attendance/timesheet" element={<TimesheetView />} />
      <Route path="timesheet" element={<TimesheetView />} />
      <Route path="timesheet-report" element={<TimesheetReport />} />
      <Route path="attendance/:id" element={<AttendanceForm />} />
      <Route path="salary-config" element={<SalaryConfigList />} />
      <Route
        path="salary-config/base-salaries"
        element={<BaseSalariesPage />}
      />
      <Route path="salary-config/structure" element={<SalaryStructurePage />} />
      <Route path="salary-config/new" element={<SalaryConfigForm />} />
      <Route path="salary-config/:id" element={<SalaryConfigForm />} />
      <Route path="tax-config" element={<TaxConfigList />} />
      <Route path="tax-config/new" element={<TaxConfigForm />} />
      <Route path="tax-config/:id" element={<TaxConfigForm />} />
      <Route path="allowances" element={<AllowanceList />} />
      <Route path="allowances/new" element={<AllowanceForm />} />
      <Route path="allowances/:id" element={<AllowanceForm />} />
      <Route path="loans" element={<LoanList />} />
      <Route path="loans/new" element={<LoanForm />} />
      <Route path="loans/:id" element={<LoanForm />} />
      <Route path="payslips" element={<PayslipList />} />
      <Route path="payslips/new" element={<PayslipForm />} />
      <Route path="payslips/:id" element={<PayslipForm />} />
      <Route path="promotions" element={<PromotionList />} />
      <Route path="promotions/new" element={<PromotionForm />} />
      <Route path="promotions/:id" element={<PromotionForm />} />
      <Route path="medical-policies" element={<MedicalPolicyList />} />
      <Route path="medical-policies/new" element={<MedicalPolicyForm />} />
      <Route path="medical-policies/:id" element={<MedicalPolicyForm />} />
      <Route path="reports" element={<HRReports />} />
      <Route path="*" element={<Navigate to="/human-resources" replace />} />
      </Routes>
    </ModuleLayout>
  );
}

export const humanResourcesFeatures = [
  {
    module_key: "human-resources",
    label: "Employee Setup",
    path: "/human-resources/employees",
        actions: [
          { label: "View", path: "/human-resources/employees", type: "outline" },
          { label: "New", path: "/human-resources/employees/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Promotions",
    path: "/human-resources/promotions",
        actions: [
          { label: "View", path: "/human-resources/promotions", type: "outline" },
          { label: "New", path: "/human-resources/promotions/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "KPI Setup",
    path: "/human-resources/performance/kpis",
        actions: [
          { label: "View", path: "/human-resources/performance/kpis", type: "outline" },
          { label: "New", path: "/human-resources/performance/kpis/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Appraisal Form",
    path: "/human-resources/performance/appraisal",
        actions: [
          { label: "View", path: "/human-resources/performance/appraisal", type: "outline" },
          { label: "New", path: "/human-resources/performance/appraisal/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Submit Appraisals",
    path: "/human-resources/performance/submit",
        actions: [
          { label: "View", path: "/human-resources/performance/submit", type: "outline" },
          { label: "New", path: "/human-resources/performance/submit/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Training Programs",
    path: "/human-resources/training",
        actions: [
          { label: "View", path: "/human-resources/training", type: "outline" },
          { label: "New", path: "/human-resources/training/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Training History",
    path: "/human-resources/training/history",
        actions: [
          { label: "View", path: "/human-resources/training/history", type: "outline" },
          { label: "New", path: "/human-resources/training/history/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Attendance",
    path: "/human-resources/attendance",
        actions: [
          { label: "View", path: "/human-resources/attendance", type: "outline" },
          { label: "New", path: "/human-resources/attendance/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Work Schedule Management",
    path: "/human-resources/work-schedules",
        actions: [
          { label: "View", path: "/human-resources/work-schedules", type: "outline" },
          { label: "New", path: "/human-resources/work-schedules/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Roster Management",
    path: "/human-resources/roster",
        actions: [
          { label: "View", path: "/human-resources/roster", type: "outline" },
          { label: "New", path: "/human-resources/roster/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Salary Configuration",
    path: "/human-resources/salary-config",
        actions: [
          { label: "View", path: "/human-resources/salary-config", type: "outline" },
          { label: "New", path: "/human-resources/salary-config/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Tax & Deductions",
    path: "/human-resources/tax-config",
        actions: [
          { label: "View", path: "/human-resources/tax-config", type: "outline" },
          { label: "New", path: "/human-resources/tax-config/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Employee Allowances",
    path: "/human-resources/allowances",
        actions: [
          { label: "View", path: "/human-resources/allowances", type: "outline" },
          { label: "New", path: "/human-resources/allowances/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Employee Loans",
    path: "/human-resources/loans",
        actions: [
          { label: "View", path: "/human-resources/loans", type: "outline" },
          { label: "New", path: "/human-resources/loans/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Payslips",
    path: "/human-resources/payslips",
        actions: [
          { label: "View", path: "/human-resources/payslips", type: "outline" },
          { label: "New", path: "/human-resources/payslips/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "Salary Posting",
    path: "/human-resources/payroll/salary-posting",
        actions: [
          { label: "View", path: "/human-resources/payroll/salary-posting", type: "outline" },
          { label: "New", path: "/human-resources/payroll/salary-posting/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "human-resources",
    label: "HR Reports",
    path: "/human-resources/reports",
        actions: [
          { label: "View", path: "/human-resources/reports", type: "outline" }
        ],
    type: "dashboard",
  },
];

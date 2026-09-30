import os, re

hr_dir = r'C:\Users\stanl\OneDrive\Documents\Stanness Technologies\kaf\client\src\pages\modules\human-resources'

file_sections = {
    # Time & Attendance
    'AttendanceDashboard.jsx': 'Time%20%26%20Attendance',
    'AttendanceList.jsx': 'Time%20%26%20Attendance',
    'AttendanceForm.jsx': 'Time%20%26%20Attendance',
    'BulkAttendance.jsx': 'Time%20%26%20Attendance',
    'TimesheetView.jsx': 'Time%20%26%20Attendance',
    'WorkScheduleManagement.jsx': 'Time%20%26%20Attendance',
    'WorkSchedule.jsx': 'Time%20%26%20Attendance',
    'RosterManagement.jsx': 'Time%20%26%20Attendance',

    # Leave Management
    'LeaveApplication.jsx': 'Leave%20Management',
    'LeaveApplicationForm.jsx': 'Leave%20Management',
    'LeaveApplicationsList.jsx': 'Leave%20Management',
    'LeaveBalances.jsx': 'Leave%20Management',
    'LeaveCalendar.jsx': 'Leave%20Management',
    'LeaveManagementDashboard.jsx': 'Leave%20Management',
    'LeaveRecords.jsx': 'Leave%20Management',
    'LeaveRequestForm.jsx': 'Leave%20Management',
    'LeaveRequestManager.jsx': 'Leave%20Management',
    'LeaveRoster.jsx': 'Leave%20Management',
    'LeaveScheduling.jsx': 'Leave%20Management',

    # Payroll & Benefits
    'PayrollDashboard.jsx': 'Payroll%20%26%20Benefits',
    'SalaryPostingPage.jsx': 'Payroll%20%26%20Benefits',
    'SalaryProcessing.jsx': 'Payroll%20%26%20Benefits',
    'SalaryConfigList.jsx': 'Payroll%20%26%20Benefits',
    'SalaryConfigForm.jsx': 'Payroll%20%26%20Benefits',
    'SalaryStructurePage.jsx': 'Payroll%20%26%20Benefits',
    'BaseSalariesPage.jsx': 'Payroll%20%26%20Benefits',
    'TaxConfigList.jsx': 'Payroll%20%26%20Benefits',
    'TaxConfigForm.jsx': 'Payroll%20%26%20Benefits',
    'AllowanceList.jsx': 'Payroll%20%26%20Benefits',
    'AllowanceForm.jsx': 'Payroll%20%26%20Benefits',
    'LoanList.jsx': 'Payroll%20%26%20Benefits',
    'LoanForm.jsx': 'Payroll%20%26%20Benefits',
    'PayslipList.jsx': 'Payroll%20%26%20Benefits',
    'PayslipForm.jsx': 'Payroll%20%26%20Benefits',

    # Settings & Setup / Policies
    'LeaveSetupList.jsx': 'Settings%20%26%20Setup',
    'LeaveSetupForm.jsx': 'Settings%20%26%20Setup',
    'ShiftList.jsx': 'Settings%20%26%20Setup',
    'ShiftForm.jsx': 'Settings%20%26%20Setup',
    'MedicalPolicyList.jsx': 'Settings%20%26%20Setup',
    'MedicalPolicyForm.jsx': 'Settings%20%26%20Setup',
    'PolicyList.jsx': 'Settings%20%26%20Setup',
    'PolicyViewer.jsx': 'Settings%20%26%20Setup',
    'PolicyForm.jsx': 'Settings%20%26%20Setup',

    # Training & Development
    'TrainingList.jsx': 'Training%20%26%20Development',
    'TrainingHistory.jsx': 'Training%20%26%20Development',
    'TrainingPrograms.jsx': 'Training%20%26%20Development',

    # Analytics & Performance
    'HRReports.jsx': 'Analytics%20%26%20Performance',
    'AppraisalForm.jsx': 'Analytics%20%26%20Performance',
    'SubmitAppraisals.jsx': 'Analytics%20%26%20Performance',
    'KPISetup.jsx': 'Analytics%20%26%20Performance',

    # Organization & Structures
    'HRSetup.jsx': 'Organization%20%26%20Structures',
}

fixed_count = 0

for root, dirs, files in os.walk(hr_dir):
    for file in files:
        if file in file_sections:
            filepath = os.path.join(root, file)
            sec_encoded = file_sections[file]
            target_url = f'/human-resources?section={sec_encoded}'
            
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace any /human-resources?section=... in Link or navigate with target_url
            new_content = re.sub(
                r'/human-resources\?section=[A-Za-z0-9%_\-]+',
                target_url,
                content
            )

            # Also replace simple /human-resources without section query in Back buttons
            # e.g. Link to="/human-resources"
            new_content = re.sub(
                r'(to|navigate)\s*=\s*(?:["\'])/human-resources(?:/)?(?:["\'])',
                lambda m: f'{m.group(1)}="{target_url}"',
                new_content
            )
            new_content = re.sub(
                r'navigate\(\s*["\']/human-resources(?:/)?["\']\s*\)',
                f'navigate("{target_url}")',
                new_content
            )

            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                fixed_count += 1
                print(f"Fixed {file} -> section={sec_encoded}")

print(f"Total files updated: {fixed_count}")

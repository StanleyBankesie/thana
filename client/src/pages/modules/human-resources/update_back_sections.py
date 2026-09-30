import os, re

hr_dir = r'C:\Users\stanl\OneDrive\Documents\Stanness Technologies\kaf\client\src\pages\modules\human-resources'

# Mapping of file basename (or relative path substring) to exact back section query
section_mapping = {
    # Organization & Structures
    'HRSetup.jsx': '/human-resources?section=Organization%20%26%20Structures',
    
    # Time & Attendance
    'AttendanceDashboard.jsx': '/human-resources?section=Time%20%26%20Attendance',
    'BulkAttendance.jsx': '/human-resources?section=Time%20%26%20Attendance',
    'TimesheetView.jsx': '/human-resources?section=Time%20%26%20Attendance',
    'AttendanceForm.jsx': '/human-resources?section=Time%20%26%20Attendance',
    'AttendanceList.jsx': '/human-resources?section=Time%20%26%20Attendance',
    'WorkScheduleManagement.jsx': '/human-resources?section=Time%20%26%20Attendance',
    'RosterManagement.jsx': '/human-resources?section=Time%20%26%20Attendance',
    'WorkSchedule.jsx': '/human-resources?section=Time%20%26%20Attendance',
    
    # Leave Management
    'LeaveApplication.jsx': '/human-resources?section=Leave%20Management',
    'LeaveApplicationForm.jsx': '/human-resources?section=Leave%20Management',
    'LeaveRequestForm.jsx': '/human-resources?section=Leave%20Management',
    'LeaveRecords.jsx': '/human-resources?section=Leave%20Management',
    'LeaveScheduling.jsx': '/human-resources?section=Leave%20Management',
    'LeaveRoster.jsx': '/human-resources?section=Leave%20Management',
    'LeaveBalances.jsx': '/human-resources?section=Leave%20Management',
    'LeaveCalendar.jsx': '/human-resources?section=Leave%20Management',
    'LeaveManagementDashboard.jsx': '/human-resources?section=Leave%20Management',

    # Employee Management
    'EmployeeList.jsx': '/human-resources?section=Employee%20Management',
    'EmployeeForm.jsx': '/human-resources?section=Employee%20Management',
    'PromotionList.jsx': '/human-resources?section=Employee%20Management',
    'PromotionForm.jsx': '/human-resources?section=Employee%20Management',

    # Payroll & Benefits
    'PayrollDashboard.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'SalaryProcessing.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'SalaryPostingPage.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'SalaryConfigList.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'SalaryStructurePage.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'BaseSalariesPage.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'TaxConfigList.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'AllowanceList.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'LoanList.jsx': '/human-resources?section=Payroll%20%26%20Benefits',
    'PayslipList.jsx': '/human-resources?section=Payroll%20%26%20Benefits',

    # Recruitment & Onboarding
    'RequisitionList.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',
    'RequisitionForm.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',
    'CandidatesList.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',
    'CandidateForm.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',
    'InterviewsList.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',
    'InterviewForm.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',
    'OffersList.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',
    'OfferForm.jsx': '/human-resources?section=Recruitment%20%26%20Onboarding',

    # Settings & Setup
    'LeaveSetupList.jsx': '/human-resources?section=Settings%20%26%20Setup',
    'ShiftList.jsx': '/human-resources?section=Settings%20%26%20Setup',
    'MedicalPolicyList.jsx': '/human-resources?section=Settings%20%26%20Setup',
}

modified_files = []

for root, dirs, files in os.walk(hr_dir):
    for file in files:
        if file in section_mapping:
            filepath = os.path.join(root, file)
            target_back = section_mapping[file]
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace '/human-resources' without query, or generic '/human-resources?...' in back link/Button/navigate
            # Look for Link to="/human-resources..." or navigate("/human-resources...")
            # Pattern: (to|navigate|path)\s*=\s*[\"`']/human-resources(?:(?!\?section=)[^\"'`])?[\"`']
            
            def replace_back_target(m):
                prefix = m.group(1)
                return f'{prefix}="{target_back}"'

            # Replace Link to="/human-resources"
            new_content = re.sub(
                r'(to|navigate)\s*=\s*(?:["\'])/human-resources(?:/)?(?:["\'])',
                lambda m: f'{m.group(1)}="{target_back}"',
                content
            )
            # Replace navigate("/human-resources")
            new_content = re.sub(
                r'navigate\(\s*["\']/human-resources(?:/)?["\']\s*\)',
                f'navigate("{target_back}")',
                new_content
            )
            # Replace back link in Header / Back Button if pointing to /human-resources
            new_content = re.sub(
                r'path:\s*["\']/human-resources(?:/)?["\']',
                f'path: "{target_back}"',
                new_content
            )

            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                modified_files.append(file)
                print(f"Updated back target in {file} -> {target_back}")

print(f"Total files updated: {len(modified_files)}")

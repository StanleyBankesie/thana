import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

def draw_rounded_box(ax, x, y, width, height, title, subtitle="", bg_color="#FFFFFF", border_color="#0284C7", text_color="#0F172A", title_size=9, sub_size=7.5, pad=0.15):
    """Draws a rounded card box with title and subtitle."""
    box = patches.FancyBboxPatch(
        (x, y), width, height,
        boxstyle=f"round,pad={pad},rounding_size=0.12",
        ec=border_color, fc=bg_color, lw=1.5, zorder=3
    )
    ax.add_patch(box)
    
    # Text
    cx = x + width / 2.0
    if subtitle:
        cy_title = y + height * 0.62
        cy_sub = y + height * 0.32
        ax.text(cx, cy_title, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=text_color, zorder=4)
        ax.text(cx, cy_sub, subtitle, ha='center', va='center', fontsize=sub_size, color="#475569", zorder=4)
    else:
        cy = y + height / 2.0
        ax.text(cx, cy, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=text_color, zorder=4)

def draw_arrow(ax, x1, y1, x2, y2, color="#0284C7", lw=1.8, style="-|>", rad=0.0):
    """Draws a directed connection arrow."""
    arrow = patches.FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle=style, mutation_scale=12,
        color=color, lw=lw, connectionstyle=f"arc3,rad={rad}", zorder=2
    )
    ax.add_patch(arrow)

def generate_fig1_triad(output_path):
    """Figure 1: The Master Architectural Triad."""
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Background canvas card
    bg = patches.Rectangle((1, 1), 98, 98, fc="#F8FAFC", ec="#CBD5E1", lw=1.2, zorder=0)
    ax.add_patch(bg)

    # Title Banner
    ax.text(50, 93, "THE ENTERPRISE ARCHITECTURAL TRIAD: LIFECYCLE SYNERGY", ha='center', va='center', fontsize=13, fontweight='bold', color="#0F172A")
    ax.text(50, 89, "How Project Management, Asset Management, and Facilities Management Flow Together", ha='center', va='center', fontsize=9, color="#64748B")

    # 1. Project Management Box (Left / Top)
    pm_bg = patches.FancyBboxPatch((4, 48), 28, 32, boxstyle="round,pad=0.5,rounding_size=0.2", ec="#2563EB", fc="#EFF6FF", lw=2, zorder=2)
    ax.add_patch(pm_bg)
    ax.text(18, 75, "1. PROJECT MANAGEMENT", ha='center', va='center', fontsize=10.5, fontweight='bold', color="#1E40AF")
    ax.text(18, 71, "(Capital Work-In-Progress)", ha='center', va='center', fontsize=8.5, fontstyle='italic', color="#3B82F6")
    
    pm_items = [
        "• Project Charter & Orders",
        "• Bill of Quantities (BOQ)",
        "• CPM Critical Path Schedule",
        "• Site Labor, Machinery & Materials",
        "• Client Valuations & IPAs"
    ]
    for i, item in enumerate(pm_items):
        ax.text(6, 65 - (i * 4), item, ha='left', va='center', fontsize=8, color="#1E293B")

    # 2. Asset Management Box (Center / Top)
    am_bg = patches.FancyBboxPatch((36, 48), 28, 32, boxstyle="round,pad=0.5,rounding_size=0.2", ec="#059669", fc="#ECFDF5", lw=2, zorder=2)
    ax.add_patch(am_bg)
    ax.text(50, 75, "2. ASSET MANAGEMENT", ha='center', va='center', fontsize=10.5, fontweight='bold', color="#065F46")
    ax.text(50, 71, "(Balance Sheet & Capitalization)", ha='center', va='center', fontsize=8.5, fontstyle='italic', color="#10B981")

    am_items = [
        "• Capitalization of CWIP",
        "• Master Barcode Tagging",
        "• Straight-Line / Red. Balance",
        "• Monthly Depreciation Run",
        "• Asset Schedule (IFRS/GAAP)"
    ]
    for i, item in enumerate(am_items):
        ax.text(38, 65 - (i * 4), item, ha='left', va='center', fontsize=8, color="#1E293B")

    # 3. Facilities Management Box (Right / Top)
    fm_bg = patches.FancyBboxPatch((68, 48), 28, 32, boxstyle="round,pad=0.5,rounding_size=0.2", ec="#D97706", fc="#FFFBEB", lw=2, zorder=2)
    ax.add_patch(fm_bg)
    ax.text(82, 75, "3. FACILITIES MANAGEMENT", ha='center', va='center', fontsize=10.5, fontweight='bold', color="#92400E")
    ax.text(82, 71, "(20 to 50+ Years Operations)", ha='center', va='center', fontsize=8.5, fontstyle='italic', color="#F59E0B")

    fm_items = [
        "• Property Onboarding & Handover",
        "• Client Contracts & SLA Policies",
        "• Helpdesk & Field Tasks",
        "• Soft Services & Plant Engineering",
        "• Tenant Billing & Utilities"
    ]
    for i, item in enumerate(fm_items):
        ax.text(70, 65 - (i * 4), item, ha='left', va='center', fontsize=8, color="#1E293B")

    # Connecting Arrows & Flows
    # Arrow 1: PM -> AM
    draw_arrow(ax, 32, 64, 36, 64, color="#2563EB", lw=2.5)
    ax.text(34, 67, "Handover", ha='center', va='bottom', fontsize=7.5, fontweight='bold', color="#1E40AF")

    # Arrow 2: AM -> FM
    draw_arrow(ax, 64, 64, 68, 64, color="#059669", lw=2.5)
    ax.text(66, 67, "In-Service", ha='center', va='bottom', fontsize=7.5, fontweight='bold', color="#065F46")

    # Arrow 3: FM -> AM (Feedback loop - Bottom curve)
    draw_arrow(ax, 78, 48, 54, 48, color="#D97706", lw=2, rad=0.35)
    ax.text(66, 38, "Asset Condition, Revaluations & Disposals", ha='center', va='center', fontsize=7.5, fontweight='bold', color="#B45309")

    # Arrow 4: FM -> PM (Major Capex upgrades loop)
    draw_arrow(ax, 72, 48, 20, 48, color="#64748B", lw=2, rad=0.45)
    ax.text(46, 26, "Major Refurbishment / Extension Projects (New Capex)", ha='center', va='center', fontsize=8, fontweight='bold', color="#475569")

    # Bottom Foundation Bar: Finance & General Ledger
    fin_bar = patches.FancyBboxPatch((10, 8), 80, 14, boxstyle="round,pad=0.3,rounding_size=0.15", ec="#475569", fc="#1E293B", lw=1.5, zorder=2)
    ax.add_patch(fin_bar)
    ax.text(50, 16.5, "CORE ERP FOUNDATION: GENERAL LEDGER, INVENTORY & ACCOUNTS RECEIVABLE", ha='center', va='center', fontsize=9.5, fontweight='bold', color="#FFFFFF")
    ax.text(50, 12, "Reconciles CWIP Assets • Posts Depreciation JVs • Manages Invoices & Payments", ha='center', va='center', fontsize=8, color="#94A3B8")

    # Vertical connectors down to finance
    draw_arrow(ax, 18, 48, 18, 22, color="#94A3B8", lw=1.5)
    draw_arrow(ax, 50, 48, 50, 22, color="#94A3B8", lw=1.5)
    draw_arrow(ax, 82, 48, 82, 22, color="#94A3B8", lw=1.5)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print("Fig 1 Triad created.")

def generate_fig2_fm_workflow(output_path):
    """Figure 2: Facilities Management End-to-End Workflow."""
    fig, ax = plt.subplots(figsize=(11, 7.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Card background
    ax.add_patch(patches.Rectangle((1, 1), 98, 98, fc="#F8FAFC", ec="#CBD5E1", lw=1.2))

    # Header
    ax.text(50, 95.5, "FACILITIES MANAGEMENT (FM): COMPLETE 9-STAGE PROCESS FLOW", ha='center', va='center', fontsize=12.5, fontweight='bold', color="#0F172A")
    ax.text(50, 92.5, "Sequential Process Route Across All 27 FM System Pages", ha='center', va='center', fontsize=8.5, color="#64748B")

    # STAGE 1: Foundation (Y: 82 to 90)
    ax.text(4, 87, "STAGE 1:\nFOUNDATION", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#1E3A8A")
    draw_rounded_box(ax, 16, 84, 18, 6, "1. Operations Setup", "/facilities/setup", "#EFF6FF", "#3B82F6")
    draw_arrow(ax, 34, 87, 37, 87)
    draw_rounded_box(ax, 37, 84, 18, 6, "2. Properties Register", "/facilities/properties", "#EFF6FF", "#3B82F6")
    draw_arrow(ax, 55, 87, 58, 87)
    draw_rounded_box(ax, 58, 84, 18, 6, "3. Property Onboard", "/facilities/onboarding", "#EFF6FF", "#3B82F6")
    draw_arrow(ax, 76, 87, 79, 87)
    draw_rounded_box(ax, 79, 84, 18, 6, "4. Space & Occupancy", "/facilities/space-occupancy", "#EFF6FF", "#3B82F6")

    # Down arrow to Stage 2
    draw_arrow(ax, 88, 84, 88, 77, rad=-0.2)

    # STAGE 2: Commercial Contracts & SLA (Y: 71 to 77)
    ax.text(4, 74, "STAGE 2:\nCONTRACTS", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#065F46")
    draw_rounded_box(ax, 50, 71, 22, 6, "5. FM Service Contracts", "/facilities/contracts", "#ECFDF5", "#10B981")
    draw_arrow(ax, 50, 74, 44, 74)
    draw_rounded_box(ax, 22, 71, 22, 6, "6. SLA Policies & Targets", "/facilities/sla-policies", "#ECFDF5", "#10B981")

    # Down arrow to Stage 3
    draw_arrow(ax, 33, 71, 33, 64)

    # STAGE 3: Helpdesk & Execution (Y: 58 to 64)
    ax.text(4, 61, "STAGE 3:\nOPERATIONS", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#D97706")
    draw_rounded_box(ax, 16, 58, 18, 6, "7. Helpdesk Tickets", "/facilities/helpdesk", "#FFFBEB", "#F59E0B")
    draw_arrow(ax, 34, 61, 38, 61)
    draw_rounded_box(ax, 38, 58, 18, 6, "8. Task Assignment", "/facilities/tasks", "#FFFBEB", "#F59E0B")
    draw_arrow(ax, 56, 61, 60, 61)
    draw_rounded_box(ax, 60, 58, 18, 6, "9. Task Execution", "/facilities/tasks/execution", "#FFFBEB", "#F59E0B")
    draw_arrow(ax, 78, 61, 81, 61)
    draw_rounded_box(ax, 81, 58, 17, 6, "10/11. Soft/Hard Svcs", "/soft & /hard-services", "#FFFBEB", "#F59E0B")

    # Down arrow to Stage 4 (Materials)
    draw_arrow(ax, 89, 58, 89, 51, rad=0.2)

    # STAGE 4: Supply Chain & Spare Parts (Y: 45 to 51)
    ax.text(4, 48, "STAGE 4:\nPARTS & STORES", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#4F46E5")
    draw_rounded_box(ax, 78, 45, 19, 6, "12. Material Requisition", "/material-requisitions", "#EEF2FF", "#6366F1")
    draw_arrow(ax, 78, 48, 73, 48)
    draw_rounded_box(ax, 54, 45, 19, 6, "13. Purchase Requisition", "/purchase-requisitions", "#EEF2FF", "#6366F1")
    draw_arrow(ax, 54, 48, 49, 48)
    draw_rounded_box(ax, 30, 45, 19, 6, "14. Material Receipts", "/material-receipts", "#EEF2FF", "#6366F1")
    draw_arrow(ax, 30, 48, 25, 48)
    draw_rounded_box(ax, 16, 45, 19, 6, "15. Material Utilization", "/material-utilizations", "#EEF2FF", "#6366F1")

    # Down arrow to Stage 5
    draw_arrow(ax, 25, 45, 25, 38)

    # STAGE 5: Security, HSE & Compliance (Y: 32 to 38)
    ax.text(4, 35, "STAGE 5:\nSAFETY & HSE", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#BE123C")
    draw_rounded_box(ax, 16, 32, 18, 6, "16/17. Security & Staff", "/security & /workforce", "#FFF1F2", "#F43F5E")
    draw_arrow(ax, 34, 35, 38, 35)
    draw_rounded_box(ax, 38, 32, 18, 6, "18. Checklist Templates", "/facilities/checklists", "#FFF1F2", "#F43F5E")
    draw_arrow(ax, 56, 35, 60, 35)
    draw_rounded_box(ax, 60, 32, 18, 6, "19/20. Inspections & HSE", "/inspections & /hsa", "#FFF1F2", "#F43F5E")
    draw_arrow(ax, 78, 35, 81, 35)
    draw_rounded_box(ax, 81, 32, 17, 6, "21. Compliance Reg", "/facilities/compliance", "#FFF1F2", "#F43F5E")

    # Down arrow to Stage 6
    draw_arrow(ax, 89, 32, 89, 25, rad=0.2)

    # STAGE 6: Utilities & Commercial Billing (Y: 19 to 25)
    ax.text(4, 22, "STAGE 6:\nUTILITIES & BILL", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#0D9488")
    draw_rounded_box(ax, 78, 19, 19, 6, "22/23. Utilities & ESG", "/utilities & /sustainability", "#F0FDFA", "#14B8A6")
    draw_arrow(ax, 78, 22, 73, 22)
    draw_rounded_box(ax, 54, 19, 19, 6, "24. Service Vendors", "/contractors-vendors", "#F0FDFA", "#14B8A6")
    draw_arrow(ax, 54, 22, 49, 22)
    draw_rounded_box(ax, 30, 19, 19, 6, "25. Service Billing", "/facilities/servicebilling", "#F0FDFA", "#14B8A6")
    draw_arrow(ax, 30, 22, 25, 22)
    draw_rounded_box(ax, 16, 19, 19, 6, "26. Budgeting & Finance", "/budgeting-finance", "#F0FDFA", "#14B8A6")

    # Down arrow to Stage 7
    draw_arrow(ax, 25, 19, 25, 12)

    # STAGE 7: Command Center & Reports (Y: 6 to 12)
    ax.text(4, 9, "STAGE 7:\nEXECUTIVE BI", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#0F172A")
    draw_rounded_box(ax, 16, 6, 82, 6, "27. Facilities Operations Command Dashboard & Reports Suite (/facilities/dashboard & /reports/*)", "Real-time SLA achievement • Overdue tickets • Maintenance $/m² • Compliance status", "#0F172A", "#334155", "#FFFFFF")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print("Fig 2 FM Workflow created.")

def generate_fig3_pm_workflow(output_path):
    """Figure 3: Project Management & Construction Workflow."""
    fig, ax = plt.subplots(figsize=(11, 7.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.add_patch(patches.Rectangle((1, 1), 98, 98, fc="#F8FAFC", ec="#CBD5E1", lw=1.2))

    ax.text(50, 95.5, "PROJECT MANAGEMENT & CONSTRUCTION (PM): COMPLETE PROCESS FLOW", ha='center', va='center', fontsize=12.5, fontweight='bold', color="#0F172A")
    ax.text(50, 92.5, "Sequential Execution Route Across All 29 PM System Pages", ha='center', va='center', fontsize=8.5, color="#64748B")

    # STAGE 1: Initiation & Tendering (Y: 83 to 89)
    ax.text(4, 86, "PHASE 1:\nINITIATION", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#1E3A8A")
    draw_rounded_box(ax, 16, 83, 18, 6, "1. Operations Setup", "/pm/setup", "#EFF6FF", "#3B82F6")
    draw_arrow(ax, 34, 86, 38, 86)
    draw_rounded_box(ax, 38, 83, 18, 6, "2. Project Quotation", "/pm/quotations", "#EFF6FF", "#3B82F6")
    draw_arrow(ax, 56, 86, 60, 86)
    draw_rounded_box(ax, 60, 83, 18, 6, "3. Project Order", "/pm/project-orders", "#EFF6FF", "#3B82F6")
    draw_arrow(ax, 78, 86, 81, 86)
    draw_rounded_box(ax, 81, 83, 17, 6, "4. Project Register", "/pm/projects", "#EFF6FF", "#3B82F6")

    draw_arrow(ax, 89, 83, 89, 76, rad=0.2)

    # STAGE 2: Engineering Baseline & CPM (Y: 70 to 76)
    ax.text(4, 73, "PHASE 2:\nPLANNING & CPM", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#065F46")
    draw_rounded_box(ax, 81, 70, 17, 6, "5. Bill of Quantities", "/pm/boqs", "#ECFDF5", "#10B981")
    draw_arrow(ax, 81, 73, 76, 73)
    draw_rounded_box(ax, 58, 70, 18, 6, "6. Schedule & CPM", "/pm/schedule", "#ECFDF5", "#10B981")
    draw_arrow(ax, 58, 73, 53, 73)
    draw_rounded_box(ax, 35, 70, 18, 6, "7. Key Milestones", "/pm/milestones", "#ECFDF5", "#10B981")
    draw_arrow(ax, 35, 73, 30, 73)
    draw_rounded_box(ax, 16, 70, 18, 6, "8. Resource Alloc.", "/pm/resources", "#ECFDF5", "#10B981")

    draw_arrow(ax, 25, 70, 25, 63)

    # STAGE 3: Task Execution & Timesheets (Y: 57 to 63)
    ax.text(4, 60, "PHASE 3:\nSITE EXECUTION", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#D97706")
    draw_rounded_box(ax, 16, 57, 24, 6, "9. Task Assignments", "/pm/tasks", "#FFFBEB", "#F59E0B")
    draw_arrow(ax, 40, 60, 45, 60)
    draw_rounded_box(ax, 45, 57, 24, 6, "10. Task Execution Dash", "/pm/tasks/execution", "#FFFBEB", "#F59E0B")
    draw_arrow(ax, 69, 60, 74, 60)
    draw_rounded_box(ax, 74, 57, 24, 6, "11. Labor Timesheets", "/pm/timesheets", "#FFFBEB", "#F59E0B")

    draw_arrow(ax, 86, 57, 86, 50, rad=0.2)

    # STAGE 4: Materials & Heavy Plant (Y: 44 to 50)
    ax.text(4, 47, "PHASE 4:\nSITE MATERIALS", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#4F46E5")
    draw_rounded_box(ax, 81, 44, 17, 6, "12. Purchase Req", "/pm/purchase-req", "#EEF2FF", "#6366F1")
    draw_arrow(ax, 81, 47, 77, 47)
    draw_rounded_box(ax, 61, 44, 16, 6, "13. Material Req", "/pm/material-req", "#EEF2FF", "#6366F1")
    draw_arrow(ax, 61, 47, 57, 47)
    draw_rounded_box(ax, 41, 44, 16, 6, "14. Material Rec.", "/pm/material-receipts", "#EEF2FF", "#6366F1")
    draw_arrow(ax, 41, 47, 37, 47)
    draw_rounded_box(ax, 21, 44, 16, 6, "15. Mat. Utilization", "/pm/material-util", "#EEF2FF", "#6366F1")
    draw_arrow(ax, 21, 47, 18, 47)
    draw_rounded_box(ax, 16, 44, 14, 6, "16. Plant Logs", "/equipment-logs", "#EEF2FF", "#6366F1")

    draw_arrow(ax, 23, 44, 23, 37)

    # STAGE 5: Site Governance & QA/QC (Y: 31 to 37)
    ax.text(4, 34, "PHASE 5:\nSITE GOVERN.", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#BE123C")
    draw_rounded_box(ax, 16, 31, 18, 6, "17. Daily Site Diary", "/pm/daily-reports", "#FFF1F2", "#F43F5E")
    draw_arrow(ax, 34, 34, 38, 34)
    draw_rounded_box(ax, 38, 31, 18, 6, "18. Subcontracts/IPC", "/pm/subcontracts", "#FFF1F2", "#F43F5E")
    draw_arrow(ax, 56, 34, 60, 34)
    draw_rounded_box(ax, 60, 31, 18, 6, "19/20. Variations/QC", "/variations & /qc", "#FFF1F2", "#F43F5E")
    draw_arrow(ax, 78, 34, 81, 34)
    draw_rounded_box(ax, 81, 31, 17, 6, "21/22. Safety & RFIs", "/safety & /documents", "#FFF1F2", "#F43F5E")

    draw_arrow(ax, 89, 31, 89, 24, rad=0.2)

    # STAGE 6: Valuations & Cost Control EVM (Y: 18 to 24)
    ax.text(4, 21, "PHASE 6:\nVALUATIONS", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#0D9488")
    draw_rounded_box(ax, 81, 18, 17, 6, "23. Client Valuation", "/client-valuations", "#F0FDFA", "#14B8A6")
    draw_arrow(ax, 81, 21, 77, 21)
    draw_rounded_box(ax, 61, 18, 16, 6, "24. Payment App", "/payment-applications", "#F0FDFA", "#14B8A6")
    draw_arrow(ax, 61, 21, 57, 21)
    draw_rounded_box(ax, 41, 18, 16, 6, "25. Project Invoice", "/project-invoices", "#F0FDFA", "#14B8A6")
    draw_arrow(ax, 41, 21, 37, 21)
    draw_rounded_box(ax, 21, 18, 16, 6, "26/27. Exp. & Income", "/expenses & /income", "#F0FDFA", "#14B8A6")
    draw_arrow(ax, 21, 21, 18, 21)
    draw_rounded_box(ax, 16, 18, 14, 6, "28. Cost Control", "/cost-control", "#F0FDFA", "#14B8A6")

    draw_arrow(ax, 23, 18, 23, 12)

    # STAGE 7: PM Reports Hub (Y: 6 to 12)
    ax.text(4, 9, "PHASE 7:\nPROJECT BI", ha='left', va='center', fontsize=7.5, fontweight='bold', color="#0F172A")
    draw_rounded_box(ax, 16, 6, 82, 6, "29. Project Status, Earned Value & Financial Reports (/pm/dashboard & /pm/reports/*)", "Earned Value CPI / SPI • Budget vs Actual variance • Task logs • Cashflow margins", "#0F172A", "#334155", "#FFFFFF")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print("Fig 3 PM Workflow created.")

def generate_fig4_am_workflow(output_path):
    """Figure 4: Fixed Asset Management Lifecycle."""
    fig, ax = plt.subplots(figsize=(10, 6.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.add_patch(patches.Rectangle((1, 1), 98, 98, fc="#F8FAFC", ec="#CBD5E1", lw=1.2))

    ax.text(50, 94.5, "FIXED ASSET MANAGEMENT (AM): STATUTORY FINANCIAL LIFECYCLE", ha='center', va='center', fontsize=12.5, fontweight='bold', color="#0F172A")
    ax.text(50, 91.5, "End-to-End Accounting Flow: Capitalization ➔ Depreciation ➔ Disposals", ha='center', va='center', fontsize=8.5, color="#64748B")

    # Step 1 & 2: Setup & Categories
    draw_rounded_box(ax, 8, 76, 38, 11, "Step 1: Master Setup & Tagging", "/assets/setup • Automated barcode tag rules & brand masters", "#EFF6FF", "#3B82F6")
    draw_arrow(ax, 46, 81.5, 54, 81.5)
    draw_rounded_box(ax, 54, 76, 38, 11, "Step 2: Categories & GL Mapping", "/assets/categories • Useful lives & Asset/Depreciation GLs", "#EFF6FF", "#3B82F6")

    draw_arrow(ax, 73, 76, 73, 67)

    # Step 3: Capitalization & Register
    draw_rounded_box(ax, 20, 56, 60, 11, "Step 3: Fixed Asset Register & Capitalization Form", "/assets/register & /assets/new • Capitalize from Purchases or Projects (CWIP)", "#ECFDF5", "#10B981", "#065F46", 10, 8)

    # Split branches: In-Service operations
    draw_arrow(ax, 30, 56, 20, 47, rad=-0.1) # to transfers
    draw_arrow(ax, 50, 56, 50, 47)          # to depreciation
    draw_arrow(ax, 70, 56, 80, 47, rad=0.1)  # to revaluation

    # Row 3: Periodic events (Transfers, Depreciation, Revaluations)
    draw_rounded_box(ax, 6, 36, 26, 11, "Step 6: Asset Transfers", "/assets/transfers\nCustody & site movements", "#FFFBEB", "#F59E0B")
    draw_rounded_box(ax, 37, 36, 26, 11, "Step 4: Depreciation Run", "/assets/depreciation\nMonthly/annual GL posting", "#FEF3C7", "#D97706", "#78350F", 9.5, 7.5)
    draw_rounded_box(ax, 68, 36, 26, 11, "Step 7: Revaluation / Impair.", "/assets/revaluations\nIAS 16 adjustments & surplus", "#FFFBEB", "#F59E0B")

    # Merge down to Disposal
    draw_arrow(ax, 50, 36, 50, 29)

    # Step 8: Disposal & Write-off
    draw_rounded_box(ax, 25, 20, 50, 9, "Step 8: Asset Disposals & Write-Offs (/assets/disposals)", "Scrap, Sale, or Casualty Loss • Derecognition of cost & accum dep • Gain/Loss", "#FFF1F2", "#F43F5E")

    draw_arrow(ax, 50, 20, 50, 14)

    # Step 5 & 9: Reports & Executive Dashboard
    draw_rounded_box(ax, 10, 5, 80, 9, "Step 5 & 9: Fixed Asset Schedule Report & Portfolio Dashboard (/assets/reports/schedule)", "Statutory IFRS/GAAP Roll-Forward Schedule • Gross Cost, Accum Dep, and Carrying Net Book Value (NBV)", "#0F172A", "#334155", "#FFFFFF")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print("Fig 4 AM Workflow created.")

def generate_fig5_swimlane(output_path):
    """Figure 5: Cross-Module Swimlane Architecture."""
    fig, ax = plt.subplots(figsize=(11, 7.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.add_patch(patches.Rectangle((1, 1), 98, 98, fc="#FFFFFF", ec="#94A3B8", lw=1.2))

    ax.text(50, 96, "INTEGRATED CROSS-MODULE SWIMLANE: FROM GROUNDBREAKING TO RETIREMENT", ha='center', va='center', fontsize=12, fontweight='bold', color="#0F172A")
    ax.text(50, 93, "Operational handshakes across Project Management, Finance, Asset Management & Facilities", ha='center', va='center', fontsize=8.5, color="#64748B")

    # 4 Swimlanes
    lanes = [
        ("PROJECT MANAGEMENT", 70, "#EFF6FF", "#1D4ED8"),
        ("FINANCE & GENERAL LEDGER", 48, "#F8FAFC", "#334155"),
        ("FIXED ASSET MANAGEMENT", 26, "#ECFDF5", "#047857"),
        ("FACILITIES MANAGEMENT", 4, "#FFFBEB", "#B45309")
    ]

    for label, y_bot, bg_c, txt_c in lanes:
        ax.add_patch(patches.Rectangle((2, y_bot), 96, 20, fc=bg_c, ec="#CBD5E1", lw=1, zorder=1))
        ax.text(3, y_bot + 10, label, ha='left', va='center', fontsize=7.5, fontweight='bold', color=txt_c, rotation=90, zorder=2)

    # Phase 1: Capital Work in Progress
    draw_rounded_box(ax, 8, 73, 16, 14, "1. Build Project", "BOQ & CPM Schedule\nSite Labor & Materials", "#DBEAFE", "#2563EB", title_size=8, sub_size=7)
    draw_arrow(ax, 16, 73, 16, 61, color="#2563EB")
    draw_rounded_box(ax, 8, 51, 16, 14, "2. Accumulate CWIP", "Debit: CWIP Asset\nCredit: Accounts Payable", "#E2E8F0", "#475569", title_size=8, sub_size=7)

    # Phase 2: Handover & Capitalization
    draw_arrow(ax, 24, 80, 32, 80)
    draw_rounded_box(ax, 32, 73, 16, 14, "3. Practical Finish", "QA/QC Clearances\nHandover Certificate", "#DBEAFE", "#2563EB", title_size=8, sub_size=7)
    draw_arrow(ax, 40, 73, 40, 39, rad=-0.2, color="#059669")
    draw_rounded_box(ax, 32, 29, 16, 14, "4. Capitalize Asset", "Fixed Asset Register\nBarcode Tag Affixed", "#D1FAE5", "#059669", title_size=8, sub_size=7)
    draw_arrow(ax, 40, 39, 40, 51, color="#059669")
    draw_rounded_box(ax, 32, 51, 16, 14, "5. Reclassify CWIP", "Debit: Fixed Asset Cost\nCredit: CWIP Asset", "#E2E8F0", "#475569", title_size=8, sub_size=7)

    # Phase 3: Facilities Onboarding & In-Service
    draw_arrow(ax, 48, 36, 56, 17, rad=0.2, color="#D97706")
    draw_rounded_box(ax, 56, 7, 18, 14, "6. Onboard Facility", "Property Register\nHelpdesk & Contracts", "#FEF3C7", "#D97706", title_size=8, sub_size=7)
    
    # Phase 4: Monthly Operations & Depreciation
    draw_rounded_box(ax, 56, 29, 18, 14, "7. Monthly Deprec.", "Straight-Line Run\nNet Book Value Calc", "#D1FAE5", "#059669", title_size=8, sub_size=7)
    draw_arrow(ax, 65, 39, 65, 51, color="#059669")
    draw_rounded_box(ax, 56, 51, 18, 14, "8. Post P&L Deprec.", "Debit: Dep Expense\nCredit: Accum Dep", "#E2E8F0", "#475569", title_size=8, sub_size=7)

    # Phase 5: Decommission & Disposal
    draw_arrow(ax, 74, 14, 80, 36, rad=0.2, color="#DC2626")
    draw_rounded_box(ax, 78, 29, 18, 14, "9. Asset Disposal", "Retire Asset Tag\nDerecognize Asset", "#FEE2E2", "#DC2626", title_size=8, sub_size=7)
    draw_arrow(ax, 87, 39, 87, 51, color="#DC2626")
    draw_rounded_box(ax, 78, 51, 18, 14, "10. Gain/Loss on Sale", "Clear Cost & Accum Dep\nPost Gain/Loss to P&L", "#E2E8F0", "#475569", title_size=8, sub_size=7)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print("Fig 5 Swimlane created.")

def generate_fig6_financial_flow(output_path):
    """Figure 6: Financial Double-Entry Accounting Flow."""
    fig, ax = plt.subplots(figsize=(11, 7.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.add_patch(patches.Rectangle((1, 1), 98, 98, fc="#F8FAFC", ec="#CBD5E1", lw=1.2))

    ax.text(50, 95.5, "FINANCIAL DOUBLE-ENTRY GENERAL LEDGER (GL) ACCOUNTING FLOW", ha='center', va='center', fontsize=12.5, fontweight='bold', color="#0F172A")
    ax.text(50, 92.5, "How Project Expenses, Capitalization, Depreciation & Facilities Billing Post to Balance Sheet & P&L", ha='center', va='center', fontsize=8.5, color="#64748B")

    # Column 1: Project Construction (Debit CWIP)
    ax.text(18, 86, "PHASE 1: PROJECT COSTS", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#1E40AF")
    draw_rounded_box(ax, 5, 68, 26, 15, "1. Site Expenditures", "Dr: Capital WIP Asset\nCr: Accounts Payable / Cash\n(Materials, Labor, Plant)", "#EFF6FF", "#3B82F6", title_size=8.5, sub_size=7.5)
    draw_rounded_box(ax, 5, 48, 26, 15, "2. Subcontractor IPCs", "Dr: Capital WIP Asset\nCr: Subcontractor Payable\nCr: Retention Payable (5-10%)", "#EFF6FF", "#3B82F6", title_size=8.5, sub_size=7.5)
    draw_rounded_box(ax, 5, 28, 26, 15, "3. Client Invoicing", "Dr: Accounts Receivable\nCr: Project Revenue (P&L)\n(Billed on Certified IPAs)", "#EFF6FF", "#3B82F6", title_size=8.5, sub_size=7.5)

    # Center Transition: Project Handover & Capitalization
    draw_arrow(ax, 31, 75, 38, 75, color="#2563EB", lw=2)
    ax.text(34.5, 78, "Handover", ha='center', va='center', fontsize=7.5, fontweight='bold', color="#2563EB")

    # Column 2: Capitalization & Asset Register
    ax.text(50, 86, "PHASE 2: CAPITALIZATION", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#065F46")
    draw_rounded_box(ax, 38, 68, 24, 15, "4. CWIP Reclassification", "Dr: Fixed Asset (Cost)\nCr: Capital WIP Asset\n(Asset moves to Balance Sheet)", "#ECFDF5", "#10B981", title_size=8.5, sub_size=7.5)
    
    draw_arrow(ax, 50, 68, 50, 61, color="#059669", lw=2)
    draw_rounded_box(ax, 38, 46, 24, 15, "5. Periodic Depreciation", "Dr: Depreciation Expense (P&L)\nCr: Accumulated Deprec. (BS)\nNet Book Value = Cost - Accum Dep", "#ECFDF5", "#10B981", title_size=8.5, sub_size=7.5)

    draw_arrow(ax, 50, 46, 50, 39, color="#059669", lw=2)
    draw_rounded_box(ax, 38, 24, 24, 15, "6. Retirement / Disposal", "Dr: Bank / Proceeds\nDr: Accumulated Deprec.\nCr: Fixed Asset (Cost)\nDr/Cr: Gain/Loss on Sale (P&L)", "#ECFDF5", "#10B981", title_size=8.5, sub_size=7.5)

    # Column 3: Facilities Maintenance & Tenant Billing
    draw_arrow(ax, 62, 53, 69, 53, color="#D97706", lw=2)
    ax.text(65.5, 56, "Operate", ha='center', va='center', fontsize=7.5, fontweight='bold', color="#D97706")

    ax.text(82, 86, "PHASE 3: FM OPERATIONS", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#92400E")
    draw_rounded_box(ax, 69, 68, 26, 15, "7. Maintenance Spares", "Dr: Repairs & Maint. Exp (P&L)\nCr: Facility Spares Inventory\n(Parts consumed on Work Orders)", "#FFFBEB", "#F59E0B", title_size=8.5, sub_size=7.5)
    draw_rounded_box(ax, 69, 48, 26, 15, "8. Tenant Service Billing", "Dr: Accounts Receivable\nCr: Service Contract Retainer\nCr: Reimbursable Utilities", "#FFFBEB", "#F59E0B", title_size=8.5, sub_size=7.5)
    draw_rounded_box(ax, 69, 28, 26, 15, "9. Direct Operating Bills", "Dr: Utilities / Security Expense\nCr: Accounts Payable / Bank\n(City power, diesel fuel, guards)", "#FFFBEB", "#F59E0B", title_size=8.5, sub_size=7.5)

    # Bottom Summary Bar
    sum_bar = patches.FancyBboxPatch((5, 7), 90, 14, boxstyle="round,pad=0.3,rounding_size=0.15", ec="#475569", fc="#0F172A", lw=1.5)
    ax.add_patch(sum_bar)
    ax.text(50, 15.5, "STATUTORY BALANCE SHEET & P&L RECONCILIATION SUMMARY", ha='center', va='center', fontsize=9.5, fontweight='bold', color="#FFFFFF")
    ax.text(50, 11, "Balance Sheet Assets: Cash, Accounts Receivable, Inventory, CWIP, Fixed Assets Less Accum Dep\nIncome Statement (P&L): Project Revenue, Maintenance Revenue, Less Labor, Materials, Depreciation & Opex", ha='center', va='center', fontsize=7.5, color="#94A3B8")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print("Fig 6 Financial Flow created.")

def generate_fig7_raci_structure(output_path):
    """Figure 7: Enterprise RACI Responsibility Structure."""
    fig, ax = plt.subplots(figsize=(11, 7.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.add_patch(patches.Rectangle((1, 1), 98, 98, fc="#F8FAFC", ec="#CBD5E1", lw=1.2))

    ax.text(50, 95.5, "ENTERPRISE RACI RESPONSIBILITY HIERARCHY & GOVERNANCE MODEL", ha='center', va='center', fontsize=12.5, fontweight='bold', color="#0F172A")
    ax.text(50, 92.5, "Operational Governance across Project Management, Asset Management & Facilities Management", ha='center', va='center', fontsize=8.5, color="#64748B")

    tiers = [
        ("TIER 1: EXECUTIVE GOVERNANCE [A - Accountable]", 70, "#EFF6FF", "#1E40AF", "Project Director, Chief Financial Officer (CFO), VP Operations\nOwns final business outcomes, approves major variations (>10%), signs statutory IFRS asset schedules, authorizes capital budgets"),
        ("TIER 2: OPERATIONAL MANAGEMENT [R - Responsible]", 48, "#ECFDF5", "#065F46", "Senior Project Manager, Lead Quantity Surveyor, Facilities Operations Lead, Asset Accountant\nExecutes day-to-day management: schedules tasks, certifies subcontractor IPCs, runs monthly depreciation, dispatches work orders"),
        ("TIER 3: TECHNICAL & REGULATORY ASSURANCE [C - Consulted]", 26, "#FFFBEB", "#92400E", "QA/QC Manager, Site HSE Officer, Chartered Valuation Surveyor, Legal & Statutory Compliance Lead\nConsulted for technical expertise: permits-to-work, concrete lab crush tests, building regulations, lease contract reviews"),
        ("TIER 4: FRONTLINE OPERATIONAL TEAMS [I - Informed / Executing]", 4, "#F8FAFC", "#334155", "Field Technicians, Trade Foremen, Site Clerks, Security Guards, Helpdesk Dispatchers, Tenants\nCarries out physical site operations: executes checklist items, logs hours in timesheets, receives site materials, logs complaints")
    ]

    for title, y_pos, bg, border, desc in tiers:
        box = patches.FancyBboxPatch((4, y_pos), 92, 18, boxstyle="round,pad=0.4,rounding_size=0.15", ec=border, fc=bg, lw=1.8)
        ax.add_patch(box)
        ax.text(6, y_pos + 13.5, title, ha='left', va='center', fontsize=9.5, fontweight='bold', color=border)
        ax.text(6, y_pos + 6.5, desc, ha='left', va='center', fontsize=8, color="#334155")

    # Vertical hierarchy arrows
    draw_arrow(ax, 50, 70, 50, 66, color="#475569", lw=2)
    draw_arrow(ax, 50, 48, 50, 44, color="#475569", lw=2)
    draw_arrow(ax, 50, 26, 50, 22, color="#475569", lw=2)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print("Fig 7 RACI Hierarchy created.")

def generate_all():
    assets_dir = os.path.join(os.getcwd(), "client", "public", "downloads", "diagrams")
    os.makedirs(assets_dir, exist_ok=True)
    
    f1 = os.path.join(assets_dir, "fig1_master_triad.png")
    f2 = os.path.join(assets_dir, "fig2_fm_workflow.png")
    f3 = os.path.join(assets_dir, "fig3_pm_workflow.png")
    f4 = os.path.join(assets_dir, "fig4_am_workflow.png")
    f5 = os.path.join(assets_dir, "fig5_cross_module_swimlane.png")
    f6 = os.path.join(assets_dir, "fig6_financial_flow.png")
    f7 = os.path.join(assets_dir, "fig7_raci_hierarchy.png")

    generate_fig1_triad(f1)
    generate_fig2_fm_workflow(f2)
    generate_fig3_pm_workflow(f3)
    generate_fig4_am_workflow(f4)
    generate_fig5_swimlane(f5)
    generate_fig6_financial_flow(f6)
    generate_fig7_raci_structure(f7)

    print("All 7 process diagrams generated successfully!")

if __name__ == "__main__":
    generate_all()

import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    """Sets background shading of a table cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tc_pr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Sets padding for a table cell in twentieths of a point (dxa)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tc_pr.append(tc_mar)

def set_table_borders(table, color="D1D5DB", sz="4", val="single"):
    """Sets subtle clean borders on a table."""
    tbl_pr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="none"/>
            <w:right w:val="none"/>
            <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''')
    tbl_pr.append(borders)

def build_process_guide():
    doc = Document()

    # Configure Margins (0.8 inches all around for rich content)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # ─────────────────────────────────────────────────────────────────────────────
    # TITLE & COVER BLOCK
    # ─────────────────────────────────────────────────────────────────────────────
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(12)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("OmniSuite Enterprise ERP")
    run_title.font.name = "Arial"
    run_title.font.size = Pt(28)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42) # Slate 900

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(12)
    run_sub = sub_p.add_run("End-to-End Business Process Handbook & Visual Workflow Manual\nFacilities Management • Project Management & Construction • Fixed Asset Management")
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(13)
    run_sub.font.bold = True
    run_sub.font.color.rgb = RGBColor(2, 132, 199) # Sky 600

    # Meta banner
    meta_table = doc.add_table(rows=1, cols=3)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    col_widths = [Inches(2.3), Inches(2.3), Inches(2.3)]
    for row in meta_table.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = width

    meta_cells = meta_table.rows[0].cells
    set_cell_background(meta_cells[0], "0F172A")
    set_cell_background(meta_cells[1], "0F172A")
    set_cell_background(meta_cells[2], "0F172A")
    for c in meta_cells:
        set_cell_margins(c, 120, 120, 150, 150)

    p0 = meta_cells[0].paragraphs[0]
    r0 = p0.add_run("TARGET AUDIENCE\nBeginners, PMs, FM Leads, Accountants")
    r0.font.size = Pt(8.5)
    r0.font.color.rgb = RGBColor(226, 232, 240)
    r0.font.name = "Arial"

    p1 = meta_cells[1].paragraphs[0]
    r1 = p1.add_run("SCOPE & COVERAGE\n100% Complete — 65 Total System Pages")
    r1.font.size = Pt(8.5)
    r1.font.color.rgb = RGBColor(56, 189, 248)
    r1.font.name = "Arial"

    p2 = meta_cells[2].paragraphs[0]
    r2 = p2.add_run("VISUAL INTEGRATION\n5 High-Resolution Workflow Flowcharts")
    r2.font.size = Pt(8.5)
    r2.font.color.rgb = RGBColor(226, 232, 240)
    r2.font.name = "Arial"

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # Helper functions for structured styling
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(20)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Arial"
        run.font.size = Pt(17)
        run.font.bold = True
        run.font.color.rgb = RGBColor(15, 23, 42)
        return p

    def add_h2(text, color=RGBColor(2, 132, 199)):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Arial"
        run.font.size = Pt(12.5)
        run.font.bold = True
        run.font.color.rgb = color
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Arial"
        run.font.size = Pt(10.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(51, 65, 85)
        return p

    def add_body(text, bold_prefix=None):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.name = "Arial"
            r_pre.font.size = Pt(9.5)
            r_pre.font.bold = True
            r_pre.font.color.rgb = RGBColor(30, 41, 59)
        run = p.add_run(text)
        run.font.name = "Arial"
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(71, 85, 105)
        return p

    def add_callout(title, text, bg="F8FAFC", border_color="0284C7"):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        tbl.rows[0].cells[0].width = Inches(6.9)
        c = tbl.rows[0].cells[0]
        set_cell_background(c, bg)
        set_cell_margins(c, 120, 120, 160, 160)
        
        tc_pr = c._tc.get_or_add_tcPr()
        borders = parse_xml(f'''
            <w:tcBorders {nsdecls("w")}>
                <w:top w:val="none"/>
                <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>
                <w:bottom w:val="none"/>
                <w:right w:val="none"/>
            </w:tcBorders>
        ''')
        tc_pr.append(borders)
        
        p = c.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        r_t = p.add_run(f"📌 {title}\n")
        r_t.font.name = "Arial"
        r_t.font.size = Pt(10)
        r_t.font.bold = True
        r_t.font.color.rgb = RGBColor(15, 23, 42)
        
        r_txt = p.add_run(text)
        r_txt.font.name = "Arial"
        r_txt.font.size = Pt(9)
        r_txt.font.color.rgb = RGBColor(51, 65, 85)
        doc.add_paragraph().paragraph_format.space_after = Pt(4)

    def add_visual_diagram(img_path, caption_title, caption_desc):
        if not os.path.exists(img_path):
            print(f"Warning: image {img_path} not found.")
            return
        
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(2)
        run_img = p_img.add_run()
        run_img.add_picture(img_path, width=Inches(6.85))

        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(10)
        
        r_ct = p_cap.add_run(f"Figure: {caption_title} — ")
        r_ct.font.name = "Arial"
        r_ct.font.size = Pt(8.5)
        r_ct.font.bold = True
        r_ct.font.color.rgb = RGBColor(15, 23, 42)

        r_cd = p_cap.add_run(caption_desc)
        r_cd.font.name = "Arial"
        r_cd.font.size = Pt(8.5)
        r_cd.font.italic = True
        r_cd.font.color.rgb = RGBColor(100, 116, 139)

    def add_page_step(step_num, title, route, file_name, role, what_it_does, why_here, next_page, inputs_outputs):
        add_h3(f"Step {step_num}: {title}")
        
        tbl = doc.add_table(rows=5, cols=2)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        widths = [Inches(1.8), Inches(5.1)]
        for r in tbl.rows:
            r.cells[0].width = widths[0]
            r.cells[1].width = widths[1]
            set_cell_margins(r.cells[0], 60, 60, 100, 100)
            set_cell_margins(r.cells[1], 60, 60, 100, 100)

        set_table_borders(tbl, "E2E8F0", "4")

        row_data = [
            ("Page URL & Code File", f"{route} | {file_name}"),
            ("Primary User / Role", role),
            ("Operational Purpose", what_it_does),
            ("Process Sequence Logic", f"Why this step is here: {why_here}"),
            ("Inputs & Resulting Output", f"{inputs_outputs} ➔ Next Destination: {next_page}")
        ]

        for i, (k, v) in enumerate(row_data):
            c0, c1 = tbl.rows[i].cells
            set_cell_background(c0, "F1F5F9")
            set_cell_background(c1, "FFFFFF" if i % 2 == 0 else "F8FAFC")
            
            p0 = c0.paragraphs[0]
            p0.paragraph_format.space_before = Pt(0)
            p0.paragraph_format.space_after = Pt(0)
            r0 = p0.add_run(k)
            r0.font.name = "Arial"
            r0.font.size = Pt(8.5)
            r0.font.bold = True
            r0.font.color.rgb = RGBColor(30, 41, 59)

            p1 = c1.paragraphs[0]
            p1.paragraph_format.space_before = Pt(0)
            p1.paragraph_format.space_after = Pt(0)
            p1.paragraph_format.line_spacing = 1.15
            r1 = p1.add_run(v)
            r1.font.name = "Arial"
            r1.font.size = Pt(8.5)
            r1.font.color.rgb = RGBColor(51, 65, 85)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    diagrams_dir = os.path.join(os.getcwd(), "client", "public", "downloads", "diagrams")
    fig1 = os.path.join(diagrams_dir, "fig1_master_triad.png")
    fig2 = os.path.join(diagrams_dir, "fig2_fm_workflow.png")
    fig3 = os.path.join(diagrams_dir, "fig3_pm_workflow.png")
    fig4 = os.path.join(diagrams_dir, "fig4_am_workflow.png")
    fig5 = os.path.join(diagrams_dir, "fig5_cross_module_swimlane.png")
    fig6 = os.path.join(diagrams_dir, "fig6_financial_flow.png")
    fig7 = os.path.join(diagrams_dir, "fig7_raci_hierarchy.png")

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 1: EXECUTIVE ARCHITECTURAL FOUNDATION
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 1: The Master ERP Architecture — How the Three Modules Connect")
    add_body(
        "A common mistake made by beginners in enterprise systems is viewing Facilities Management, Project Management, and "
        "Asset Management as isolated, standalone software screens. In a world-class ERP, these three modules form a continuous, "
        "interlocked lifecycle governing an organization's physical and financial existence."
    )

    add_visual_diagram(fig1, "The Enterprise Architectural Triad", "Interlocking lifecycle model connecting Capital Projects (CWIP), Fixed Assets, and Operational Facilities.")

    add_callout(
        "Beginner's Mental Model: The Infrastructure Life Cycle",
        "1. Project Management (PM) BUILDS IT: Temporary, budget-driven, timeline-focused. Costs accumulate in Capital Work-in-Progress (CWIP).\n"
        "2. Asset Management (AM) CAPITALIZES IT: Holds the legal, financial, and tax value on the Balance Sheet. Calculates monthly depreciation and tracking book value.\n"
        "3. Facilities Management (FM) OPERATES & MAINTAINS IT: Long-term operational custody (20 to 50+ years). Manages repairs, cleaning, security, tenant billing, and health compliance."
    )

    add_body(
        "When a physical asset—such as a 10-story commercial tower or a 500 kVA standby generator—is conceived, it begins in Project Management. "
        "Thousands of labor hours, bulk materials (cement, rebar, cabling), and plant machine logs are tracked against a Bill of Quantities (BOQ). "
        "Upon project handover, this accumulated expenditure is capitalized into the Fixed Asset Register. The asset is assigned a barcode tag, an accounting useful life, "
        "and a depreciation formula. Immediately thereafter, the physical asset is registered in Facilities Management, where daily service tickets, preventive "
        "checklists, maintenance tasks, and energy bills ensure it remains operational for decades."
    )

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 2: FACILITIES MANAGEMENT (FM)
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 2: Facilities Management (FM) Business Process")
    add_body(
        "The Facilities Management module controls the ongoing operations, maintenance, statutory safety, and commercial tenant billing for all real estate "
        "properties, technical building engineering equipment, and campus environments. Below is the visual flowchart followed by the exact, unskipped operational sequence of all 27 pages."
    )

    add_visual_diagram(fig2, "Facilities Management (FM) End-to-End Workflow", "Sequential operational flow across all 9 operational stages and 27 system pages.")

    add_h2("Stage 1: Master Setup & Property Structure (The Physical Foundation)")
    add_page_step(
        1, "Operations Setup", "/facilities/setup", "FacilitiesSetupPage.jsx",
        "Facilities Administrator / Operations Director",
        "Configures master lookups required before daily operations begin: shift schedules (Day, Night, Swing), service categories (Janitorial, Electrical, HVAC, Plumbing), supervisor approval hierarchies, and priority matrices.",
        "System lookups must exist first. Without shifts and categories configured, no technician can be scheduled and no work order can be categorized.",
        "Step 2: Properties & Estates Register",
        "Input: Shift hours, service categories, priority rules ➔ Output: Active operations configuration."
    )
    add_page_step(
        2, "Properties & Estates Register", "/facilities/properties", "PropertiesList.jsx",
        "Portfolio Manager / Property Director",
        "Establishes physical multi-tier campus hierarchies: Estate ➔ Building ➔ Floor ➔ Wing ➔ Zone. Captures gross internal area (m²), physical GPS coordinates, handover dates, and master warranty certificates.",
        "Every work order, contract, utility meter, and incident must be physically tied to a verified building location.",
        "Step 3: Property Onboarding",
        "Input: Building architectural data, GPS, square meters ➔ Output: Verified active Property ID."
    )
    add_page_step(
        3, "Property Onboarding", "/facilities/onboarding", "PropertyOnboardingPage.jsx",
        "Facility Onboarding Lead / Handover Engineer",
        "A formal multi-step intake checklist executed when taking over a new building from a construction team or third-party landlord. Verifies as-built drawings, operating licenses, master keys/fobs, snagging clearance, and equipment warranties.",
        "Prevents the enterprise from accepting liability for a defective building without signed snags and legal operating permits.",
        "Step 4: Space & Occupancy Management",
        "Input: As-built drawings, defect punch lists, keys ➔ Output: Formal Property Handover Acceptance Certificate."
    )
    add_page_step(
        4, "Space & Occupancy Management", "/facilities/space-occupancy", "SpaceOccupancyPage.jsx",
        "Space Planner / Leasing Coordinator",
        "Subdivides floors into allocatable and rentable spaces: Private Offices, Meeting Rooms, Retail Bays, and Common Areas. Tracks tenant lease contracts, headcount per m², desk utilization, and vacancy percentages.",
        "Provides the exact square-meter basis used later by Service Billing to calculate tenant service charge allocations.",
        "Step 5: FM Service Contracts",
        "Input: Floor plans, tenant names, desk counts ➔ Output: Rentable space register and occupancy metrics."
    )

    add_h2("Stage 2: Commercial Agreements & Service Quality Commitments")
    add_page_step(
        5, "FM Service Contracts", "/facilities/contracts", "FMContractsList.jsx",
        "Commercial Manager / Client Account Executive",
        "Establishes legally binding maintenance contracts with clients or tenants. Specifies contract duration, billing periodicity (Monthly, Quarterly, Annual), covered services, renewal terms, and indexation clauses.",
        "Facilities management is a commercial business. Every work request dispatched must be checked against an active contract to decide if work is covered under warranty/retainer or billable out-of-scope.",
        "Step 6: SLA Policies & Performance",
        "Input: Client legal entity, billing retainer rate, covered scope ➔ Output: Active commercial contract."
    )
    add_page_step(
        6, "SLA Policies & Performance", "/facilities/sla-policies", "SLAPoliciesPage.jsx",
        "Quality & Compliance Manager / SLA Officer",
        "Defines Service Level Agreements tied to contracts. Establishes Target Response Time (Emergency = 15 mins, Routine = 4 hrs) and Target Resolution Time (Emergency = 2 hrs, Routine = 48 hrs), plus breach penalty calculations.",
        "When a service ticket is submitted on the Helpdesk, the SLA countdown clock immediately begins ticking based on these policies.",
        "Step 7: Helpdesk & Service Requests",
        "Input: Priority levels, target response/resolution hours ➔ Output: Automated SLA monitoring rules."
    )

    add_h2("Stage 3: Service Delivery, Helpdesk & Field Task Execution")
    add_page_step(
        7, "Helpdesk & Service Requests", "/facilities/helpdesk", "FMHelpdeskPage.jsx",
        "Helpdesk Dispatcher / Call Center Agent / Tenants",
        "Central ticketing clearinghouse. Requesters submit complaints and service calls (e.g., 'Chiller leaking on 4th Floor East'). System matches priority, validates contract coverage, and starts the SLA countdown clock.",
        "Acts as the single front door for all facilities issues. Incoming tickets are triaged and converted into actionable field work orders.",
        "Step 8: FM Task Assignment",
        "Input: Tenant problem report, photos, location ➔ Output: Validated Helpdesk Ticket ID."
    )
    add_page_step(
        8, "FM Task Assignment", "/facilities/tasks", "FMTaskList.jsx & FMTaskForm.jsx",
        "Facilities Supervisor / Maintenance Planner",
        "Converts approved helpdesk tickets and scheduled PPMs into detailed work orders. Allocates the responsible technician, planned start/finish times, required spare parts, and safety precautions.",
        "Connects a customer's reported complaint to specific physical personnel and material resources.",
        "Step 9: FM Task Execution & Work Log",
        "Input: Ticket ID, assigned technician, parts list ➔ Output: Dispatched Work Order."
    )
    add_page_step(
        9, "FM Task Execution & Field Work Log", "/facilities/tasks/execution", "FMTaskExecution.jsx & FieldTechnicianJobCard.jsx",
        "Field Technician / Maintenance Engineer",
        "Technicians log into their mobile job card, record clock-in time, step through technical checklists, document spare parts used, upload before/after photos, and obtain client sign-off signatures upon completion.",
        "Provides ground-level verification that work was completed to standard before tickets can be closed.",
        "Step 10 / Step 12 (Materials)",
        "Input: Work order ID, physical labor, parts consumed ➔ Output: Completed Job Card & Closed Work Order."
    )
    add_page_step(
        10, "Soft Services & Site Operations", "/facilities/soft-services", "SoftServicesPage.jsx",
        "Soft Services Supervisor / Janitorial & Hygiene Lead",
        "Coordinates non-technical, human-centric operations: daily restroom sanitation checklists, deep floor scrubbing, groundskeeping, pest control fumigation cycles, and solid waste removal manifests.",
        "Soft services operate continuously on repetitive shift schedules, separate from technical break-fix repairs.",
        "Step 11: Hard Services",
        "Input: Daily shift checklists, consumable chemical logs ➔ Output: Soft services sanitation compliance log."
    )
    add_page_step(
        11, "Hard Services & Technical Engineering", "/facilities/hard-services", "HardServicesPage.jsx",
        "Chief Facilities Engineer / Plant Room Lead",
        "Dedicated tracking of heavy mechanical and electrical infrastructure: Central Chiller plants, Standby Diesel Generators, Elevator safety interlocks, High-Voltage Transformers, and Fire Pumps. Tracks operating hours, diesel levels, and oil pressure.",
        "Critical plant assets require specialized thermodynamic and electrical telemetry tracking beyond standard work orders.",
        "Step 12: Material Requisitions",
        "Input: Machine running hours, fuel levels, vibration logs ➔ Output: Plant health telemetry and PPM schedules."
    )

    add_h2("Stage 4: FM Materials, Supply Chain & Site Inventory")
    add_callout(
        "The 4-Step Site Material Lifecycle",
        "Requisition Stock (Step 12) ➔ Procure Missing Items (Step 13) ➔ Receive at Site (Step 14) ➔ Consume into Work Order (Step 15)"
    )
    add_page_step(
        12, "FM Material Requisitions", "/facilities/material-requisitions", "FMMaterialRequisitionList.jsx & Form.jsx",
        "Maintenance Supervisor / Site Engineer",
        "Requests replacement spare parts (e.g., HVAC filters, ballasts, circuit breakers) from the company's central inventory warehouse for a specific work order or property.",
        "Enforces internal store controls, ensuring technicians do not withdraw stock without authorization.",
        "Step 13: FM Purchase Requisitions",
        "Input: Part numbers, quantities, work order ID ➔ Output: Approved Material Requisition (MR)."
    )
    add_page_step(
        13, "FM Purchase Requisitions", "/facilities/purchase-requisitions", "FMPurchaseRequisitionList.jsx & Form.jsx",
        "Site Engineer / Procurement Officer",
        "If requested spare parts are out-of-stock in the central warehouse, this page triggers a formal external purchase requisition to procurement for vendor buying.",
        "Prevents unbudgeted rogue purchasing by channeling all external procurement through formal approvals.",
        "Step 14: FM Material Receipts",
        "Input: Unstocked items, vendor quotes, budget code ➔ Output: Formal Purchase Order (PO)."
    )
    add_page_step(
        14, "FM Materials Receipt", "/facilities/material-receipts", "FMMaterialReceiptList.jsx & Form.jsx",
        "Site Storekeeper / Facilities Receiver",
        "Records physical arrival of ordered parts at the facility site. Inspects items against delivery notes, checks specifications, and confirms quantities received.",
        "Ensures items are physically verified before being booked into local facility holding stock.",
        "Step 15: FM Material Utilization",
        "Input: Vendor delivery note, physical goods ➔ Output: Goods Received Note (GRN)."
    )
    add_page_step(
        15, "FM Material Utilization", "/facilities/material-utilizations", "FMMaterialUtilizationList.jsx & Form.jsx",
        "Field Technician / Maintenance Supervisor",
        "Records the actual physical consumption of spare parts into the designated work order. Relieves facility stock balance and debits the property's maintenance expense ledger in Finance.",
        "Provides true job-costing by linking exact material expenses to specific properties and equipment.",
        "Step 16: Security & Access",
        "Input: Material ID, quantity consumed, task ID ➔ Output: General Ledger inventory expense posting."
    )

    add_h2("Stage 5: Security, Workforce & Site Custody")
    add_page_step(
        16, "Security & Access Management", "/facilities/security", "SecurityAccessPage.jsx",
        "Chief Security Officer / Front Desk Guard",
        "Real-time access control: Electronic Visitor Check-in/Check-out with badge printing, Physical Key Register (issuing/returning master keys), and Access Zone clearances (server rooms, rooftops, high-voltage switchrooms).",
        "Controls physical human movement, safeguarding property occupants, intellectual property, and high-risk equipment.",
        "Step 17: Workforce Roster",
        "Input: Visitor ID, host employee, key tag number ➔ Output: Active site visitor badges and key audit logs."
    )
    add_page_step(
        17, "Workforce Roster & Deployment", "/facilities/workforce", "FMWorkforceRosterPage.jsx",
        "Facilities Operations Manager / Staff Scheduler",
        "Assigns internal cleaners, technicians, and security officers to specific properties, zones, and shift patterns. Tracks clock-ins, shift rotations, absences, and overtime hours.",
        "Ensures minimum statutory manning ratios are met across all managed properties 24/7.",
        "Step 18: Checklist Templates",
        "Input: Employee profiles, shift templates, property rosters ➔ Output: Published Monthly Workforce Roster."
    )

    add_h2("Stage 6: Quality, Health, Safety & Statutory Compliance")
    add_page_step(
        18, "Checklist Templates", "/facilities/checklists", "ChecklistTemplatesList.jsx",
        "QA/QC Manager / Safety Director",
        "Builds standardized multi-point digital inspection templates (e.g., 'Monthly Generator 25-Point Audit', 'Quarterly Fire Damper Test', 'Daily Kitchen Hygiene Audit').",
        "Standardizes inspection procedures so all properties are audited against identical benchmarks.",
        "Step 19: Inspections & CAPA",
        "Input: Inspection criteria, pass/fail thresholds ➔ Output: Standardized Digital Checklist Template."
    )
    add_page_step(
        19, "Inspections & Corrective Actions (CAPA)", "/facilities/inspections", "FMInspectionsPage.jsx",
        "Facilities Inspector / Quality Auditor",
        "Executes scheduled site audits using checklist templates. If an item fails (e.g., emergency exit door bolted shut), the system auto-triggers a CAPA and dispatches a priority ticket to the Helpdesk.",
        "Enforces closed-loop accountability so safety defects discovered during audits are immediately repaired.",
        "Step 20: Health & Safety (HSE)",
        "Input: Completed checklist findings, audit photos ➔ Output: Audit Score & Triggered CAPA Work Orders."
    )
    add_page_step(
        20, "Health, Safety & Compliance (HSE)", "/facilities/hsa-compliance", "HealthSafetyCompliancePage.jsx",
        "Site HSE Officer / Risk Manager",
        "Manages hazardous operational risk: Incident reporting, Near-miss investigation root causes, Permits-to-Work (PTW) for dangerous activities (Working at Heights, Hot Work welding, Confined Spaces), and Safety Induction logs.",
        "Guarantees that dangerous maintenance work is safely isolated and approved prior to commencement.",
        "Step 21: Statutory Compliance Obligations",
        "Input: PTW hazard assessment, isolation tags, incident details ➔ Output: Authorized Permit-to-Work."
    )
    add_page_step(
        21, "Compliance Obligations & Statutory Documents Register", "/facilities/compliance", "FMCompliancePage.jsx",
        "Statutory Compliance Officer / In-House Legal",
        "Maintains statutory operating licenses: Fire Safety Certificates, Environmental Protection Agency (EPA) discharge permits, Lift Inspection certificates, and Insurance policies. Direct Cloudinary integration enables uploading certificates with automatic expiration alerts.",
        "Protects the enterprise from legal shut-down orders, fines, or criminal liability resulting from expired operating licenses.",
        "Step 22: Utilities & Energy",
        "Input: Certificate PDFs, issuing authorities, expiry dates ➔ Output: Active legal compliance register with renewal alarms."
    )

    add_h2("Stage 7: Utilities, Energy & Sustainability")
    add_page_step(
        22, "Utilities & Energy Management", "/facilities/utilities-energy", "UtilitiesEnergyPage.jsx",
        "Energy Manager / Facilities Accountant",
        "Logs periodic meter readings for Electricity (kWh), Municipal Water (m³), and Diesel bulk tanks. Detects consumption anomalies (indicating pipe leaks or malfunctioning equipment) and verifies utility bills.",
        "Utilities represent 30–50% of a building's operating expense. Accurate metering enables fair tenant cost allocation.",
        "Step 23: Sustainability Management",
        "Input: Sub-meter readings, utility supplier bills ➔ Output: Reconciled utility consumption and cost allocations."
    )
    add_page_step(
        23, "Sustainability & Environmental Management", "/facilities/sustainability", "SustainabilityManagementPage.jsx",
        "Sustainability Officer / ESG Lead",
        "Converts utility energy data into Scope 1 & Scope 2 greenhouse gas carbon emissions (tCO2e). Tracks recycled waste tonnage, on-site solar generation, and rainwater harvesting metrics.",
        "Provides required corporate ESG (Environmental, Social, Governance) reporting and green building certification data.",
        "Step 24: Contractors & Vendors",
        "Input: kWh power, diesel liters, waste manifests ➔ Output: Corporate Carbon Footprint & ESG Scorecard."
    )

    add_h2("Stage 8: Vendors, Service Billing & Financial Oversight")
    add_page_step(
        24, "Contractors & Service Vendors", "/facilities/contractors-vendors", "ContractorVendorManagementPage.jsx",
        "Vendor Manager / Procurement Lead",
        "Manages third-party specialist contractors (e.g., Otis Elevators, Carrier Chillers, Chubb Fire). Evaluates vendor insurance coverage, SLA performance compliance, and work orders dispatched to third parties.",
        "Monitors specialized maintenance services executed by external certified specialists.",
        "Step 25: Service Billing",
        "Input: Vendor master agreements, certificates of insurance ➔ Output: Approved contractor work authorizations."
    )
    add_page_step(
        25, "Service Billing", "/facilities/servicebilling", "ServiceBillingList.jsx & Form.jsx",
        "Billing Specialist / Accounts Receivable Accountant",
        "Generates customer-facing facilities invoices. Pulls monthly contract retainers, adds metered tenant utility consumption, and appends approved out-of-scope reactive work orders. Links to Finance AR.",
        "Converts facility operations into earned revenue by invoicing clients and tenants.",
        "Step 26: Budgeting & Finance",
        "Input: Contract retainers, metered utility usage, completed work orders ➔ Output: Official Customer Tax Invoice."
    )
    add_page_step(
        26, "Budgeting & Financial Management", "/facilities/budgeting-finance", "FacilitiesBudgetingFinancePage.jsx",
        "Facilities Finance Controller / Portfolio Director",
        "Tracks Year-to-Date (YTD) actual operational expenditures (labor, parts, contractors, energy) against approved property budgets. Calculates operational cost per square meter ($/m²).",
        "Maintains financial control over building operations, identifying cost overruns early.",
        "Step 27: Executive Operations Dashboard",
        "Input: Budget targets, actual General Ledger expense entries ➔ Output: Financial variance analysis per m²."
    )
    add_page_step(
        27, "Facilities Operations Dashboard & Reports Suite", "/facilities/dashboard & /reports/*", "FacilitiesOperationsDashboard.jsx",
        "Executive Leadership / Chief Operating Officer",
        "Real-time operational command center: live SLA compliance percentages, overdue helpdesk tickets, maintenance costs per property, soft services audit scores, and contract renewal alerts.",
        "Provides executive oversight across the entire real estate portfolio from a single dashboard.",
        "Continuous Operational Loop",
        "Input: Real-time telemetry from all 26 preceding pages ➔ Output: High-level KPI oversight and executive decisions."
    )

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 3: PROJECT MANAGEMENT & CONSTRUCTION (PM)
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 3: Project Management & Construction Business Process")
    add_body(
        "The Project Management module controls engineering design, physical construction execution, procurement supply chain, "
        "subcontractor certifications, quality testing, and commercial client valuations. Below is the visual execution roadmap followed by the sequential breakdown of all 29 pages."
    )

    add_visual_diagram(fig3, "Project Management & Construction (PM) End-to-End Workflow", "Sequential execution flow across all 7 project phases and 29 system pages.")

    add_h2("Stage 1: Commercial Tendering & Project Initiation")
    add_page_step(
        1, "Operations Setup", "/project-management/setup", "PMSetup.jsx",
        "PMO Director / Lead Project Scheduler",
        "Establishes master project definitions: Project Types (Civil Infrastructure, EPC, Commercial MEP, Interior Fit-out), Standard Cost Codes (Labor, Plant, Materials, Subcontractors), and Default Working Calendars (6-day site week, holidays).",
        "Standard project controls must be configured before setting up tenders, budgets, and scheduling baselines.",
        "Step 2: Project Quotations",
        "Input: Project types, standard cost codes, working calendar ➔ Output: Project management operational rules."
    )
    add_page_step(
        2, "Project Quotations", "/project-management/quotations", "ProjectQuotationList.jsx & Form.jsx",
        "Senior Estimator / Bid Proposal Manager",
        "Prepares commercial bids for client tenders. Compiles estimated costs (Direct Materials, Plant hire, Labor timesheets, Specialist Subcontractors), applies target markups, and produces formal quote proposals.",
        "Establishes the initial commercial baseline and target gross profit margin for prospective projects.",
        "Step 3: Project Orders",
        "Input: Client tender package, drawings, material estimates ➔ Output: Commercial Project Quote Proposal."
    )
    add_page_step(
        3, "Project Orders", "/project-management/project-orders", "ProjectOrderList.jsx & Form.jsx",
        "Contracts Administrator / Legal Counsel",
        "When the client accepts the quote and issues a Letter of Award (LOA) or signed construction contract, this page binds the order, locking in contract value, advance payment terms, and retention percentages.",
        "Converts a bid estimate into a legally binding contractual commitment before site mobilization starts.",
        "Step 4: Projects Master Register",
        "Input: Signed contract, client PO number, advance payment terms ➔ Output: Binding Project Order."
    )
    add_page_step(
        4, "Projects Master Register & Detail Dashboard", "/project-management/projects", "ProjectList.jsx & ProjectDetailDashboard.jsx",
        "Senior Project Manager / Project Director",
        "Registers the active project in the ERP, designates Project Managers, defines planned start/finish dates, assigns financial branches, and acts as the central hub. Opening a project dashboard displays its completion percentage and budget burn.",
        "Acts as the master parent entity to which all tasks, material requisitions, valuations, and site reports attach.",
        "Step 5: Bill of Quantities (BOQ)",
        "Input: Project order ID, appointed PM, contract sum ➔ Output: Active Project Master Record."
    )

    add_h2("Stage 2: Technical Baseline, Scheduling & Estimating")
    add_page_step(
        5, "Bill of Quantities (BOQ)", "/project-management/boqs", "BOQManager.jsx",
        "Lead Quantity Surveyor (QS) / Cost Engineer",
        "Constructs the Work Breakdown Structure (WBS) and itemized Bill of Quantities: Division ➔ Bill ➔ Section ➔ Item (e.g., 'Item 3.2: C30 Reinforced Concrete in Foundations - 850 m³ @ $145/m³'). Captures rate build-ups.",
        "The BOQ is the commercial foundation for all client payment valuations, subcontractor scopes, and material requisitions.",
        "Step 6: Schedule & Critical Path Method",
        "Input: Architectural & structural engineering drawings ➔ Output: Approved Master Bill of Quantities."
    )
    add_page_step(
        6, "Schedule & Critical Path Method (CPM Gantt)", "/project-management/schedule", "GanttScheduleView.jsx",
        "Project Planner / Schedulng Engineer",
        "Builds the CPM network. Connects activities with Finish-to-Start (FS), Start-to-Start (SS) dependencies, leads, and lags. Automatically calculates Early Start (ES), Early Finish (EF), Late Start (LS), Late Finish (LF), and Total Float. Highlights the Critical Path.",
        "Identifies zero-float critical activities that, if delayed by a single day, will delay overall project completion.",
        "Step 7: Milestones & Timeline",
        "Input: Activity durations, dependency logic, calendar rules ➔ Output: Baseline CPM Gantt Chart & Float Matrix."
    )
    add_page_step(
        7, "Milestones & Timeline", "/project-management/milestones", "ProjectMilestonesTimeline.jsx",
        "Project Director / Client Representative",
        "Translates the detailed 1,000-line Gantt chart into contractual milestones: 'Foundation Substructure Complete', 'Building Top-Out', 'Building Enclosure Weathertight', 'Practical Completion'.",
        "Aligns contractual commercial payment milestones with the engineering schedule.",
        "Step 8: Resource Management",
        "Input: CPM schedule milestones, client contract dates ➔ Output: Executive Milestones Timeline."
    )
    add_page_step(
        8, "Resource Management", "/project-management/resources", "ResourceManagement.jsx",
        "Resource Manager / Plant & Labor Coordinator",
        "Allocates project team personnel, certified engineers, specialized tools, and heavy equipment across project activities. Prevents over-allocation and resource bottlenecks across parallel projects.",
        "Ensures critical activities on the CPM path have confirmed labor and machinery before work starts.",
        "Step 9: Task Assignment",
        "Input: Resource pool, task dates, skill profiles ➔ Output: Allocated Project Team & Plant Fleet."
    )

    add_h2("Stage 3: Task Execution, Labor & Site Machinery")
    add_page_step(
        9, "Task Assignment", "/project-management/tasks", "TaskList.jsx & TaskForm.jsx",
        "Project Engineer / Section Engineer",
        "Deconstructs WBS work packages into short-cycle assignments for site engineers, trade foremen, and subcontractor gangs.",
        "Translates macro project planning into micro-level weekly assignments.",
        "Step 10: Task Execution Dashboard",
        "Input: WBS work packages, assigned foremen ➔ Output: Published Site Work Tasks."
    )
    add_page_step(
        10, "Task Execution Dashboard", "/project-management/tasks/execution", "TaskExecution.jsx",
        "Site Engineer / Trade Foreman",
        "Site supervisors update daily physical progress percentages, record active working hours, and log delay roadblocks (e.g., 'waiting for crane access').",
        "Feeds actual progress back into the CPM scheduling engine to update forecast completion dates.",
        "Step 11: Labor Timesheets",
        "Input: Task ID, physical work completed, delay logs ➔ Output: Live Progress Updates."
    )
    add_page_step(
        11, "Labor Timesheets", "/project-management/timesheets", "TimesheetList.jsx",
        "Site Clerk / Individual Engineers",
        "Logs daily labor hours worked by employee, trade code, and task. Approved timesheets calculate direct labor costs against project cost codes and feed payroll.",
        "Tracks direct site labor costs against budgeted allowances.",
        "Step 12: Purchase Requisitions",
        "Input: Employee hours, trade codes, project cost codes ➔ Output: Approved Project Labor Cost Entries."
    )

    add_h2("Stage 4: Construction Supply Chain & Plant Fleet")
    add_page_step(
        12, "PM Purchase Requisitions", "/project-management/purchase-requisitions", "PMPurchaseRequisitionList.jsx & Form.jsx",
        "Site QS / Project Engineer",
        "Initiates procurement for bulk construction materials (ready-mix concrete, rebar steel, MEP piping) directly against BOQ allowances.",
        "Enforces budgetary control by preventing material orders that exceed BOQ quantities.",
        "Step 13: PM Material Requisitions",
        "Input: BOQ bill item, material specifications, quantity required ➔ Output: Approved Purchase Requisition."
    )
    add_page_step(
        13, "PM Material Requisitions", "/project-management/material-requisitions", "PMMaterialRequisitionList.jsx & Form.jsx",
        "Site Materials Engineer",
        "Requests materials already held in company central storage depots to be transferred out to the construction site.",
        "Controls internal warehouse inventory transfers to the project site.",
        "Step 14: PM Material Receipts",
        "Input: Required site inventory items, destination site ➔ Output: Internal Store Transfer Request."
    )
    add_page_step(
        14, "PM Material Receipts", "/project-management/material-receipts", "PMMaterialReceiptList.jsx & Form.jsx",
        "Site Materials Clerk / Receiving Inspector",
        "Inspects physical delivery of bulk materials at the site gate. Verifies weighbridge tickets, delivery notes, and mill test certificates (e.g., steel tensile strength certificates).",
        "Ensures sub-standard or incorrect materials are rejected before reaching site storage.",
        "Step 15: PM Material Utilization",
        "Input: Supplier delivery dispatch, physical goods ➔ Output: Site Goods Received Note (GRN)."
    )
    add_page_step(
        15, "PM Material Utilization", "/project-management/material-utilizations", "PMMaterialUtilizationList.jsx & Form.jsx",
        "Site Engineer / Cost Controller",
        "Records physical installation of materials into specific BOQ work items. Relieves site holding stock and debits the project's Capital Work-In-Progress (CWIP) account.",
        "Books actual material costs against the project ledger, updating Earned Value metrics.",
        "Step 16: Plant & Equipment Logs",
        "Input: Consumed materials, task code, BOQ line item ➔ Output: General Ledger CWIP Material Expense Entry."
    )
    add_page_step(
        16, "Plant & Equipment Logs", "/project-management/equipment-logs", "EquipmentLogsPage.jsx",
        "Plant Superintendent / Mechanical Foreman",
        "Tracks daily machinery operating hours (Tower Cranes, Excavators, Concrete Pumps). Logs active working hours, standby idle hours, mechanical breakdown downtime, and diesel fuel consumed.",
        "Accurately distributes heavy plant hourly costs across project activities based on actual machine runtime.",
        "Step 17: Daily Site Diary (DSR)",
        "Input: Machine hour meter readings, diesel liters pumped ➔ Output: Plant Operating Cost Distribution."
    )

    add_h2("Stage 5: Site Governance, Quality & Safety Controls")
    add_page_step(
        17, "Daily Site Diary (DSR)", "/project-management/daily-reports", "DailySiteReportList.jsx & Form.jsx",
        "Site Agent / General Foreman",
        "The legal site record: AM/PM weather conditions (e.g., rain stopping concrete pours), total site workforce headcount by trade, machinery active, work completed, site visitors, and safety occurrences.",
        "Provides primary contemporaneous evidence required in contractual delay claims and Extension of Time (EOT) disputes.",
        "Step 18: Subcontractors & IPCs",
        "Input: Weather observations, workforce counts, site logs ➔ Output: Signed Official Daily Site Report."
    )
    add_page_step(
        18, "Subcontractor Agreements & IPCs", "/project-management/subcontracts", "SubcontractorManager.jsx",
        "Contracts Manager / Commercial QS",
        "Manages trade packages (Piling, Structural Steelwork, Curtain Walling). Evaluates subcontractor monthly valuation claims and issues Interim Payment Certificates (IPCs) with retention deductions (e.g., 5-10%).",
        "Enforces subcontractor payment controls, ensuring subcontractors are only paid for inspected, defect-free work.",
        "Step 19: Variations & Change Orders",
        "Input: Subcontractor progress claims, measurement sheets ➔ Output: Certified Interim Payment Certificate (IPC)."
    )
    add_page_step(
        19, "Variations & Change Orders", "/project-management/variations", "VariationRegister.jsx",
        "Lead Quantity Surveyor / Project Director",
        "Manages formal changes to contract scope: Site Instructions (SI), Architect's Instructions (AI), and Variation Orders (VO). Evaluates cost impact and calculates schedule Extension of Time (EOT) claims.",
        "Protects project profitability by preventing scope creep without approved commercial compensation.",
        "Step 20: Quality Control (QA/QC)",
        "Input: Client variation request, rate build-up, schedule delay ➔ Output: Approved Contract Variation Order."
    )
    add_page_step(
        20, "Quality Control (QA/QC)", "/project-management/quality-control", "QualityControlPage.jsx",
        "QA/QC Manager / Resident Engineer",
        "Coordinates engineering quality: Inspection Requests (IRs) to invite client consultants to witness tests before concrete pours, Non-Conformance Reports (NCRs) for defective work, lab cube crush tests, and snagging punch lists.",
        "Prevents concealment of non-compliant work, ensuring construction adheres strictly to project specifications.",
        "Step 21: Safety Management (HSE)",
        "Input: Inspection requests, concrete cube test certificates, NCRs ➔ Output: QA/QC Clearance Certificates."
    )
    add_page_step(
        21, "Safety Management (HSE), Incidents & Toolbox Talks", "/project-management/safety", "SafetyManagementPage.jsx, IncidentRegisterPage.jsx, ToolboxTalksPage.jsx",
        "Site HSE Officer / Safety Inspector",
        "Runs site safety operations: daily morning Toolbox safety briefings for trade gangs, hazard observations, incident investigations, and Lost Time Injury Frequency Rates (LTIFR).",
        "Protects site worker life and health while meeting statutory occupational safety regulations.",
        "Step 22: Drawings & RFIs",
        "Input: Toolbox talk topics, safety hazard logs, incident reports ➔ Output: Site HSE Compliance Record."
    )
    add_page_step(
        22, "Approved Drawings & Requests for Information (RFIs)", "/project-management/documents", "DocumentRegisterPage.jsx",
        "Technical Coordinator / Document Controller",
        "Maintains the register of current Issued for Construction (IFC) architectural and structural drawings with revision control. Manages RFIs to design engineers whenever discrepancies exist between drawings and site conditions.",
        "Prevents construction errors caused by crews working from superseded drawing revisions.",
        "Step 23: Client Valuations",
        "Input: Revision drawings, engineering RFIs, design responses ➔ Output: Approved Drawing Register."
    )

    add_h2("Stage 6: Commercial Billing, Cost Control & EVM")
    add_page_step(
        23, "Client Valuations", "/project-management/client-valuations", "ClientValuationList.jsx",
        "Senior Quantity Surveyor / Commercial Director",
        "Monthly joint physical work measurement with the client's consultant. Quantifies percentage completion against every BOQ item and approved variation order.",
        "Establishes the gross assessed value of work completed on site during the valuation period.",
        "Step 24: Interim Payment Applications",
        "Input: Site measurement sheets, verified progress percentages ➔ Output: Joint Measurement Certificate."
    )
    add_page_step(
        24, "Interim Payment Applications (IPAs)", "/project-management/payment-applications", "PaymentApplicationList.jsx",
        "Commercial Manager / Finance Director",
        "Converts the valuation into a formal commercial payment application: Gross Work Assessed minus Retention Deductions (e.g., 10%) minus Advance Payment Amortization Recovery minus Previous Payments.",
        "The formal contractual document submitted to the client's consultant for payment certification.",
        "Step 25: Project Invoices",
        "Input: Client valuation sum, retention rules, recovery terms ➔ Output: Certified Payment Application (IPA)."
    )
    add_page_step(
        25, "Project Invoices", "/project-management/project-invoices", "ProjectInvoiceList.jsx & Form.jsx",
        "Project Billing Accountant",
        "Once the client consultant issues the Interim Payment Certificate, Finance generates the official commercial tax invoice and posts it to Accounts Receivable.",
        "Creates the legal debt on the client's account in the General Ledger.",
        "Step 26: Project Direct Expenses",
        "Input: Certified Payment Certificate, client tax ID ➔ Output: Official Commercial Project Invoice."
    )
    add_page_step(
        26, "Project Direct Expenses", "/project-management/expenses", "ExpenseList.jsx",
        "Site Cashier / Project Accountant",
        "Records direct site petty cash costs: municipal road-opening fees, water tankers, survey instrumentation calibration, and site office running expenses.",
        "Ensures non-material miscellaneous cash costs are charged directly to the project ledger.",
        "Step 27: Project Income",
        "Input: Expense receipts, project cost code, cashier vouchers ➔ Output: Posted Project Cash Expenses."
    )
    add_page_step(
        27, "Project Income Tracking", "/project-management/income", "ProjectIncomeList.jsx",
        "Accounts Receivable Accountant",
        "Reconciles incoming bank payments from the client against outstanding project invoices, recording bank withholding taxes and net cash received.",
        "Tracks cash collection against billed project amounts.",
        "Step 28: Cost Control & EVM Dashboard",
        "Input: Bank credit advice, payment remittance notes ➔ Output: Closed Invoices & Project Cash Inflow Record."
    )
    add_page_step(
        28, "Cost Control & Earned Value Management (EVM)", "/project-management/cost-control", "CostControlDashboard.jsx",
        "Commercial Director / Lead Cost Controller",
        "Calculates project financial and schedule performance metrics: Planned Value (PV), Earned Value (EV), and Actual Cost (AC). Computes Cost Performance Index (CPI = EV/AC), Schedule Performance Index (SPI = EV/PV), and Estimate at Completion (EAC).",
        "Provides objective mathematical warning of cost overruns or schedule delays while corrective action is still possible.",
        "Step 29: PM Reports Suite",
        "Input: Planned budgets, actual expenses (labor, materials, plant, subs), earned progress ➔ Output: Real-Time EVM Performance Matrix."
    )
    add_page_step(
        29, "PM Status, Execution & Financial Reports Suite", "/project-management/dashboard & /reports/*", "ProjectManagementDashboardPage.jsx & Reports.jsx",
        "Executive Leadership / Project Director",
        "Executive reporting hub: Project Status Variance Reports, Task Execution logs, Project Income vs Expense Margins, and Resource Utilization heatmaps.",
        "Consolidates project performance data for executive governance and board reporting.",
        "Project Closeout & Asset Capitalization (Part 4)",
        "Input: Live data from all 28 preceding construction pages ➔ Output: Executive project health reports."
    )

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 4: FIXED ASSET MANAGEMENT (AM)
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 4: Fixed Asset Management (AM) Business Process")
    add_body(
        "The Fixed Asset Management module controls financial capitalization, balance sheet accounting, depreciation, custody transfers, "
        "revaluations, and disposals. Below is the statutory lifecycle flowchart followed by the sequential breakdown of all 9 pages."
    )

    add_visual_diagram(fig4, "Fixed Asset Management (AM) Financial Lifecycle", "Accounting movement flowchart from Capitalization to Depreciation, Transfers, and Disposal.")

    add_page_step(
        1, "Master Setup & Tagging Rules", "/assets/setup", "AssetSetupPage.jsx",
        "Asset Accountant / Internal Auditor",
        "Configures asset identification standards: Automated Tag Numbering rules (e.g., 'AST-[CAT]-[YEAR]-[SEQ]'), barcode/QR code generation formats, physical site definitions, and manufacturer brand masters.",
        "Standardizes asset tagging across the enterprise before assets are registered.",
        "Step 2: Asset Categories",
        "Input: Tag prefix syntax, barcode symbologies, site masters ➔ Output: Automated Tagging Rules Engine."
    )
    add_page_step(
        2, "Asset Categories & GL Account Mapping", "/assets/categories", "AssetCategoriesPage.jsx",
        "Financial Controller / Chief Accountant",
        "Defines asset classes and links them directly to the General Ledger: Buildings (50 yrs, Straight-Line), Plant & Machinery (10 yrs, Reducing Balance), Motor Vehicles (5 yrs), IT Equipment (3 yrs). Maps Asset Cost GL, Accumulated Depreciation GL, and Depreciation Expense GL accounts.",
        "Prevents accounting errors by routing all depreciation, additions, and disposals to predefined GL accounts.",
        "Step 3: Fixed Asset Register",
        "Input: Useful life years, depreciation methods, GL account codes ➔ Output: Validated Asset Categories Master."
    )
    add_page_step(
        3, "Fixed Asset Register & Registration Form", "/assets/register", "AssetRegisterList.jsx & AssetRegisterForm.jsx",
        "Fixed Asset Accountant",
        "The master financial ledger of capitalized property, plant, and equipment. Assets enter the register from direct purchase invoices or capital project completions. Captures Tag ID, Serial Number, In-Service Date, Cost, Salvage Value, Custodian, and Location.",
        "Establishes the opening book value for assets capitalized onto the corporate Balance Sheet.",
        "Step 4: Depreciation Engine",
        "Input: Capitalization cost, in-service date, tag ID, location ➔ Output: Active Capitalized Asset Master Record."
    )
    add_page_step(
        4, "Asset Depreciation Engine", "/assets/depreciation", "DepreciationRunPage.jsx",
        "General Ledger Accountant / Financial Controller",
        "Executes period depreciation batches (Monthly, Quarterly, Annual). Automatically calculates period depreciation using assigned Straight-Line or Reducing Balance rules, updates Net Book Value (NBV), and posts General Ledger Journal Vouchers (Debit: Depreciation Expense, Credit: Accumulated Depreciation).",
        "Amortizes asset value across its useful life in compliance with IFRS and GAAP accounting standards.",
        "Step 5: Fixed Asset Schedule Report",
        "Input: Active asset master records, accounting period cutoff date ➔ Output: Posted Depreciation Journal Vouchers."
    )
    add_page_step(
        5, "Fixed Asset Schedule Report (IFRS / GAAP Statutory Audit)", "/assets/reports/schedule", "FixedAssetScheduleReport.jsx",
        "External Financial Auditors / Chief Financial Officer",
        "Produces the statutory fixed asset roll-forward movement schedule: Opening Gross Cost + Additions - Disposals +/- Revaluations = Closing Cost. Opening Accumulated Depreciation + Period Charge - Eliminated on Disposal = Closing Depreciation. Final Carrying Amount / NBV.",
        "Provides required financial statement disclosures and the primary audit trail for balance sheet fixed assets.",
        "Step 6: Asset Transfers",
        "Input: Fiscal year dates, asset transaction ledgers ➔ Output: Statutory Fixed Asset Schedule."
    )
    add_page_step(
        6, "Asset Transfers & Custody Tracking", "/assets/transfers", "AssetTransfersPage.jsx",
        "Internal Auditor / Logistics Officer",
        "Tracks physical movements and changes in custody across branches, properties, floors, or assigned employees. Logs sending custodian, receiving custodian, condition at transfer, and maintains an audit trail.",
        "Maintains physical custody controls, preventing asset loss, unrecorded relocation, or theft.",
        "Step 7: Asset Revaluations",
        "Input: Asset Tag ID, destination property/room, receiving custodian ➔ Output: Executed Asset Transfer Certificate."
    )
    add_page_step(
        7, "Asset Value Adjustments & Revaluations", "/assets/revaluations", "AssetRevaluationPage.jsx",
        "Senior Financial Controller / Chartered Valuation Surveyor",
        "Manages asset carrying value adjustments under IAS 16: Upward Revaluations to fair market value (crediting Revaluation Surplus in Equity) or Impairment Losses recognizing severe physical damage or obsolescence (debited to P&L).",
        "Ensures balance sheet asset values reflect fair market value and impairments under accounting standards.",
        "Step 8: Asset Disposals",
        "Input: Certified valuation survey, impairment appraisal ➔ Output: Posted Revaluation / Impairment Journal Voucher."
    )
    add_page_step(
        8, "Asset Disposals & Write-Offs", "/assets/disposals", "AssetDisposalsPage.jsx",
        "Fixed Asset Accountant / Finance Director",
        "Retires assets via Sale, Scrapping, Donation, or Casualty Loss. Eliminates Gross Cost and Accumulated Depreciation from the Balance Sheet, records proceeds received, and posts the resulting accounting Gain or Loss on Disposal.",
        "Formally removes retired assets from corporate books and records disposal gains or losses.",
        "Step 9: Asset Portfolio Dashboard",
        "Input: Disposal reason, selling price, approval sign-off ➔ Output: Asset Retirement Journal Voucher & Deregistration."
    )
    add_page_step(
        9, "Asset Management Landing & Executive Dashboard", "/assets", "AssetManagementHome.jsx",
        "Chief Financial Officer / Asset Management Director",
        "Portfolio financial dashboard displaying Total Active Assets, Gross Historical Cost, Total Accumulated Depreciation, and Portfolio Net Book Value (NBV).",
        "Provides executive visibility over corporate balance sheet capital assets.",
        "End of Asset Cycle",
        "Input: Real-time asset register and financial ledgers ➔ Output: Executive portfolio balance sheet KPIs."
    )

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 5: INTEGRATED CROSS-MODULE SWIMLANE LIFECYCLE
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 5: The Integrated Cross-Module Lifecycle Swimlane")
    add_body(
        "To understand how work moves across departmental boundaries, the swimlane diagram below maps the precise handshakes "
        "between Project Management, Finance & General Ledger, Fixed Asset Management, and Facilities Operations across a single physical asset's lifetime."
    )

    add_visual_diagram(fig5, "Cross-Module Enterprise Swimlane", "Departmental interactions across Project Management, Finance General Ledger, Fixed Assets, and Facilities Operations.")

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 6: BEGINNER'S GLOSSARY OF TECHNICAL TERMS
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 6: Beginner's Comprehensive Glossary of Technical ERP Terms")
    add_body("Below are straightforward, plain-English definitions of specialized terms used across the three modules:")

    glossary = [
        ("BOQ (Bill of Quantities)", "A comprehensive list of every material, labor trade, and machine task needed to complete a project, priced by unit rate (e.g. 100 m³ of concrete at $120/m³)."),
        ("CPM (Critical Path Method)", "A scheduling technique calculating the longest sequence of dependent activities. Activities on the Critical Path have zero float; if one is delayed by 1 day, the entire project completion is delayed by 1 day."),
        ("Total Float vs. Free Float", "Total Float is the amount of time an activity can slip without delaying the final project deadline. Free Float is the time an activity can slip without delaying the Early Start of its immediate successor."),
        ("EVM (Earned Value Management)", "A project performance method comparing Planned Budget (PV), Actual Money Spent (AC), and Real Work Completed (EV) to determine if a project is running over-budget or behind-schedule."),
        ("CPI (Cost Performance Index)", "Measure of cost efficiency: EV divided by AC. Above 1.0 means under-budget (good); below 1.0 means over-budget (cost overrun)."),
        ("SPI (Schedule Performance Index)", "Measure of time efficiency: EV divided by PV. Above 1.0 means ahead of schedule; below 1.0 means delayed."),
        ("EAC (Estimate at Completion)", "The projected final total cost of a project, calculated using current cost efficiency metrics."),
        ("DSR (Daily Site Report)", "A daily site log recording weather conditions, workforce headcount, machinery operating, work completed, and site occurrences. Critical evidence in legal claims."),
        ("IPA vs. IPC", "Interim Payment Application (IPA) is the contractor's monthly bill claiming payment for work done. Interim Payment Certificate (IPC) is the consultant's certified approval confirming the verified amount to be paid."),
        ("SLA (Service Level Agreement)", "A contractual commitment defining response and resolution times (e.g. Emergency electrical repairs response within 15 minutes, resolution within 2 hours)."),
        ("CAPA (Corrective Action)", "A formal process triggered when an inspection fails: identifying the root cause, executing corrective repairs, and implementing preventive controls to prevent recurrence."),
        ("PTW (Permit to Work)", "A formal safety document authorizing personnel to perform high-risk work (working at heights, hot work welding, confined spaces) after safety controls are verified."),
        ("CWIP (Capital Work-in-Progress)", "An asset account accumulating construction costs (materials, labor, plant) while a project is being built, prior to completion and capitalization."),
        ("Capitalization", "The accounting process of transferring accumulated construction costs out of CWIP and into the Fixed Asset Register as an operational Balance Sheet asset."),
        ("Net Book Value (NBV)", "The current balance sheet value of an asset: Gross Historical Cost minus Accumulated Depreciation."),
        ("Straight-Line vs. Reducing Balance", "Straight-Line charges an equal depreciation expense every year across useful life. Reducing Balance charges higher depreciation in early years based on remaining book value."),
        ("Revaluation Surplus vs. Impairment", "Revaluation Surplus records an increase in asset value to fair market value in equity. Impairment recognizes severe damage or obsolescence, writing down asset value against profit/loss.")
    ]

    tbl_gl = doc.add_table(rows=len(glossary) + 1, cols=2)
    tbl_gl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_gl.autofit = False
    tbl_gl.rows[0].cells[0].width = Inches(2.2)
    tbl_gl.rows[0].cells[1].width = Inches(4.7)

    set_table_borders(tbl_gl, "CBD5E1", "4")

    # Header row
    h0, h1_c = tbl_gl.rows[0].cells
    set_cell_background(h0, "0F172A")
    set_cell_background(h1_c, "0F172A")
    set_cell_margins(h0, 80, 80, 100, 100)
    set_cell_margins(h1_c, 80, 80, 100, 100)
    
    p = h0.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("Term & Acronym")
    r.font.name = "Arial"
    r.font.size = Pt(9)
    r.font.bold = True
    r.font.color.rgb = RGBColor(255, 255, 255)

    p = h1_c.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("Plain-English Practical Definition")
    r.font.name = "Arial"
    r.font.size = Pt(9)
    r.font.bold = True
    r.font.color.rgb = RGBColor(255, 255, 255)

    for idx, (term, definition) in enumerate(glossary):
        row = tbl_gl.rows[idx + 1]
        c0, c1 = row.cells
        c0.width = Inches(2.2)
        c1.width = Inches(4.7)
        set_cell_margins(c0, 60, 60, 100, 100)
        set_cell_margins(c1, 60, 60, 100, 100)
        bg = "FFFFFF" if idx % 2 == 0 else "F8FAFC"
        set_cell_background(c0, bg)
        set_cell_background(c1, bg)

        p = c0.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(term)
        r.font.name = "Arial"
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(15, 23, 42)

        p = c1.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.15
        r = p.add_run(definition)
        r.font.name = "Arial"
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(51, 65, 85)

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 7: FINANCIAL DOUBLE-ENTRY GENERAL LEDGER ACCOUNTING GUIDE
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 7: Financial Double-Entry Accounting Guide (Debit & Credit Ledgers)")
    add_body(
        "A critical strength of an integrated enterprise ERP is that operational events in Project Management, "
        "Asset Management, and Facilities Management automatically generate balanced double-entry General Ledger (GL) journal vouchers. "
        "Every physical action—pouring concrete, depreciating a chiller, replacing an electrical breaker, or billing a tenant—updates "
        "the Balance Sheet and Profit & Loss (P&L) statements in real time."
    )

    add_visual_diagram(fig6, "Financial Double-Entry General Ledger Accounting Flow", "How operational events post to Balance Sheet assets, liabilities, and P&L accounts.")

    add_h2("The Master ERP Journal Entry Matrix")
    add_body("Below is the standard double-entry accounting matrix governing all transactions across the three modules:")

    journal_entries = [
        ("1. Issue Site Materials", "PM", "Dr: Capital WIP - Materials (Asset)\nCr: Stores Inventory (Asset)", "Relieves raw materials from inventory and capitalizes them into project construction work-in-progress."),
        ("2. Site Labor Timesheets", "PM", "Dr: Capital WIP - Direct Labor (Asset)\nCr: Accrued Payroll Clearing (Liability)", "Capitalizes direct labor hours worked by site workers and engineering staff into project construction costs."),
        ("3. Machinery Usage", "PM", "Dr: Capital WIP - Plant Hire (Asset)\nCr: Equipment Internal Recovery (P&L)", "Distributes heavy plant hourly operating costs (cranes, excavators) to specific project work items."),
        ("4. Subcontractor IPC", "PM", "Dr: Capital WIP - Subcontracts (Asset)\nCr: Subcontractor Payable (Liability)\nCr: Retention Payable (Liability)", "Certifies monthly subcontractor work, recognizing payable debt while deducting 5-10% retention until defect expiry."),
        ("5. Client IPA Invoice", "PM", "Dr: Accounts Receivable - Client (Asset)\nCr: Project Contract Revenue (P&L)", "Billed upon consultant certification of monthly work done, creating legal debtor balance."),
        ("6. Client Cash Received", "PM", "Dr: Bank Cash Account (Asset)\nCr: Accounts Receivable - Client (Asset)", "Reconciles cash payment deposited by client into bank against outstanding project invoice."),
        ("7. Asset Capitalization", "AM", "Dr: Fixed Assets - Building (Asset)\nDr: Fixed Assets - Plant & Equip (Asset)\nCr: Capital WIP (Asset)", "Project practical completion: reclassifies accumulated construction costs out of CWIP and onto Balance Sheet as Fixed Assets."),
        ("8. Depreciation Run", "AM", "Dr: Depreciation Expense (P&L Expense)\nCr: Accumulated Depreciation (Contra-Asset)", "Amortizes asset value across useful life. Net Book Value = Gross Historical Cost minus Accumulated Depreciation."),
        ("9. Upward Revaluation", "AM", "Dr: Fixed Asset Carrying Value (Asset)\nCr: Revaluation Surplus (Equity)", "IAS 16 fair value increase: boosts asset balance sheet value and credits equity without touching operating profit."),
        ("10. Impairment Loss", "AM", "Dr: Asset Impairment Loss (P&L Expense)\nCr: Fixed Asset Carrying Value (Asset)", "Recognizes catastrophic damage, obsolescence, or market collapse, writing down asset value directly against earnings."),
        ("11. Asset Disposal / Sale", "AM", "Dr: Bank Cash (Proceeds received)\nDr: Accumulated Depreciation (Eliminated)\nCr: Fixed Asset Cost (Eliminated)\nDr/Cr: Loss / (Gain) on Sale (P&L)", "Completely removes retired asset and accumulated depreciation from corporate books, posting net gain or loss to P&L."),
        ("12. FM Spares Consumed", "FM", "Dr: Repairs & Maintenance Expense (P&L)\nCr: Facility Spares Inventory (Asset)", "Consumes replacement parts (valves, filters, switches) onto an active facility work order."),
        ("13. Tenant Service Billing", "FM", "Dr: Accounts Receivable - Tenants (Asset)\nCr: FM Service Retainer Revenue (P&L)\nCr: Reimbursable Utilities Recovery (P&L)", "Invoices commercial tenants for monthly contractual maintenance retainers and metered electrical/water consumption.")
    ]

    tbl_je = doc.add_table(rows=len(journal_entries) + 1, cols=4)
    tbl_je.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_je.autofit = False
    col_w_je = [Inches(1.5), Inches(0.5), Inches(2.6), Inches(2.3)]
    for row in tbl_je.rows:
        for idx, w in enumerate(col_w_je):
            row.cells[idx].width = w

    set_table_borders(tbl_je, "CBD5E1", "4")

    # Header
    h_je = tbl_je.rows[0].cells
    for c in h_je:
        set_cell_background(c, "0F172A")
        set_cell_margins(c, 80, 80, 80, 80)
    
    headers_je_text = ["Operational Event", "Mod", "Debit (Dr) / Credit (Cr) Journal Entries", "Accounting & Financial Purpose"]
    for i, txt in enumerate(headers_je_text):
        p = h_je[i].paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(txt)
        r.font.name = "Arial"
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    for idx, (event, mod, je_str, desc) in enumerate(journal_entries):
        row = tbl_je.rows[idx + 1]
        for i, w in enumerate(col_w_je):
            row.cells[i].width = w
            set_cell_margins(row.cells[i], 50, 50, 70, 70)
        
        bg = "FFFFFF" if idx % 2 == 0 else "F8FAFC"
        for c in row.cells:
            set_cell_background(c, bg)

        # Event
        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(event)
        r0.font.name = "Arial"
        r0.font.size = Pt(8)
        r0.font.bold = True
        r0.font.color.rgb = RGBColor(15, 23, 42)

        # Mod
        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(mod)
        r1.font.name = "Arial"
        r1.font.size = Pt(8)
        r1.font.bold = True
        r1.font.color.rgb = RGBColor(2, 132, 199)

        # Journal Entry
        p2 = row.cells[2].paragraphs[0]
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after = Pt(0)
        p2.paragraph_format.line_spacing = 1.15
        r2 = p2.add_run(je_str)
        r2.font.name = "Arial"
        r2.font.size = Pt(8)
        r2.font.color.rgb = RGBColor(30, 41, 59)

        # Purpose
        p3 = row.cells[3].paragraphs[0]
        p3.paragraph_format.space_before = Pt(0)
        p3.paragraph_format.space_after = Pt(0)
        p3.paragraph_format.line_spacing = 1.15
        r3 = p3.add_run(desc)
        r3.font.name = "Arial"
        r3.font.size = Pt(8)
        r3.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 8: MASTER RACI RESPONSIBILITY MATRIX
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 8: Master RACI Responsibility Matrix (Governance Model)")
    add_body(
        "A clear division of responsibility prevents operational bottlenecks and compliance lapses. "
        "The RACI framework defines decision rights across all three modules:\n"
        "• R (Responsible): The role that actively executes the step or creates the document.\n"
        "• A (Accountable): The sole role with final approval authority and ultimate business ownership.\n"
        "• C (Consulted): Subject matter experts who must provide data, technical specs, or compliance inputs.\n"
        "• I (Informed): Stakeholders kept updated on progress or outcomes."
    )

    add_visual_diagram(fig7, "Enterprise RACI Governance Hierarchy", "Four tiers of governance from Executive Leadership to Management, Compliance, and Frontline Teams.")

    raci_rows = [
        ("Project Charter & Contract Binding", "A", "R", "C", "I", "C", "I", "I", "I"),
        ("Bill of Quantities (BOQ) Build-up", "A", "C", "R", "I", "C", "I", "I", "I"),
        ("CPM Schedule & Critical Path Baseline", "A", "C", "R", "I", "I", "C", "I", "I"),
        ("Daily Site Report (DSR) & Timesheets", "I", "R", "I", "I", "I", "C", "I", "I"),
        ("Quality Inspection (IRs) & NCR Clearance", "I", "C", "I", "R", "I", "C", "I", "I"),
        ("Subcontractor IPC Certification", "A", "C", "R", "I", "C", "I", "I", "I"),
        ("Client Interim Payment Application (IPA)", "A", "C", "R", "I", "C", "I", "I", "I"),
        ("Project Practical Completion & Handover", "A", "R", "C", "C", "C", "C", "C", "I"),
        ("Fixed Asset Capitalization & Tagging", "C", "I", "I", "R", "I", "I", "I", "I"),
        ("Monthly Asset Depreciation Batch Run", "I", "I", "I", "R", "I", "I", "I", "I"),
        ("Statutory Fixed Asset Schedule Report", "A", "I", "I", "R", "I", "I", "I", "I"),
        ("Asset Revaluation & Impairment Review", "A", "I", "I", "R", "C", "I", "I", "I"),
        ("Asset Retirement & Scrap Disposal", "A", "I", "I", "R", "I", "C", "I", "I"),
        ("Property Handover Intake & Space Setup", "I", "C", "I", "C", "R", "C", "I", "I"),
        ("Commercial FM Service Contracts & SLAs", "A", "I", "I", "C", "R", "I", "I", "I"),
        ("Helpdesk Ticket Triage & SLA Dispatch", "I", "I", "I", "I", "I", "I", "R", "I"),
        ("FM Work Order Field Execution", "I", "I", "I", "I", "A", "C", "I", "R"),
        ("FM Spare Parts Material Utilization", "I", "I", "I", "I", "A", "I", "I", "R"),
        ("Site Safety Inspections & CAPA Audits", "I", "I", "I", "I", "A", "R", "I", "C"),
        ("Tenant Facilities Service Billing", "I", "I", "I", "C", "R", "I", "I", "I")
    ]

    tbl_raci = doc.add_table(rows=len(raci_rows) + 1, cols=9)
    tbl_raci.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_raci.autofit = False
    col_w_raci = [Inches(2.5), Inches(0.55), Inches(0.55), Inches(0.55), Inches(0.55), Inches(0.55), Inches(0.55), Inches(0.55), Inches(0.55)]
    for row in tbl_raci.rows:
        for idx, w in enumerate(col_w_raci):
            row.cells[idx].width = w

    set_table_borders(tbl_raci, "CBD5E1", "4")

    # Header
    h_raci = tbl_raci.rows[0].cells
    for c in h_raci:
        set_cell_background(c, "0F172A")
        set_cell_margins(c, 80, 80, 40, 40)
    
    raci_headers = ["Key Process / Milestone Activity", "PM", "SE", "QS", "AC", "FM", "HSE", "HD", "TECH"]
    for i, txt in enumerate(raci_headers):
        p = h_raci[i].paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i > 0 else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(txt)
        r.font.name = "Arial"
        r.font.size = Pt(8)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    for idx, (act, pm, se, qs, ac, fm, hse, hd, tech) in enumerate(raci_rows):
        row = tbl_raci.rows[idx + 1]
        for i, w in enumerate(col_w_raci):
            row.cells[i].width = w
            set_cell_margins(row.cells[i], 40, 40, 40, 40)
        
        bg = "FFFFFF" if idx % 2 == 0 else "F8FAFC"
        for c in row.cells:
            set_cell_background(c, bg)

        # Activity
        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(act)
        r0.font.name = "Arial"
        r0.font.size = Pt(7.5)
        r0.font.bold = True
        r0.font.color.rgb = RGBColor(15, 23, 42)

        # Roles
        for col_idx, val in enumerate([pm, se, qs, ac, fm, hse, hd, tech], start=1):
            p = row.cells[col_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r_val = p.add_run(val)
            r_val.font.name = "Arial"
            r_val.font.size = Pt(8)
            r_val.font.bold = True
            if val == "A":
                r_val.font.color.rgb = RGBColor(220, 38, 38) # Red
            elif val == "R":
                r_val.font.color.rgb = RGBColor(2, 132, 199) # Blue
            elif val == "C":
                r_val.font.color.rgb = RGBColor(217, 119, 6) # Amber
            else:
                r_val.font.color.rgb = RGBColor(100, 116, 139) # Gray

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 9: PRACTICAL STEP-BY-STEP REAL-WORLD EXECUTION SCENARIOS
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 9: Practical Step-by-Step Real-World Execution Scenarios")
    add_body(
        "To bridge the gap between theory and day-to-day work, this section walks through four realistic corporate scenarios "
        "demonstrating exactly how users execute work across the software screens."
    )

    add_h2("Scenario A: Fast-Track Commercial Construction Project (PM Execution)")
    add_callout(
        "Scenario A Context",
        "Apex Properties awards your firm a contract to construct a $2.4M regional warehouse facility. Total planned duration: 180 working days."
    )
    add_body(
        "1. Bid Quotation & Order Binding: The Senior Estimator opens /pm/quotations, builds direct labor, concrete, steel, and plant estimates, applying a 15% margin ($2.4M). Upon receiving the client's Letter of Award, the contract administrator converts it into an active Project Order at /pm/project-orders.\n"
        "2. WBS & Bill of Quantities Baseline: The Quantity Surveyor opens /pm/boqs, importing the 450-line itemized BOQ (Substructure, Superstructure, Roofing, MEP). Rates and quantities are baseline-locked.\n"
        "3. Critical Path Scheduling: The Project Planner opens /pm/schedule. They input dependencies: Foundation Curing (7 days) must finish before Steel Portal Frame Erection starts. The CPM engine flags Steel Frame as zero-float Critical Path. Key milestones are established at /pm/milestones.\n"
        "4. Site Mobilization & Daily Diary: Groundbreaking begins. The Site Foreman opens /pm/daily-reports every afternoon, logging weather (clear), 42 workers present, and concrete pour volumes. Machinery hours for the mobile crane are entered at /pm/equipment-logs.\n"
        "5. Materials Supply Chain: The site engineer submits a Purchase Requisition at /pm/purchase-requisitions for 60 tonnes of rebar. When delivered, the storekeeper records the Goods Receipt at /pm/material-receipts. As ironworkers install it into the foundations, the engineer posts Material Utilization at /pm/material-utilizations, debiting CWIP.\n"
        "6. Quality Inspection & Subcontractor IPC: Before the concrete pour, the engineer submits an Inspection Request (IR) at /pm/quality-control. The consultant inspects and signs off. The piling subcontractor submits their monthly bill; the QS certifies the Interim Payment Certificate at /pm/subcontracts, deducting 10% retention.\n"
        "7. Client Monthly Valuation & Invoicing: On day 30, the QS and client consultant jointly measure work completed: 18% physical progress. The QS opens /pm/client-valuations, inputs certified quantities ($432,000), and generates the formal Interim Payment Application (IPA) at /pm/payment-applications. Finance generates the commercial invoice at /pm/project-invoices.\n"
        "8. Practical Handover: On day 175, all snag items are cleared. The project manager conducts the final handover walkthrough, generates the Practical Completion Certificate, and prepares the file for Asset Capitalization."
    )

    add_h2("Scenario B: Capital Handover, Fixed Asset Tagging & Property Onboarding (The Bridge)")
    add_callout(
        "Scenario B Context",
        "The $2.4M warehouse construction is complete. The building must now be transferred onto the corporate Balance Sheet and onboarded for commercial operations."
    )
    add_body(
        "1. CWIP Capitalization Reconciliation: The Financial Controller reviews the project ledger: Total accumulated CWIP = $2,380,000 (Direct materials $1.1M, labor $480k, plant $320k, subcontractors $480k). The project finished $20,000 under budget!\n"
        "2. Asset Classification: The Asset Accountant navigates to /assets/categories to verify asset classes: 'Industrial Buildings' (useful life 40 years, straight-line) and 'Heavy MEP Plant' (useful life 15 years, reducing balance).\n"
        "3. Capitalization & Barcode Tagging: The accountant opens /assets/new. They capitalize the building at $2,000,000 (Tag AST-BLD-2026-001) and the central HVAC/transformer plant at $380,000 (Tag AST-PLT-2026-001). The system automatically reclassifies $2,380,000 from Capital WIP to Fixed Asset Cost.\n"
        "4. Property Onboarding: The Facilities Manager navigates to /facilities/onboarding. They step through the 12-point intake checklist: verifying fire safety occupancy permits, water discharge certificates, electrical single-line diagrams, operating manuals, and master keys.\n"
        "5. Property & Space Registration: The building is registered at /facilities/properties as 'Regional Logistics Hub A'. The Space Planner opens /facilities/space-occupancy to zone the facility into Warehouse Bay 1, Bay 2, and Admin Office Suites.\n"
        "6. Monthly Depreciation Kick-Off: At month-end, the GL accountant navigates to /assets/depreciation and runs the batch. The engine automatically debits Depreciation Expense and credits Accumulated Depreciation, posting the journal voucher to the General Ledger."
    )

    add_h2("Scenario C: Emergency HVAC Breakdown & Reactive Tenant Billing (FM Operations)")
    add_callout(
        "Scenario C Context",
        "At 10:15 AM on a hot summer Tuesday, a major chilled water pipe joint ruptures in the 3rd-floor server room of an executive office tenant. Water threatens electrical racks."
    )
    add_body(
        "1. Helpdesk Ticket Intake: The tenant logs into /facilities/helpdesk reporting 'CRITICAL: Chilled water pipe burst in Server Room B'. System detects priority 'EMERGENCY' and immediately starts the 15-minute response SLA countdown clock.\n"
        "2. Immediate Dispatch: The dispatcher receives the alert, opens /facilities/tasks/new, and assigns Senior MEP Technician Kwame Mensah with a 15-minute target arrival.\n"
        "3. Field Arrival & Safety Isolation: At 10:24 AM (9 minutes—well within SLA!), the technician arrives, opens /facilities/tasks/execution on his mobile tablet, clocks in, isolates the sectional ball valve, and takes photos of the damaged gasket.\n"
        "4. Spare Part Requisition: The technician needs a 4-inch high-pressure EPDM flange gasket. He opens /facilities/material-requisitions. The site storekeeper issues the part from inventory.\n"
        "5. Repair Execution & Client Sign-Off: Kwame installs the new gasket, torque-bolts the flange, restores water pressure, tests for leaks, and takes post-repair photos. The tenant facility manager inspects the server room and signs the digital tablet screen.\n"
        "6. Material Utilization & CAPA Inspection: Kwame logs 2 hours labor and 1 gasket used at /facilities/material-utilizations. The Safety Officer opens /facilities/inspections, logs a CAPA investigation, and orders ultrasonic pipe wall thickness testing on adjacent joints.\n"
        "7. Commercial Billing: Because the pipe rupture was caused by tenant third-party server installers bumping the pipe, the contract rules it billable out-of-scope. Billing Specialist opens /facilities/servicebilling/new, automatically pulls Kwame's labor hours ($160) and gasket ($45), applies markup, and generates an invoice to the tenant."
    )

    add_h2("Scenario D: Year-End Financial Audit, Asset Schedule & Revaluation")
    add_callout(
        "Scenario D Context",
        "Corporate fiscal year-end close. External auditors (PwC) arrive to audit the company's $45M Fixed Asset portfolio, WIP capitalizations, and maintenance expense allocations."
    )
    add_body(
        "1. Statutory Fixed Asset Schedule: The Asset Controller opens /assets/reports/schedule and generates the statutory IFRS/GAAP Fixed Asset Movement Matrix for the fiscal year. The report proves full balance sheet integrity:\n"
        "   Opening Gross Cost ($41.2M) + Capex Additions ($4.5M) - Asset Disposals ($0.7M) = Closing Cost ($45.0M).\n"
        "   Opening Accumulated Dep ($12.1M) + Period Charge ($2.8M) - Disposals Eliminated ($0.5M) = Closing Accum Dep ($14.4M).\n"
        "   Net Book Value (NBV) = $30.6M. The auditors verify the figures match the General Ledger trial balance exactly.\n"
        "2. Asset Impairment Testing: An older commercial generator experienced catastrophic alternator burnout during a storm. Repair is uneconomical. The accountant opens /assets/revaluations, records an Impairment Loss of $45,000, and writes down the asset's book value to scrap salvage.\n"
        "3. Asset Disposal Execution: The damaged generator is sold to a certified recycler for $4,000 cash. The accountant opens /assets/disposals, logs the transaction, and the system automatically posts the gain/loss derecognition journal entry.\n"
        "4. PM EVM Final Audit: The PMO Director opens /project-management/reports/project-status, verifying that all closed projects have their cost variance (CV) and schedule variance (SV) reconciled."
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ─────────────────────────────────────────────────────────────────────────────
    # PART 10: STANDARD OPERATING PROCEDURES (SOPS) & PRE-FLIGHT CHECKLISTS
    # ─────────────────────────────────────────────────────────────────────────────
    add_h1("PART 10: Standard Operating Procedures (SOPs) & Pre-Flight Checklists")
    add_body("To maintain operational quality and audit readiness, teams must execute these four standardized pre-flight checklists:")

    def add_checklist_table(title, items):
        add_h3(title)
        tbl = doc.add_table(rows=len(items) + 1, cols=3)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        widths = [Inches(0.6), Inches(4.5), Inches(1.8)]
        for r in tbl.rows:
            for idx, w in enumerate(widths):
                r.cells[idx].width = w

        set_table_borders(tbl, "CBD5E1", "4")

        # Header
        h = tbl.rows[0].cells
        for c in h:
            set_cell_background(c, "1E293B")
            set_cell_margins(c, 70, 70, 70, 70)
        
        for idx, h_txt in enumerate(["No.", "Verification Checkpoint & Action Item", "Target Responsible Role"]):
            p = h[idx].paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(h_txt)
            r.font.name = "Arial"
            r.font.size = Pt(8.5)
            r.font.bold = True
            r.font.color.rgb = RGBColor(255, 255, 255)

        for idx, (check, role) in enumerate(items, start=1):
            row = tbl.rows[idx]
            bg = "FFFFFF" if idx % 2 == 1 else "F8FAFC"
            for c in row.cells:
                set_cell_background(c, bg)
                set_cell_margins(c, 50, 50, 60, 60)

            # Num
            p0 = row.cells[0].paragraphs[0]
            p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p0.paragraph_format.space_before = Pt(0)
            p0.paragraph_format.space_after = Pt(0)
            r0 = p0.add_run(str(idx))
            r0.font.name = "Arial"
            r0.font.size = Pt(8)
            r0.font.bold = True
            r0.font.color.rgb = RGBColor(15, 23, 42)

            # Check
            p1 = row.cells[1].paragraphs[0]
            p1.paragraph_format.space_before = Pt(0)
            p1.paragraph_format.space_after = Pt(0)
            p1.paragraph_format.line_spacing = 1.15
            r1 = p1.add_run(check)
            r1.font.name = "Arial"
            r1.font.size = Pt(8)
            r1.font.color.rgb = RGBColor(51, 65, 85)

            # Role
            p2 = row.cells[2].paragraphs[0]
            p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p2.paragraph_format.space_before = Pt(0)
            p2.paragraph_format.space_after = Pt(0)
            r2 = p2.add_run(role)
            r2.font.name = "Arial"
            r2.font.size = Pt(8)
            r2.font.bold = True
            r2.font.color.rgb = RGBColor(2, 132, 199)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Checklist 1: PM Pre-Mobilization
    add_checklist_table("SOP 1: Construction Site Pre-Mobilization Checklist", [
        ("Client Project Order legally executed and signed (/pm/project-orders)", "Contracts Manager"),
        ("Approved Bill of Quantities (BOQ) imported and baseline budget locked (/pm/boqs)", "Lead Quantity Surveyor"),
        ("CPM Schedule generated with critical path and working calendar validated (/pm/schedule)", "Project Planner"),
        ("Contractual project milestones agreed with client consultant (/pm/milestones)", "Project Manager"),
        ("Site HSE Risk Assessment completed and safety induction materials prepared (/pm/safety)", "Site HSE Officer"),
        ("Initial bulk materials Purchase Requisitions submitted for early works (/pm/purchase-requisitions)", "Project Engineer"),
        ("Trade Subcontractor agreements signed with retention terms (/pm/subcontracts)", "Commercial Manager"),
        ("Approved Issued For Construction (IFC) drawings verified in document register (/pm/documents)", "Document Controller"),
        ("Daily Site Report (DSR) logging protocol established with site clerks (/pm/daily-reports)", "Site General Foreman"),
        ("Advance payment bank guarantee submitted and payment application logged (/pm/payment-applications)", "Finance Director")
    ])

    # Checklist 2: FM Handover
    add_checklist_table("SOP 2: Facility Handover & Property Onboarding Checklist", [
        ("Final architectural and MEP As-Built CAD/PDF drawings archived (/facilities/onboarding)", "Handover Lead"),
        ("Statutory Fire Safety, EPA discharge permits, and Lift operating certificates uploaded (/facilities/compliance)", "Compliance Lead"),
        ("Physical property, building, floor, and zone hierarchy structured (/facilities/properties)", "Property Manager"),
        ("Space layouts, office suites, and tenant lease agreements registered (/facilities/space-occupancy)", "Space Planner"),
        ("Client/Tenant service contracts and SLA response policies mapped (/facilities/contracts & /sla-policies)", "Commercial Manager"),
        ("Preventive maintenance checklist templates configured for technical plant (/facilities/checklists)", "Chief Engineer"),
        ("Utility meters (electricity, water, diesel) read, recorded, and baseline logged (/facilities/utilities-energy)", "Energy Manager"),
        ("Key management register established and access zones programmed (/facilities/security)", "Security Chief"),
        ("Cleaning, technical, and security workforce shift rosters published (/facilities/workforce)", "Operations Lead"),
        ("Helpdesk ticketing portal opened and tenant welcome briefing conducted (/facilities/helpdesk)", "Helpdesk Lead")
    ])

    # Checklist 3: Fixed Asset Audit
    add_checklist_table("SOP 3: Periodic Fixed Asset Physical Barcode Audit Checklist", [
        ("Current active capitalized asset listing exported from register (/assets/register)", "Asset Accountant"),
        ("Barcode / QR code scanning scanners calibrated with asset tagging rules (/assets/setup)", "Internal Auditor"),
        ("Physical wall-to-wall scan conducted by location (Floor, Room, Zone)", "Audit Field Team"),
        ("Unrecorded physical asset transfers identified and logged (/assets/transfers)", "Logistics Officer"),
        ("Damaged, obsolete, or broken assets flagged for impairment testing (/assets/revaluations)", "Valuation Lead"),
        ("Unlocatable missing assets flagged for formal loss investigation", "Security Lead"),
        ("Capital additions during period verified against CWIP completion certificates", "Project Accountant"),
        ("Asset physical condition ratings updated in master register", "Fixed Asset Lead"),
        ("Physical inventory reconciled with Balance Sheet Net Book Value (NBV)", "Financial Controller"),
        ("Audit sign-off certificate issued for external financial auditors", "Chief Financial Officer")
    ])

    # Checklist 4: Monthly Financial Close
    add_checklist_table("SOP 4: Month-End Operational & Financial Close Checklist", [
        ("All site labor timesheets approved and locked for payroll processing (/pm/timesheets)", "Site Clerks / PM"),
        ("All site material utilization entries posted against BOQ tasks (/pm/material-utilizations)", "Site Engineers"),
        ("Subcontractor interim payment certificates certified and retention deducted (/pm/subcontracts)", "Quantity Surveyor"),
        ("Client monthly valuation measurement signed and IPA invoice issued (/pm/payment-applications)", "Commercial Manager"),
        ("Project Cost Control EVM dashboard metrics (CPI, SPI, EAC) computed (/pm/cost-control)", "Cost Controller"),
        ("Asset monthly depreciation batch run executed and GL journal vouchers posted (/assets/depreciation)", "Asset Accountant"),
        ("Fixed Asset roll-forward schedule report balanced against Trial Balance (/assets/reports/schedule)", "General Ledger Lead"),
        ("Facilities maintenance material consumption posted to property expense ledgers (/facilities/material-utilizations)", "FM Supervisor"),
        ("Tenant utility sub-meter readings entered and monthly service bills issued (/facilities/servicebilling)", "Billing Specialist"),
        ("Facilities actual operational expenses reconciled against annual property budget (/facilities/budgeting-finance)", "Finance Controller")
    ])

    # ─────────────────────────────────────────────────────────────────────────────
    # SAVE DOCUMENT
    # ─────────────────────────────────────────────────────────────────────────────
    output_dir = os.path.join(os.getcwd(), "client", "public", "downloads")
    os.makedirs(output_dir, exist_ok=True)
    
    # Save as Visual Handbook name so it never conflicts if Word has the earlier file open
    primary_name = "OmniSuite_ERP_Business_Process_Flows_Visual_Handbook.docx"
    output_path = os.path.join(output_dir, primary_name)
    doc.save(output_path)
    print(f"SUCCESS: Document with Visual Diagrams created at {output_path}")

    # Also try saving back to original name if not locked by Word
    fallback_name = "OmniSuite_ERP_Process_Flow_Handbook.docx"
    try:
        doc.save(os.path.join(output_dir, fallback_name))
        print(f"SUCCESS: Also updated {fallback_name}")
    except PermissionError:
        print(f"Note: {fallback_name} is currently open in Microsoft Word. Visual version saved as {primary_name}")

    # Also copy to dist/downloads if dist exists
    dist_dir = os.path.join(os.getcwd(), "client", "dist", "downloads")
    if os.path.exists(os.path.join(os.getcwd(), "client", "dist")):
        os.makedirs(dist_dir, exist_ok=True)
        try:
            doc.save(os.path.join(dist_dir, primary_name))
            doc.save(os.path.join(dist_dir, fallback_name))
        except Exception:
            pass

if __name__ == "__main__":
    build_process_guide()

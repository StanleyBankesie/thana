const fs = require("fs");
const path = require("path");

function adapt(srcPath, destPath, replacements) {
  let content = fs.readFileSync(srcPath, "utf8");
  for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
  }
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(destPath, content, "utf8");
  console.log("Wrote " + destPath);
}

// 1. FMTaskList.jsx
adapt(
  "client/src/pages/modules/project-management/tasks/TaskList.jsx",
  "client/src/pages/modules/facilities/tasks/FMTaskList.jsx",
  [
    ["/projects/tasks", "/facilities/tasks"],
    ["/project-management/tasks", "/facilities/tasks"],
    ["Task Management", "FM Task Management"],
    ["WBS task allocation, scope management & assignment tracking", "Facilities task allocation, work order tracking & assignment management"],
    ["Project", "Property"],
    ["project_name", "property_name"],
    ["projectName", "propertyName"],
    ["export default function TaskList()", "export default function FMTaskList()"],
    ["Filter tasks by title or project...", "Filter tasks by title or property..."]
  ]
);

// 2. FMTaskForm.jsx
adapt(
  "client/src/pages/modules/project-management/tasks/TaskForm.jsx",
  "client/src/pages/modules/facilities/tasks/FMTaskForm.jsx",
  [
    ["/projects/tasks", "/facilities/tasks"],
    ["/project-management/tasks", "/facilities/tasks"],
    ["/projects?active=all", "/facilities/properties"],
    ["export default function TaskForm()", "export default function FMTaskForm()"],
    ["projectId", "propertyId"],
    ["projectName", "propertyName"],
    ["project_id", "property_id"],
    ["project_name", "property_name"],
    ["setProjects", "setProperties"],
    ["projects", "properties"],
    ["Project", "Property"],
    ["WBS Item Specification & Execution Management", "FM Work Order Specification & Execution Management"]
  ]
);

// 3. FMTaskExecution.jsx
adapt(
  "client/src/pages/modules/project-management/tasks/TaskExecution.jsx",
  "client/src/pages/modules/facilities/tasks/FMTaskExecution.jsx",
  [
    ["/projects/tasks", "/facilities/tasks"],
    ["/project-management/tasks", "/facilities/tasks"],
    ["/project-management?section=Reports%20%26%20Analytics", "/facilities"],
    ["export default function TaskExecution()", "export default function FMTaskExecution()"],
    ["project_name", "property_name"],
    ["Task Execution", "FM Task Execution"],
    ["Interactive WBS execution", "Interactive FM task execution"],
    ["Project Task", "FM Property Task"],
    ["Search task title or project...", "Search task title or property..."]
  ]
);

// 4. FMPurchaseRequisitionList.jsx
adapt(
  "client/src/pages/modules/project-management/purchase-requisitions/PMPurchaseRequisitionList.jsx",
  "client/src/pages/modules/facilities/purchase-requisitions/FMPurchaseRequisitionList.jsx",
  [
    ["/projects/purchase-requisitions", "/facilities/purchase-requisitions"],
    ["/project-management/purchase-requisitions", "/facilities/purchase-requisitions"],
    ["export default function PMPurchaseRequisitionList()", "export default function FMPurchaseRequisitionList()"],
    ["project_name", "property_name"],
    ["Project", "Property"],
    ["Purchase Requisitions", "FM Purchase Requisitions"],
    ["Request materials for project procurement", "Request materials for facilities procurement"],
    ["PM.PR.CANCEL", "FM.PR.CANCEL"]
  ]
);

// 5. FMPurchaseRequisitionForm.jsx
adapt(
  "client/src/pages/modules/project-management/purchase-requisitions/PMPurchaseRequisitionForm.jsx",
  "client/src/pages/modules/facilities/purchase-requisitions/FMPurchaseRequisitionForm.jsx",
  [
    ["/projects/purchase-requisitions", "/facilities/purchase-requisitions"],
    ["/project-management/purchase-requisitions", "/facilities/purchase-requisitions"],
    ["/projects/projects", "/facilities/properties"],
    ["export default function PMPurchaseRequisitionForm()", "export default function FMPurchaseRequisitionForm()"],
    ["projectId", "propertyId"],
    ["project_id", "property_id"],
    ["project_name", "property_name"],
    ["setProjects", "setProperties"],
    ["projects", "properties"],
    ["Project", "Property"],
    ["Purchase Requisition", "FM Purchase Requisition"],
    ["Request materials for project procurement", "Request materials for facilities procurement"],
    ["PM.PR.CANCEL", "FM.PR.CANCEL"],
    ["pm-pr-item-search", "fm-pr-item-search"]
  ]
);

// 6. FMMaterialRequisitionList.jsx
adapt(
  "client/src/pages/modules/project-management/material-requisition/MaterialRequisitionList.jsx",
  "client/src/pages/modules/facilities/material-requisition/FMMaterialRequisitionList.jsx",
  [
    ["/projects/material-requisitions", "/facilities/material-requisitions"],
    ["/project-management/material-requisitions", "/facilities/material-requisitions"],
    ["export default function MaterialRequisitionList()", "export default function FMMaterialRequisitionList()"],
    ["project_name", "property_name"],
    ["Project", "Property"],
    ["Material Requisitions", "FM Material Requisitions"],
    ["Project material requests with approval workflow", "Facilities material requests with approval workflow"],
    ["pm-material-requisition", "fm-material-requisition"]
  ]
);

// 7. FMMaterialRequisitionForm.jsx
adapt(
  "client/src/pages/modules/project-management/material-requisition/MaterialRequisitionForm.jsx",
  "client/src/pages/modules/facilities/material-requisition/FMMaterialRequisitionForm.jsx",
  [
    ["/projects/material-requisitions", "/facilities/material-requisitions"],
    ["/project-management/material-requisitions", "/facilities/material-requisitions"],
    ["/projects/projects", "/facilities/properties"],
    ["export default function MaterialRequisitionForm()", "export default function FMMaterialRequisitionForm()"],
    ["projectId", "propertyId"],
    ["project_id", "property_id"],
    ["project_name", "property_name"],
    ["setProjects", "setProperties"],
    ["projects", "properties"],
    ["Project", "Property"],
    ["Material Requisition", "FM Material Requisition"],
    ["Request materials for your project", "Request materials for your facilities operations"],
    ["pm-mr-item-search", "fm-mr-item-search"]
  ]
);

// 8. FMMaterialReceiptList.jsx
adapt(
  "client/src/pages/modules/project-management/material-receipt/MaterialReceiptList.jsx",
  "client/src/pages/modules/facilities/material-receipt/FMMaterialReceiptList.jsx",
  [
    ["/projects/material-receipts", "/facilities/material-receipts"],
    ["/projects/issue-to-requirement/pm", "/facilities/issue-to-requirement/fm"],
    ["/project-management/material-receipts", "/facilities/material-receipts"],
    ["export default function MaterialReceiptList()", "export default function FMMaterialReceiptList()"],
    ["Materials Receipt", "FM Materials Receipt"],
    ["Project Management department", "Facilities Management department"],
    ["(iss.department_name || \"\").toLowerCase().includes(\"project\")", "(iss.department_name || \"\").toLowerCase().includes(\"facilit\")"]
  ]
);

// 9. FMMaterialReceiptForm.jsx
adapt(
  "client/src/pages/modules/project-management/material-receipt/MaterialReceiptForm.jsx",
  "client/src/pages/modules/facilities/material-receipt/FMMaterialReceiptForm.jsx",
  [
    ["/projects/material-receipts", "/facilities/material-receipts"],
    ["/projects/issue-to-requirement/pm", "/facilities/issue-to-requirement/fm"],
    ["/project-management/material-receipts", "/facilities/material-receipts"],
    ["export default function MaterialReceiptForm()", "export default function FMMaterialReceiptForm()"],
    ["Materials Receipt", "FM Materials Receipt"],
    ["(d.name || \"\").toLowerCase().includes(\"project\")", "(d.name || \"\").toLowerCase().includes(\"facilit\")"]
  ]
);

// 10. FMMaterialUtilizationList.jsx
adapt(
  "client/src/pages/modules/project-management/material-utilization/MaterialUtilizationList.jsx",
  "client/src/pages/modules/facilities/material-utilization/FMMaterialUtilizationList.jsx",
  [
    ["/projects/material-utilizations", "/facilities/material-utilizations"],
    ["/project-management/material-utilizations", "/facilities/material-utilizations"],
    ["export default function MaterialUtilizationList()", "export default function FMMaterialUtilizationList()"],
    ["project_name", "property_name"],
    ["Project", "Property"],
    ["Material Utilization", "FM Material Utilization"],
    ["Track material consumption against projects and tasks", "Track material consumption against properties and FM tasks"]
  ]
);

// 11. FMMaterialUtilizationForm.jsx
adapt(
  "client/src/pages/modules/project-management/material-utilization/MaterialUtilizationForm.jsx",
  "client/src/pages/modules/facilities/material-utilization/FMMaterialUtilizationForm.jsx",
  [
    ["/projects/material-utilizations", "/facilities/material-utilizations"],
    ["/project-management/material-utilizations", "/facilities/material-utilizations"],
    ["/projects/projects", "/facilities/properties"],
    ["/projects/tasks", "/facilities/tasks"],
    ["export default function MaterialUtilizationForm()", "export default function FMMaterialUtilizationForm()"],
    ["projectId", "propertyId"],
    ["project_id", "property_id"],
    ["project_name", "property_name"],
    ["setProjects", "setProperties"],
    ["projects", "properties"],
    ["Project", "Property"],
    ["Material Utilization", "FM Material Utilization"],
    ["Record material consumption against project tasks", "Record material consumption against facility properties and tasks"],
    ["onProjectChange", "onPropertyChange"],
    ["pm-util-item-search", "fm-util-item-search"]
  ]
);
console.log("All 11 FM files generated successfully.");

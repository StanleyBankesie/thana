/**
 * @fileoverview Employee Profile page component.
 * Displays detailed information about a specific employee using a tabbed interface.
 */

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import PageHeader from "../../../hr/components/PageHeader.jsx";
import TabsComponent from "../../../hr/components/TabsComponent.jsx";
import FileUploadComponent from "../../../hr/components/FileUploadComponent.jsx";
import { hrService } from "../../../hr/services/hrService.js";

/**
 * EmployeeProfile component
 * Fetches and displays an employee's personal info, job info, salary, and documents.
 * 
 * @returns {JSX.Element} The detailed employee profile page.
 */
export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = React.useState(null);
  const [tab, setTab] = React.useState("personal");
  const [docs, setDocs] = React.useState([]);

  React.useEffect(() => {
    let mounted = true;
    /**
     * Loads the employee data from the server.
     */
    async function load() {
      try {
        const res = await hrService.getEmployee(id);
        if (mounted) {
          setItem(res?.data?.item || null);
          setDocs(res?.data?.documents || []);
        }
      } catch {
        toast.error("Failed to load employee");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const tabs = [
    {
      value: "personal",
      label: "Personal Info",
      content: (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm">Name</div>
            <div className="font-medium">{item?.full_name}</div>
          </div>
          <div>
            <div className="text-sm">Email</div>
            <div className="font-medium">{item?.email || "-"}</div>
          </div>
        </div>
      ),
    },
    {
      value: "job",
      label: "Job Info",
      content: (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm">Department</div>
            <div className="font-medium">{item?.dept_name || "-"}</div>
          </div>
          <div>
            <div className="text-sm">Position</div>
            <div className="font-medium">{item?.pos_name || "-"}</div>
          </div>
        </div>
      ),
    },
    {
      value: "salary",
      label: "Salary Info",
      content: (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm">Base Salary</div>
            <div className="font-medium">{item?.base_salary || 0}</div>
          </div>
        </div>
      ),
    },
    {
      value: "documents",
      label: "Documents",
      content: (
        <div>
          <FileUploadComponent
            onUpload={(file) => {
              toast.info("Upload not implemented");
            }}
          />
          <ul className="mt-3 text-sm">
            {docs.map((d) => (
              <li key={d.id}>
                {d.doc_name} • {d.doc_type}
              </li>
            ))}
            {!docs.length ? <li>No documents</li> : null}
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4">
      <PageHeader
        title={`Employee: ${item?.full_name || ""}`}
        onBack={() => navigate("/hr/employees")}
        backLabel="Back"
      />
      <TabsComponent tabs={tabs} value={tab} onChange={setTab} />
    </div>
  );
}

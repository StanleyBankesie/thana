import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  UserCheck,
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  Sparkles,
  Edit2,
  Trash2,
  Phone,
  Mail,
  UserPlus,
  RefreshCw,
  ArrowLeft,
  ClipboardList,
  CheckSquare,
  Eye,
  ListFilter,
  DoorOpen,
  MapPin,
  Layers,
  Wrench,
  X,
  Loader2
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import PhoneInput from "../../../components/PhoneInput.jsx";

const CATEGORIES = [
  { value: "JANITORIAL", label: "Janitorial & Cleaning", icon: "🧹", color: "blue" },
  { value: "SECURITY_PATROL", label: "Security Patrol", icon: "🛡️", color: "purple" },
  { value: "PEST_CONTROL", label: "Pest Control", icon: "🐜", color: "amber" },
  { value: "WASTE_MANAGEMENT", label: "Waste Management", icon: "🗑️", color: "emerald" },
  { value: "LANDSCAPING", label: "Landscaping & Grounds", icon: "🌿", color: "green" },
  { value: "CONCIERGE_FRONTDESK", label: "Concierge & Front Desk", icon: "🛎️", color: "cyan" },
  { value: "GENERAL_FACILITIES", label: "General Site Operations", icon: "🏢", color: "slate" },
];

const CHECKLIST_SERVICE_LINES = [
  { value: "JANITORIAL_CLEANING", label: "Janitorial & Deep Cleaning", icon: "🧹" },
  { value: "SECURITY_PATROL", label: "Security & Guard Post Patrol", icon: "🛡️" },
  { value: "HVAC_AIR_CONDITIONING", label: "HVAC & Air Conditioning", icon: "❄️" },
  { value: "ELECTRICAL_POWER", label: "Electrical & Substation Safety", icon: "⚡" },
  { value: "PLUMBING_WATER", label: "Plumbing & Water Tanks", icon: "🚰" },
  { value: "FIRE_SAFETY_EQUIPMENT", label: "Fire Safety & Extinguishers", icon: "🧯" },
  { value: "ELEVATOR_LIFT", label: "Lifts & Escalators", icon: "🛗" },
  { value: "PEST_CONTROL", label: "Pest & Rodent Inspection", icon: "🐜" },
  { value: "WASTE_MANAGEMENT", label: "Waste Disposal & Recycling", icon: "🗑️" },
  { value: "FACADE_STRUCTURAL", label: "Building Structural & Facade", icon: "🏢" },
];

export default function FacilitiesSetupPage() {
  const [activeTab, setActiveTab] = useState("personnel"); // 'shifts', 'supervisors', 'personnel', 'checklists'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Setup Data
  const [shifts, setShifts] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [hrEmployees, setHrEmployees] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterServiceLine, setFilterServiceLine] = useState("ALL");

  // Checklist Modals & Form
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [checklistForm, setChecklistForm] = useState({
    template_name: "",
    template_code: "",
    service_line: "",
    description: "",
    items: [],
  });

  // Modals
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    code: "",
    start_time: "",
    end_time: "",
    description: "",
    is_active: true,
  });

  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [supervisorForm, setSupervisorForm] = useState({
    employee_id: "",
    name: "",
    employee_code: "",
    phone: "",
    email: "",
    shift_id: "",
    shift_name: "",
    department: "",
    notes: "",
    is_active: true,
  });

  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState(null);
  const [personnelForm, setPersonnelForm] = useState({
    employee_id: "",
    name: "",
    employee_code: "",
    category: "",
    phone: "",
    email: "",
    shift_id: "",
    shift_name: "",
    supervisor_id: "",
    supervisor_name: "",
    notes: "",
    is_active: true,
  });

  // Contractor & Service Vendors State (reusing Maintenance Setup logic)
  const [contractors, setContractors] = useState([]);
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [editingContractor, setEditingContractor] = useState(null);
  const [contractorForm, setContractorForm] = useState({
    supplier_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    tax_id: "",
    supplier_type: "",
  });

  // Rooms & Spaces State (Space and Occupancy configuration)
  const [spaces, setSpaces] = useState([]);
  const [properties, setProperties] = useState([]);
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [spaceForm, setSpaceForm] = useState({
    space_name: "",
    space_code: "",
    property_id: "",
    space_type: "",
    floor_zone: "",
    capacity: "",
    area_sqm: "",
    is_active: true,
  });

  // Service Categories State
  const [serviceCategories, setServiceCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    category_name: "",
    category_code: "",
    description: "",
    is_active: true,
  });

  // Clients State (Service Clients / Customer Organizations)
  const [clients, setClients] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({
    customer_name: "",
    customer_code: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "Ghana",
    payment_terms: "",
    customer_type: "LOCAL",
    is_active: 1,
  });

  useEffect(() => {
    loadAllSetupData();
  }, []);

  const loadAllSetupData = async () => {
    try {
      setLoading(true);
      const [overviewRes, hrRes, checklistRes, contractorRes, spaceRes, propRes, catRes, clientRes] = await Promise.all([
        api.get("/facilities/setup/overview").catch(() => ({ data: { data: {} } })),
        api.get("/facilities/setup/hr-employees").catch(() => ({ data: { data: [] } })),
        api.get("/facilities/checklists/templates").catch(() => ({ data: { data: [] } })),
        api.get("/purchase/suppliers?contractor=Y").catch(() => ({ data: { items: [] } })),
        api.get("/facilities/spaces").catch(() => ({ data: { data: [] } })),
        api.get("/facilities/properties").catch(() => ({ data: { data: [] } })),
        api.get("/facilities/setup/categories").catch(() => ({ data: { data: [] } })),
        api.get("/sales/customers").catch(() => ({ data: [] })),
      ]);

      const data = overviewRes.data?.data || {};
      setShifts(data.shifts || []);
      setSupervisors(data.supervisors || []);
      setPersonnel(data.personnel || []);
      setHrEmployees(hrRes.data?.data || []);
      setChecklistTemplates(checklistRes.data?.data || []);
      setContractors(contractorRes.data?.data?.items || contractorRes.data?.items || []);
      setSpaces(spaceRes.data?.data || []);
      setProperties(propRes.data?.data || []);
      setServiceCategories(catRes.data?.data || data.categories || []);
      const cList = Array.isArray(clientRes.data)
        ? clientRes.data
        : clientRes.data?.data || clientRes.data?.items || [];
      setClients(cList);
    } catch (err) {
      toast.error("Failed to load operations setup data");
    } finally {
      setLoading(false);
    }
  };

  // --- CHECKLIST TEMPLATE HANDLERS ---
  const handleOpenChecklistModal = (tpl = null) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setChecklistForm({
        template_name: tpl.template_name || "",
        template_code: tpl.template_code || "",
        service_line: tpl.service_line || "JANITORIAL_CLEANING",
        description: tpl.description || "",
        items: Array.isArray(tpl.items) && tpl.items.length > 0
          ? tpl.items.map((it) => ({
              item_text: it.item_text,
              field_type: it.field_type || "PASS_FAIL",
              min_reading: it.min_reading ?? "",
              max_reading: it.max_reading ?? "",
              unit_of_measure: it.unit_of_measure || "",
              is_critical: Boolean(it.is_critical),
            }))
          : [
              { item_text: "Visual inspection for cleanliness, damage and safety", field_type: "PASS_FAIL", is_critical: false },
            ],
      });
    } else {
      setEditingTemplate(null);
      setChecklistForm({
        template_name: "",
        template_code: "",
        service_line: "JANITORIAL_CLEANING",
        description: "",
        items: [
          { item_text: "Visual inspection for cleanliness, damage and safety", field_type: "PASS_FAIL", is_critical: false },
          { item_text: "Verify equipment operation and physical condition", field_type: "PASS_FAIL", is_critical: false },
        ],
      });
    }
    setShowChecklistModal(true);
  };

  const handleAddChecklistItem = () => {
    setChecklistForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { item_text: "", field_type: "PASS_FAIL", min_reading: "", max_reading: "", unit_of_measure: "", is_critical: false },
      ],
    }));
  };

  const handleRemoveChecklistItem = (idx) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateChecklistItem = (idx, field, value) => {
    setChecklistForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[idx] = { ...nextItems[idx], [field]: value };
      return { ...prev, items: nextItems };
    });
  };

  const handleSaveChecklist = async (e) => {
    e.preventDefault();
    if (!checklistForm.template_name.trim()) {
      toast.warn("Template name is required");
      return;
    }
    if (checklistForm.items.length === 0 || !checklistForm.items.some((i) => i.item_text.trim())) {
      toast.warn("Please add at least one criteria item with text");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...checklistForm,
        items: checklistForm.items.filter((i) => i.item_text.trim()),
      };
      if (editingTemplate) {
        await api.put(`/facilities/checklists/templates/${editingTemplate.id}`, payload);
        toast.success("Checklist template updated successfully");
      } else {
        await api.post("/facilities/checklists/templates", payload);
        toast.success("Checklist template created successfully");
      }
      setShowChecklistModal(false);
      const res = await api.get("/facilities/checklists/templates");
      setChecklistTemplates(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save checklist template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChecklist = async (id) => {
    if (!window.confirm("Are you sure you want to delete this inspection checklist template?")) return;
    try {
      await api.delete(`/facilities/checklists/templates/${id}`);
      toast.success("Checklist template deleted");
      setChecklistTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error("Failed to delete checklist template");
    }
  };

  // --- SHIFTS HANDLERS ---
  const handleOpenShiftModal = (shift = null) => {
    if (shift) {
      setEditingShift(shift);
      setShiftForm({
        name: shift.name,
        code: shift.code,
        start_time: shift.start_time?.slice(0, 5) || "",
        end_time: shift.end_time?.slice(0, 5) || "",
        description: shift.description || "",
        is_active: !!shift.is_active,
      });
    } else {
      setEditingShift(null);
      setShiftForm({
        name: "",
        code: "",
        start_time: "",
        end_time: "",
        description: "",
        is_active: true,
      });
    }
    setShowShiftModal(true);
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.name || !shiftForm.start_time || !shiftForm.end_time) {
      toast.warn("Shift name, start time, and end time are required");
      return;
    }
    try {
      setSaving(true);
      if (editingShift) {
        await api.put(`/facilities/setup/shifts/${editingShift.id}`, shiftForm);
        toast.success("Shift updated successfully");
      } else {
        await api.post("/facilities/setup/shifts", shiftForm);
        toast.success("Shift created successfully");
      }
      setShowShiftModal(false);
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (id) => {
    if (!window.confirm("Are you sure you want to delete this shift?")) return;
    try {
      await api.delete(`/facilities/setup/shifts/${id}`);
      toast.success("Shift deleted");
      loadAllSetupData();
    } catch (err) {
      toast.error("Failed to delete shift");
    }
  };

  // --- SUPERVISORS HANDLERS ---
  const handleSelectHREmployeeForSupervisor = (empId) => {
    if (!empId) {
      setSupervisorForm({
        ...supervisorForm,
        employee_id: "",
      });
      return;
    }
    const emp = hrEmployees.find((e) => String(e.id) === String(empId));
    if (emp) {
      setSupervisorForm({
        ...supervisorForm,
        employee_id: emp.id,
        name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
        employee_code: emp.emp_code || "",
        phone: emp.phone || supervisorForm.phone,
        email: emp.email || supervisorForm.email,
      });
    }
  };

  const handleOpenSupervisorModal = (sup = null) => {
    if (sup) {
      setEditingSupervisor(sup);
      setSupervisorForm({
        employee_id: sup.employee_id || "",
        name: sup.name,
        employee_code: sup.employee_code || "",
        phone: sup.phone || "",
        email: sup.email || "",
        shift_id: sup.shift_id || "",
        shift_name: sup.shift_name || "",
        department: sup.department || "",
        notes: sup.notes || "",
        is_active: !!sup.is_active,
      });
    } else {
      setEditingSupervisor(null);
      setSupervisorForm({
        employee_id: "",
        name: "",
        employee_code: "",
        phone: "",
        email: "",
        shift_id: "",
        shift_name: "",
        department: "",
        notes: "",
        is_active: true,
      });
    }
    setShowSupervisorModal(true);
  };

  const handleSaveSupervisor = async (e) => {
    e.preventDefault();
    if (!supervisorForm.name) {
      toast.warn("Supervisor name is required");
      return;
    }
    try {
      setSaving(true);
      const selectedShift = shifts.find((s) => String(s.id) === String(supervisorForm.shift_id));
      const payload = {
        ...supervisorForm,
        shift_name: selectedShift ? selectedShift.name : supervisorForm.shift_name,
      };

      if (editingSupervisor) {
        await api.put(`/facilities/setup/supervisors/${editingSupervisor.id}`, payload);
        toast.success("Supervisor updated successfully");
      } else {
        await api.post("/facilities/setup/supervisors", payload);
        toast.success("Supervisor linked and saved successfully");
      }
      setShowSupervisorModal(false);
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save supervisor");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupervisor = async (id) => {
    if (!window.confirm("Are you sure you want to remove this supervisor?")) return;
    try {
      await api.delete(`/facilities/setup/supervisors/${id}`);
      toast.success("Supervisor removed");
      loadAllSetupData();
    } catch (err) {
      toast.error("Failed to delete supervisor");
    }
  };

  // --- PERSONNEL HANDLERS ---
  const handleSelectHREmployeeForPersonnel = (empId) => {
    if (!empId) {
      setPersonnelForm({
        ...personnelForm,
        employee_id: "",
      });
      return;
    }
    const emp = hrEmployees.find((e) => String(e.id) === String(empId));
    if (emp) {
      setPersonnelForm({
        ...personnelForm,
        employee_id: emp.id,
        name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
        employee_code: emp.emp_code || "",
        phone: emp.phone || personnelForm.phone,
        email: emp.email || personnelForm.email,
      });
    }
  };

  const handleOpenPersonnelModal = (per = null) => {
    if (per) {
      setEditingPersonnel(per);
      setPersonnelForm({
        employee_id: per.employee_id || "",
        name: per.name,
        employee_code: per.employee_code || "",
        category: per.category || "",
        phone: per.phone || "",
        email: per.email || "",
        shift_id: per.shift_id || "",
        shift_name: per.shift_name || "",
        supervisor_id: per.supervisor_id || "",
        supervisor_name: per.supervisor_name || "",
        notes: per.notes || "",
        is_active: !!per.is_active,
      });
    } else {
      setEditingPersonnel(null);
      setPersonnelForm({
        employee_id: "",
        name: "",
        employee_code: "",
        category: "",
        phone: "",
        email: "",
        shift_id: "",
        shift_name: "",
        supervisor_id: "",
        supervisor_name: "",
        notes: "",
        is_active: true,
      });
    }
    setShowPersonnelModal(true);
  };

  const handleSavePersonnel = async (e) => {
    e.preventDefault();
    if (!personnelForm.name) {
      toast.warn("Personnel name is required");
      return;
    }
    try {
      setSaving(true);
      const selectedShift = shifts.find((s) => String(s.id) === String(personnelForm.shift_id));
      const selectedSup = supervisors.find((s) => String(s.id) === String(personnelForm.supervisor_id));

      const payload = {
        ...personnelForm,
        shift_name: selectedShift ? selectedShift.name : personnelForm.shift_name,
        supervisor_name: selectedSup ? selectedSup.name : personnelForm.supervisor_name,
      };

      if (editingPersonnel) {
        await api.put(`/facilities/setup/personnel/${editingPersonnel.id}`, payload);
        toast.success("Personnel updated successfully");
      } else {
        await api.post("/facilities/setup/personnel", payload);
        toast.success("Personnel linked & registered successfully");
      }
      setShowPersonnelModal(false);
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save personnel");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePersonnel = async (id) => {
    if (!window.confirm("Are you sure you want to remove this personnel?")) return;
    try {
      await api.delete(`/facilities/setup/personnel/${id}`);
      toast.success("Personnel removed");
      loadAllSetupData();
    } catch (err) {
      toast.error("Failed to delete personnel");
    }
  };

  // --- CONTRACTOR & VENDOR HANDLERS (copied from Maintenance Setup logic) ---
  const handleOpenContractorModal = (p = null) => {
    if (p) {
      setEditingContractor(p);
      setContractorForm({
        supplier_name: p.supplier_name || p.name || "",
        contact_person: p.contact_person || "",
        email: p.email || "",
        phone: p.phone || "",
        address: p.address || "",
        tax_id: p.tax_id || "",
        supplier_type: p.supplier_type || "",
      });
    } else {
      setEditingContractor(null);
      setContractorForm({
        supplier_name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        tax_id: "",
        supplier_type: "",
      });
    }
    setShowContractorModal(true);
  };

  const handleSaveContractor = async (e) => {
    e.preventDefault();
    if (!contractorForm.supplier_name.trim()) {
      toast.warn("Contractor / Supplier name is required");
      return;
    }
    try {
      setSaving(true);
      const payload = { ...contractorForm, service_contractor: true };
      if (editingContractor) {
        await api.put(`/purchase/suppliers/${editingContractor.id}`, payload);
        toast.success("Contractor / Service Vendor updated successfully");
      } else {
        await api.post("/purchase/suppliers", payload);
        toast.success("Contractor / Service Vendor registered successfully");
      }
      setShowContractorModal(false);
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save contractor");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContractor = async (id) => {
    if (!window.confirm("Are you sure you want to remove this contractor?")) return;
    try {
      await api.delete(`/purchase/suppliers/${id}`);
      toast.success("Contractor removed successfully");
      loadAllSetupData();
    } catch (err) {
      toast.error("Failed to delete contractor");
    }
  };

  // --- ROOMS & SPACES HANDLERS ---
  const handleOpenSpaceModal = (sp = null) => {
    if (sp) {
      setEditingSpace(sp);
      setSpaceForm({
        space_name: sp.space_name || "",
        space_code: sp.space_code || "",
        property_id: sp.property_id || "",
        space_type: sp.space_type || "",
        floor_zone: sp.floor_zone || "",
        capacity: sp.capacity || "",
        area_sqm: sp.area_sqm || "",
        is_active: sp.is_active !== undefined ? Boolean(sp.is_active) : true,
      });
    } else {
      setEditingSpace(null);
      setSpaceForm({
        space_name: "",
        space_code: "",
        property_id: "",
        space_type: "",
        floor_zone: "",
        capacity: "",
        area_sqm: "",
        is_active: true,
      });
    }
    setShowSpaceModal(true);
  };

  const handleSaveSpace = async (e) => {
    e.preventDefault();
    if (!spaceForm.space_name.trim()) {
      toast.warn("Room / Space Name is required");
      return;
    }
    try {
      setSaving(true);
      if (editingSpace) {
        await api.put(`/facilities/spaces/${editingSpace.id}`, spaceForm);
        toast.success("Room / Space updated successfully");
      } else {
        await api.post("/facilities/spaces", spaceForm);
        toast.success("Room / Space configured successfully");
      }
      setShowSpaceModal(false);
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save room / space");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpace = async (id) => {
    if (!window.confirm("Are you sure you want to delete this room/space?")) return;
    try {
      await api.delete(`/facilities/spaces/${id}`);
      toast.success("Room / Space deleted successfully");
      loadAllSetupData();
    } catch (err) {
      toast.error("Failed to delete space");
    }
  };

  // --- SERVICE CATEGORIES HANDLERS ---
  const handleOpenCategoryModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({
        category_name: cat.category_name || "",
        category_code: cat.category_code || "",
        description: cat.description || "",
        is_active: cat.is_active !== undefined ? Boolean(cat.is_active) : true,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        category_name: "",
        category_code: "",
        description: "",
        is_active: true,
      });
    }
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.category_name.trim()) {
      toast.warn("Category name is required");
      return;
    }
    try {
      setSaving(true);
      if (editingCategory) {
        await api.put(`/facilities/setup/categories/${editingCategory.id}`, categoryForm);
        toast.success("Service category updated successfully");
      } else {
        await api.post("/facilities/setup/categories", categoryForm);
        toast.success("Service category configured successfully");
      }
      setShowCategoryModal(false);
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Are you sure you want to delete this service category?")) return;
    try {
      await api.delete(`/facilities/setup/categories/${id}`);
      toast.success("Service category deleted");
      loadAllSetupData();
    } catch (err) {
      toast.error("Failed to delete category");
    }
  };

  // --- CLIENTS HANDLERS (Service Clients / Customer Organizations) ---
  const handleOpenClientModal = async (c = null) => {
    if (c) {
      setEditingClient(c);
      setClientForm({
        customer_name: c.customer_name || "",
        customer_code: c.customer_code || "",
        contact_person: c.contact_person || "",
        email: c.email || "",
        phone: c.phone || "",
        address: c.address || "",
        city: c.city || "",
        state: c.state || "",
        country: c.country || "Ghana",
        payment_terms: c.payment_terms || "",
        customer_type: c.customer_type || "LOCAL",
        is_active: c.is_active !== undefined ? (c.is_active ? 1 : 0) : 1,
      });
    } else {
      setEditingClient(null);
      let nextCode = "";
      try {
        const response = await api.get("/sales/customers/next-code");
        if (response.data?.code) nextCode = response.data.code;
      } catch (err) {}
      setClientForm({
        customer_name: "",
        customer_code: nextCode,
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "Ghana",
        payment_terms: "",
        customer_type: "LOCAL",
        is_active: 1,
      });
    }
    setShowClientModal(true);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!clientForm.customer_name.trim()) {
      toast.warn("Client name is required");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...clientForm,
        service_customer: "Y",
      };
      if (editingClient) {
        await api.put(`/sales/customers/${editingClient.id}`, payload);
        toast.success("Client updated successfully");
      } else {
        await api.post("/sales/customers", payload);
        toast.success("Client registered successfully");
      }
      setShowClientModal(false);
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save client");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    try {
      await api.delete(`/sales/customers/${id}`);
      toast.success("Client deleted successfully");
      loadAllSetupData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete client");
    }
  };

  // Filtered lists
  const filteredClients = clients.filter((c) => {
    return (
      searchTerm === "" ||
      c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  const filteredPersonnel = personnel.filter((p) => {
    const matchesSearch =
      searchTerm === "" ||
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supervisor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "ALL" || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredSupervisors = supervisors.filter((s) => {
    return (
      searchTerm === "" ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredContractors = contractors.filter((c) => {
    return (
      searchTerm === "" ||
      c.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredSpaces = spaces.filter((sp) => {
    return (
      searchTerm === "" ||
      sp.space_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sp.space_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sp.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sp.floor_zone?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredCategories = serviceCategories.filter((c) => {
    return (
      searchTerm === "" ||
      c.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/facilities"
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to Facilities
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              ⚙️
            </span>
            Facilities Operations Setup
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure operational shifts, designated supervisors, and service crew linked directly to HR employees.
            Changes automatically propagate into Soft Facilities Services and inspection checklists.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/facilities/soft-services"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={14} className="text-emerald-500" />
            Go to Soft Services Form
          </Link>
          <button
            onClick={loadAllSetupData}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab("clients")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "clients"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Building2 size={15} /> Clients ({clients.length})
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "categories"
              ? "border-teal-500 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Layers size={15} /> Service Categories ({serviceCategories.length})
        </button>

        <button
          onClick={() => setActiveTab("personnel")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "personnel"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users size={15} /> Service Personnel ({personnel.length})
        </button>

        <button
          onClick={() => setActiveTab("supervisors")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "supervisors"
              ? "border-purple-500 text-purple-600 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <UserCheck size={15} /> Supervisors ({supervisors.length})
        </button>

        <button
          onClick={() => setActiveTab("shifts")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "shifts"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Clock size={15} /> Shifts & Schedules ({shifts.length})
        </button>

        <button
          onClick={() => setActiveTab("checklists")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "checklists"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <ClipboardList size={15} /> Inspection Checklists ({checklistTemplates.length})
        </button>

        <button
          onClick={() => setActiveTab("contractors")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "contractors"
              ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Building2 size={15} /> Contractors & Vendors ({contractors.length})
        </button>

        <button
          onClick={() => setActiveTab("spaces")}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "spaces"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <DoorOpen size={15} /> Rooms & Spaces ({spaces.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB: CLIENTS */}
      {/* ========================================================================= */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search clients by name, code, contact or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
              <span className="text-xs text-slate-400">
                Showing {filteredClients.length} registered service clients
              </span>
            </div>

            <button
              onClick={() => handleOpenClientModal()}
              className="btn btn-primary inline-flex items-center gap-2 text-xs py-2 px-3.5 shadow-sm active:scale-95 whitespace-nowrap bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Plus size={14} /> Add Client
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Client Code</th>
                    <th className="px-4 py-3">Client / Organization Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Contact Person</th>
                    <th className="px-4 py-3">Phone & Email</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredClients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {c.customer_code || `#${c.id}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {c.customer_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {c.customer_type || "LOCAL"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                        {c.contact_person || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <div>{c.phone || "-"}</div>
                        {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {[c.city, c.state, c.country].filter(Boolean).join(", ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            Number(c.is_active) === 1 || c.is_active === true
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {Number(c.is_active) === 1 || c.is_active === true ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenClientModal(c)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors"
                            title="Edit Client"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(c.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete Client"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredClients.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-12 text-slate-400 text-xs italic">
                        No service clients configured. Click &apos;+ Add Client&apos; above to register clients for FM service agreements.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: SERVICES / SERVICE CATEGORIES */}
      {/* ========================================================================= */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search service categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
              <span className="text-xs text-slate-400">
                Showing {filteredCategories.length} configured service categories
              </span>
            </div>

            <button
              onClick={() => handleOpenCategoryModal()}
              className="btn btn-primary inline-flex items-center gap-2 text-xs py-2 px-3.5 shadow-sm active:scale-95 whitespace-nowrap bg-teal-600 hover:bg-teal-500 text-white"
            >
              <Plus size={14} /> Add Service Category
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Category Code</th>
                    <th className="px-4 py-3">Category Name</th>
                    <th className="px-4 py-3">Operational Scope & Description</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCategories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {c.category_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {c.category_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-md">
                        {c.description || "Routine facilities operational scope"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.is_active !== 0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {c.is_active !== 0 ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenCategoryModal(c)}
                            className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg transition-colors"
                            title="Edit Category"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-12 text-slate-400 text-xs italic">
                        No service categories found. Click &apos;+ Add Service Category&apos; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "personnel" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search personnel by name, code or supervisor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenPersonnelModal()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <UserPlus size={15} />
              + Add Service Personnel
            </button>
          </div>

          {/* Personnel Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-5">Personnel Name & HR Code</th>
                    <th className="p-3.5">Service Category</th>
                    <th className="p-3.5">Assigned Shift</th>
                    <th className="p-3.5">Supervisor</th>
                    <th className="p-3.5">Contact</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredPersonnel.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        No service personnel found. Click "+ Add Service Personnel" to configure your crew.
                      </td>
                    </tr>
                  ) : (
                    filteredPersonnel.map((per) => {
                      const cat = CATEGORIES.find((c) => c.value === per.category) || CATEGORIES[0];
                      return (
                        <tr key={per.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 pl-5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs uppercase">
                                {per.name.slice(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">{per.name}</span>
                                {per.employee_code ? (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    HR: {per.employee_code}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Direct Contractor</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              <span>{cat.icon}</span>
                              {cat.label}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Clock size={12} className="text-blue-500" />
                              {per.shift_name || "Any Shift"}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <UserCheck size={12} className="text-purple-500" />
                              {per.supervisor_name || "Unassigned"}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-500">
                            {per.phone && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Phone size={11} className="text-slate-400" /> {per.phone}
                              </div>
                            )}
                            {per.email && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Mail size={11} /> {per.email}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            {per.is_active ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Inactive
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPersonnelModal(per)}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Edit Personnel"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeletePersonnel(per.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      

      {/* ========================================================================= */}
      {/* TAB 2: SUPERVISORS */}
      {/* ========================================================================= */}
      {activeTab === "supervisors" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search supervisors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>

            <button
              onClick={() => handleOpenSupervisorModal()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <UserPlus size={15} />
              + Add / Link Supervisor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSupervisors.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                No supervisors configured yet. Click "+ Add / Link Supervisor" to set up operational leadership.
              </div>
            ) : (
              filteredSupervisors.map((sup) => (
                <div
                  key={sup.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3 relative hover:border-purple-300 dark:hover:border-purple-800 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm">
                        {sup.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{sup.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {sup.employee_code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              HR: {sup.employee_code}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">{sup.department || "Facilities"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenSupervisorModal(sup)}
                        className="p-1 text-slate-400 hover:text-purple-600 rounded"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteSupervisor(sup.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Assigned Shift:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Clock size={12} className="text-blue-500" />
                        {sup.shift_name || "All Shifts"}
                      </span>
                    </div>

                    {sup.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Phone:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{sup.phone}</span>
                      </div>
                    )}

                    {sup.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Email:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{sup.email}</span>
                      </div>
                    )}
                  </div>

                  {sup.notes && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                      "{sup.notes}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      

      {/* ========================================================================= */}
      {/* TAB 3: OPERATIONAL SHIFTS */}
      {/* ========================================================================= */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-medium">
              Configure daily duty rosters and active inspection timeframes for soft facilities teams.
            </span>
            <button
              onClick={() => handleOpenShiftModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus size={15} />
              + Add New Shift
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3 relative hover:border-blue-300 dark:hover:border-blue-800 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                      {shift.code}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-1">{shift.name}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenShiftModal(shift)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteShift(shift.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block uppercase">Start</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">
                      {shift.start_time?.slice(0, 5)}
                    </span>
                  </div>
                  <span className="text-slate-400 font-bold">➔</span>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block uppercase">End</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">
                      {shift.end_time?.slice(0, 5)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-2 min-h-[32px]">
                  {shift.description || "Routine facilities operational shift."}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Status</span>
                  {shift.is_active ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">Inactive</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INSPECTION CHECKLIST TEMPLATES */}
      {/* ========================================================================= */}
      {activeTab === "checklists" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search template name, code, service line..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 dark:text-slate-200 border-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <select
                value={filterServiceLine}
                onChange={(e) => setFilterServiceLine(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 px-3 rounded-xl text-xs font-semibold border-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">All Service Lines</option>
                {CHECKLIST_SERVICE_LINES.map((sl) => (
                  <option key={sl.value} value={sl.value}>
                    {sl.icon} {sl.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenChecklistModal()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
            >
              <Plus size={15} />
              + Create Checklist Template
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Template Code</th>
                    <th className="px-4 py-3">Template Name</th>
                    <th className="px-4 py-3">Service Line</th>
                    <th className="px-4 py-3">Criteria Items</th>
                    <th className="px-4 py-3">Critical Checks</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {checklistTemplates
                    .filter((tpl) => {
                      const matchSearch =
                        !searchTerm ||
                        tpl.template_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        tpl.template_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        tpl.service_line?.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchLine =
                        filterServiceLine === "ALL" || tpl.service_line === filterServiceLine;
                      return matchSearch && matchLine;
                    })
                    .map((tpl) => {
                      const items = Array.isArray(tpl.items) ? tpl.items : [];
                      const criticalCount = items.filter((i) => i.is_critical).length;
                      return (
                        <tr
                          key={tpl.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                            {tpl.template_code || `TPL-${tpl.id}`}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {tpl.template_name}
                            </span>
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {tpl.description || "Digital audit checklist"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[11px] inline-flex items-center gap-1">
                              {CHECKLIST_SERVICE_LINES.find((s) => s.value === tpl.service_line)?.icon || "📋"}{" "}
                              {CHECKLIST_SERVICE_LINES.find((s) => s.value === tpl.service_line)?.label ||
                                tpl.service_line?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {items.length} checks
                          </td>
                          <td className="px-4 py-3">
                            {criticalCount > 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1 text-[11px]">
                                <AlertCircle size={12} /> {criticalCount} Critical
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPreviewTemplate(tpl)}
                                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1"
                                title="Preview Items"
                              >
                                <Eye size={13} /> View
                              </button>
                              <button
                                onClick={() => handleOpenChecklistModal(tpl)}
                                className="px-2.5 py-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg text-xs font-semibold flex items-center gap-1"
                                title="Edit Template"
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteChecklist(tpl.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                                title="Delete Template"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {checklistTemplates.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-400 text-xs">
                        No inspection checklist templates configured yet. Click "+ Create Checklist Template" to build one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      

      {/* ========================================================================= */}
      {/* TAB 5: CONTRACTORS & SERVICE VENDORS */}
      {/* ========================================================================= */}
      {activeTab === "contractors" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search contractors by company name, contact, phone..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-500 font-medium px-2">
                Total: <strong>{filteredContractors.length}</strong> vendors
              </span>
            </div>

            <button
              onClick={() => handleOpenContractorModal()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus size={15} /> Register Service Contractor
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5 min-w-[200px]">Contractor / Company</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Contact Person</th>
                    <th className="p-3.5">Contact Info</th>
                    <th className="p-3.5">Tax ID / TIN</th>
                    <th className="p-3.5">Address</th>
                    <th className="p-3.5 text-right pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredContractors.map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100">
                        {c.supplier_name || c.name}
                        {c.supplier_code && (
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            {c.supplier_code}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {c.supplier_type || "LOCAL"}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                        {c.contact_person || "—"}
                      </td>
                      <td className="p-3.5 space-y-0.5">
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Phone size={12} className="text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Mail size={12} className="text-slate-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {!c.phone && !c.email && <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">{c.tax_id || "—"}</td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 max-w-xs truncate">{c.address || "—"}</td>
                      <td className="p-3.5 text-right pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenContractorModal(c)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                            title="Edit Contractor"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteContractor(c.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete Contractor"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredContractors.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-12 text-slate-400 text-xs italic">
                        No service contractors registered yet. Click &apos;+ Register Service Contractor&apos; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: ROOMS & SPACES */}
      {/* ========================================================================= */}
      {activeTab === "spaces" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search rooms & spaces by name, code, floor, property..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-500 font-medium px-2">
                Total: <strong>{filteredSpaces.length}</strong> spaces
              </span>
            </div>

            <button
              onClick={() => handleOpenSpaceModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus size={15} /> Add Room / Space
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5 min-w-[220px]">Room / Space Name</th>
                    <th className="p-3.5">Code</th>
                    <th className="p-3.5">Property</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Floor / Zone</th>
                    <th className="p-3.5 text-right">Capacity</th>
                    <th className="p-3.5 text-right">Area (m²)</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSpaces.map((sp, idx) => (
                    <tr key={sp.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                          🚪
                        </span>
                        <span>{sp.space_name}</span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">{sp.space_code || "—"}</td>
                      <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                        {sp.property_name || "Portfolio Estate"}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {String(sp.space_type || "MEETING_ROOM").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">{sp.floor_zone || "Main"}</td>
                      <td className="p-3.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {sp.capacity || 0} seats
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                        {sp.area_sqm ? `${sp.area_sqm} m²` : "—"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            sp.is_active !== 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800"
                          }`}
                        >
                          {sp.is_active !== 0 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenSpaceModal(sp)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                            title="Edit Space"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteSpace(sp.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete Space"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSpaces.length === 0 && (
                    <tr>
                      <td colSpan="10" className="text-center py-12 text-slate-400 text-xs italic">
                        No rooms or spaces configured yet. Click &apos;+ Add Room / Space&apos; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {showPersonnelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                {editingPersonnel ? "Edit Service Personnel" : "Register / Link Service Personnel"}
              </h3>
              <button
                onClick={() => setShowPersonnelModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePersonnel} className="p-6 space-y-5 text-xs">
              {/* HR Module Employee Link Helper Banner */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                <label className="block text-emerald-900 dark:text-emerald-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <UserPlus size={15} /> Link Employee from HR Module (Recommended)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={personnelForm.employee_id}
                    onChange={(e) => handleSelectHREmployeeForPersonnel(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Choose from HR Employee Directory --</option>
                    {hrEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.emp_code || `EMP-${emp.id}`})
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center">
                    Selecting an HR employee automatically links their name, code, contact phone, and company records.
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Personnel Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grace Mensah"
                    value={personnelForm.name}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Employee / Staff Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ST0002 or PER-001"
                    value={personnelForm.employee_code}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, employee_code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Service Category</label>
                  <select
                    value={personnelForm.category}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Assigned Operational Shift</label>
                  <select
                    value={personnelForm.shift_id}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, shift_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Any / Flexible Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Direct Supervisor</label>
                  <select
                    value={personnelForm.supervisor_id}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, supervisor_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Select Supervisor...</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.shift_name ? `(${s.shift_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 0244123456"
                    value={personnelForm.phone}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Specialties & Operative Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. High-level window cleaning certified, hazardous chemical handler..."
                    value={personnelForm.notes}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, notes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="pers_active"
                    checked={personnelForm.is_active}
                    onChange={(e) => setPersonnelForm({ ...personnelForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <label htmlFor="pers_active" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Active for task dispatch
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPersonnelModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {saving ? "Saving..." : editingPersonnel ? "Update Personnel" : "Save & Register Personnel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SUPERVISOR */}
      {/* ========================================================================= */}
      {showSupervisorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck size={18} className="text-purple-600" />
                {editingSupervisor ? "Edit Supervisor" : "Link & Assign Supervisor"}
              </h3>
              <button
                onClick={() => setShowSupervisorModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupervisor} className="p-6 space-y-4 text-xs">
              <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <label className="block text-purple-900 dark:text-purple-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <UserPlus size={15} /> Link Employee from HR Module
                </label>
                <select
                  value={supervisorForm.employee_id}
                  onChange={(e) => handleSelectHREmployeeForSupervisor(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Choose from HR Employee Directory --</option>
                  {hrEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.emp_code || `EMP-${emp.id}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Supervisor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. David Osei"
                    value={supervisorForm.name}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Employee Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SUP-001"
                    value={supervisorForm.employee_code}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, employee_code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Assigned Operational Shift</label>
                  <select
                    value={supervisorForm.shift_id}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, shift_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">All Shifts (General FM Lead)</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Department / Division</label>
                  <input
                    type="text"
                    value={supervisorForm.department}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 0244123456"
                    value={supervisorForm.phone}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. supervisor@company.com"
                    value={supervisorForm.email}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Role / Inspection Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Facilities Officer, Health & Safety Auditor..."
                    value={supervisorForm.notes}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, notes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSupervisorModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {saving ? "Saving..." : editingSupervisor ? "Update Supervisor" : "Save Supervisor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SHIFT */}
      {/* ========================================================================= */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                {editingShift ? "Edit Operational Shift" : "Create Operational Shift"}
              </h3>
              <button
                onClick={() => setShowShiftModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Shift Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning Shift"
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Shift Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MORNING"
                    value={shiftForm.code}
                    onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Description / Focus Areas</label>
                  <input
                    type="text"
                    placeholder="e.g. Early morning deep clean, restroom restock, security opening"
                    value={shiftForm.description}
                    onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="shift_active"
                    checked={shiftForm.is_active}
                    onChange={(e) => setShiftForm({ ...shiftForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="shift_active" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Active Shift
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {saving ? "Saving..." : editingShift ? "Update Shift" : "Save Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT INSPECTION CHECKLIST TEMPLATE */}
      {/* ========================================================================= */}
      {showChecklistModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-amber-600" />
                {editingTemplate ? "Edit Inspection Checklist Template" : "Create Inspection Checklist Template"}
              </h3>
              <button
                onClick={() => setShowChecklistModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveChecklist} className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Daily Restroom & Common Area Janitorial Audit"
                    value={checklistForm.template_name}
                    onChange={(e) => setChecklistForm({ ...checklistForm, template_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Template Code</label>
                  <input
                    type="text"
                    placeholder="e.g. TPL-JAN-01"
                    value={checklistForm.template_code}
                    onChange={(e) => setChecklistForm({ ...checklistForm, template_code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Service Line <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={checklistForm.service_line}
                    onChange={(e) => setChecklistForm({ ...checklistForm, service_line: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                  >
                    {CHECKLIST_SERVICE_LINES.map((sl) => (
                      <option key={sl.value} value={sl.value}>
                        {sl.icon} {sl.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Description & Scope</label>
                  <input
                    type="text"
                    placeholder="e.g. Standard morning shift quality verification checklist for operatives"
                    value={checklistForm.description}
                    onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Dynamic Criteria Items Builder */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <CheckSquare size={14} className="text-amber-500" />
                      Inspection Criteria & Checklist Items ({checklistForm.items.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Specify the inspection checks, verification type, and critical pass/fail criteria.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={13} /> Add Check Item
                  </button>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {checklistForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center text-[10px] mt-2 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Inspection check description (e.g. Check water flow, soap dispensers, odor levels)"
                            value={item.item_text}
                            onChange={(e) => handleUpdateChecklistItem(idx, "item_text", e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs text-slate-800 dark:text-slate-200"
                            required
                          />
                        </div>
                        {checklistForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors mt-1"
                            title="Remove check item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7 items-center">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Verification Type</label>
                          <select
                            value={item.field_type}
                            onChange={(e) => handleUpdateChecklistItem(idx, "field_type", e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-200"
                          >
                            <option value="PASS_FAIL">Pass / Fail</option>
                            <option value="NUMERIC_READING">Numeric Reading (Min/Max)</option>
                            <option value="TEXT_NOTE">Text / Observation Note</option>
                            <option value="PHOTO_EVIDENCE">Photo Evidence Only</option>
                          </select>
                        </div>

                        {item.field_type === "NUMERIC_READING" ? (
                          <div className="sm:col-span-2 flex items-center gap-1.5">
                            <input
                              type="number"
                              placeholder="Min"
                              value={item.min_reading ?? ""}
                              onChange={(e) => handleUpdateChecklistItem(idx, "min_reading", e.target.value)}
                              className="w-16 bg-slate-50 dark:bg-slate-800 border rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-200"
                            />
                            <span className="text-slate-400 text-xs">to</span>
                            <input
                              type="number"
                              placeholder="Max"
                              value={item.max_reading ?? ""}
                              onChange={(e) => handleUpdateChecklistItem(idx, "max_reading", e.target.value)}
                              className="w-16 bg-slate-50 dark:bg-slate-800 border rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-200"
                            />
                            <input
                              type="text"
                              placeholder="Unit (V, °C, bar)"
                              value={item.unit_of_measure ?? ""}
                              onChange={(e) => handleUpdateChecklistItem(idx, "unit_of_measure", e.target.value)}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        ) : (
                          <div className="sm:col-span-2 flex items-center gap-2 pt-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={Boolean(item.is_critical)}
                                onChange={(e) => handleUpdateChecklistItem(idx, "is_critical", e.target.checked)}
                                className="w-3.5 h-3.5 text-red-600 rounded"
                              />
                              <span className={item.is_critical ? "text-red-600 dark:text-red-400 font-bold" : ""}>
                                Critical Check (Triggers Corrective Work Order if Failed)
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChecklistModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {saving ? "Saving..." : editingTemplate ? "Update Template" : "Save Checklist Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER / EDIT SERVICE CONTRACTOR */}
      {/* ========================================================================= */}
      {showContractorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} className="text-emerald-600" />
                {editingContractor ? "Edit Service Contractor" : "Register New Service Contractor / Vendor"}
              </h3>
              <button
                onClick={() => setShowContractorModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContractor} className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Contractor / Provider Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Facility Solutions Ltd."
                    value={contractorForm.supplier_name}
                    onChange={(e) => setContractorForm({ ...contractorForm, supplier_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Provider Type
                  </label>
                  <select
                    value={contractorForm.supplier_type}
                    onChange={(e) => setContractorForm({ ...contractorForm, supplier_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  >
                    <option value="LOCAL">Local Contractor</option>
                    <option value="FOREIGN">Foreign / Specialist Contractor</option>
                    <option value="SUBCONTRACTOR">Independent Subcontractor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Mensah (Operations Director)"
                    value={contractorForm.contact_person}
                    onChange={(e) => setContractorForm({ ...contractorForm, contact_person: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Tax Identification / TIN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. C0004928172"
                    value={contractorForm.tax_id}
                    onChange={(e) => setContractorForm({ ...contractorForm, tax_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+233 24 000 0000"
                    value={contractorForm.phone}
                    onChange={(e) => setContractorForm({ ...contractorForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="contractor@example.com"
                    value={contractorForm.email}
                    onChange={(e) => setContractorForm({ ...contractorForm, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Office / Workshop Address
                  </label>
                  <input
                    type="text"
                    placeholder="Plot 42, Spintex Road Industrial Area, Accra"
                    value={contractorForm.address}
                    onChange={(e) => setContractorForm({ ...contractorForm, address: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowContractorModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={14} />
                  {saving ? "Saving..." : editingContractor ? "Update Contractor" : "Register Contractor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT ROOM & SPACE */}
      {/* ========================================================================= */}
      {showSpaceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DoorOpen size={18} className="text-indigo-600" />
                {editingSpace ? "Edit Room / Space" : "Configure New Room or Space"}
              </h3>
              <button
                onClick={() => setShowSpaceModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSpace} className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Room / Space Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Executive Boardroom, Conference Room B, Lab 102"
                    value={spaceForm.space_name}
                    onChange={(e) => setSpaceForm({ ...spaceForm, space_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Space Code / Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BR-301, CR-102"
                    value={spaceForm.space_code}
                    onChange={(e) => setSpaceForm({ ...spaceForm, space_code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Property / Facility
                  </label>
                  <select
                    value={spaceForm.property_id}
                    onChange={(e) => setSpaceForm({ ...spaceForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  >
                    <option value="">-- Portfolio Estate (Global) --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.property_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Space Type
                  </label>
                  <select
                    value={spaceForm.space_type}
                    onChange={(e) => setSpaceForm({ ...spaceForm, space_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  >
                    <option value="MEETING_ROOM">Meeting Room</option>
                    <option value="EXECUTIVE_BOARDROOM">Executive Boardroom</option>
                    <option value="CONFERENCE_HALL">Conference Hall</option>
                    <option value="OFFICE_SUITE">Office Suite</option>
                    <option value="TRAINING_LAB">Training / Innovation Lab</option>
                    <option value="STORAGE_FACILITY">Storage / Utility Facility</option>
                    <option value="COMMON_AREA">Lounge / Common Area</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Floor / Zone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Floor 3, West Wing"
                    value={spaceForm.floor_zone}
                    onChange={(e) => setSpaceForm({ ...spaceForm, floor_zone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Seating Capacity
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="12"
                      value={spaceForm.capacity}
                      onChange={(e) => setSpaceForm({ ...spaceForm, capacity: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Area (m²)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="45"
                      value={spaceForm.area_sqm}
                      onChange={(e) => setSpaceForm({ ...spaceForm, area_sqm: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="space_active"
                    checked={spaceForm.is_active}
                    onChange={(e) => setSpaceForm({ ...spaceForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="space_active" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                    Room / Space is Active and Available for Booking / Allocation
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSpaceModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={14} />
                  {saving ? "Saving..." : editingSpace ? "Update Space" : "Save Space"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: SERVICE CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-teal-600" />
                {editingCategory ? "Edit Service Category" : "Add Service Category"}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Landscaping & Grounds Care"
                  value={categoryForm.category_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCategoryForm((prev) => ({
                      ...prev,
                      category_name: name,
                      ...(!editingCategory && !prev.category_code
                        ? { category_code: name.toUpperCase().replace(/[^A-Z0-9]/g, "_") }
                        : {}),
                    }));
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Category Code (System ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. LANDSCAPING"
                  value={categoryForm.category_code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, category_code: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Operational Description / Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Scope of facilities duties, equipment requirements, SLA focus areas..."
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cat_active"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="cat_active" className="text-slate-700 dark:text-slate-300 font-medium">
                  Active (Available for task assignment & checklists)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={14} />
                  {saving ? "Saving..." : editingCategory ? "Update Category" : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLIENT (SERVICE CLIENT / CUSTOMER ORGANIZATION) */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Building2 size={18} className="text-emerald-600" />
                {editingClient ? "Edit Client" : "Register New Client"}
              </h3>
              <button
                onClick={() => setShowClientModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Client / Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Apex Real Estate / Zenith Properties"
                    value={clientForm.customer_name}
                    onChange={(e) => setClientForm((p) => ({ ...p, customer_name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Client Code
                  </label>
                  <input
                    type="text"
                    className="input w-full font-mono"
                    placeholder="Auto-generated"
                    value={clientForm.customer_code}
                    onChange={(e) => setClientForm((p) => ({ ...p, customer_code: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Client Type
                  </label>
                  <select
                    className="select w-full"
                    value={clientForm.customer_type}
                    onChange={(e) => setClientForm((p) => ({ ...p, customer_type: e.target.value }))}
                  >
                    <option value="LOCAL">LOCAL</option>
                    <option value="FOREIGN">FOREIGN</option>
                    <option value="Individual">Individual</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Samuel Mensah"
                    value={clientForm.contact_person}
                    onChange={(e) => setClientForm((p) => ({ ...p, contact_person: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="input w-full"
                    placeholder="client@example.com"
                    value={clientForm.email}
                    onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Phone Number
                  </label>
                  <PhoneInput
                    value={clientForm.phone}
                    onChange={(v) => setClientForm((p) => ({ ...p, phone: v }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. 30 Days Net"
                    value={clientForm.payment_terms}
                    onChange={(e) => setClientForm((p) => ({ ...p, payment_terms: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. 45 Independence Avenue"
                    value={clientForm.address}
                    onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Accra"
                    value={clientForm.city}
                    onChange={(e) => setClientForm((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    State / Region
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Greater Accra"
                    value={clientForm.state}
                    onChange={(e) => setClientForm((p) => ({ ...p, state: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Ghana"
                    value={clientForm.country}
                    onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={Number(clientForm.is_active) === 1}
                      onChange={(e) => setClientForm((p) => ({ ...p, is_active: e.target.checked ? 1 : 0 }))}
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Active Client</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingClient ? "Update Client" : "Register Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye size={18} className="text-amber-600" />
                  {previewTemplate.template_name}
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  {previewTemplate.template_code} • {previewTemplate.service_line?.replace(/_/g, " ")}
                </span>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 italic">
                {previewTemplate.description || "Digital inspection checklist criteria"}
              </p>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2 w-8">#</th>
                      <th className="px-3 py-2">Check Criteria</th>
                      <th className="px-3 py-2">Verification Type</th>
                      <th className="px-3 py-2 text-right">Critical</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {(previewTemplate.items || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{it.item_text}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                            {it.field_type}
                            {it.unit_of_measure ? ` (${it.unit_of_measure})` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {it.is_critical ? (
                            <span className="text-red-600 dark:text-red-400 font-bold text-[10px] uppercase">
                              Critical
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!previewTemplate.items || previewTemplate.items.length === 0) && (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-slate-400">
                          No criteria items found in this template.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const tpl = previewTemplate;
                    setPreviewTemplate(null);
                    handleOpenChecklistModal(tpl);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Edit2 size={13} /> Edit Template
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}

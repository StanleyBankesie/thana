/**
 * @fileoverview API Service for the HR module.
 * Provides methods for employee management, recruitment, attendance, and payroll operations.
 */

import { api } from "../../../api/client.js";

/**
 * hrService
 * Encapsulates all backend API calls for HR-related features.
 */
export const hrService = {
  listEmployees(params) {
    return api.get("/hr/employees", { params });
  },
  getEmployee(id) {
    return api.get(`/hr/employees/${id}`);
  },
  saveEmployee(data) {
    return api.post("/hr/employees", data);
  },
  listDepartments() {
    return api.get("/hr/departments");
  },
  saveDepartment(data) {
    return api.post("/hr/departments", data);
  },
  listPositions() {
    return api.get("/hr/positions");
  },
  savePosition(data) {
    return api.post("/hr/positions", data);
  },
  listRequisitions() {
    return api.get("/hr/requisitions");
  },
  getRequisition(id) {
    return api.get(`/hr/requisitions/${id}`);
  },
  saveRequisition(data) {
    return api.post("/hr/requisitions", data);
  },
  submitRequisition(id) {
    return api.post(`/hr/requisitions/${id}/submit`);
  },
  listCandidates(params) {
    return api.get("/hr/candidates", { params });
  },
  saveCandidate(data) {
    return api.post("/hr/candidates", data);
  },
  listInterviews(params) {
    return api.get("/hr/interviews", { params });
  },
  saveInterview(data) {
    return api.post("/hr/interviews", data);
  },
  listOffers(params) {
    return api.get("/hr/offers", { params });
  },
  saveOffer(data) {
    return api.post("/hr/offers", data);
  },
  attendance(params) {
    return api.get("/hr/attendance", { params });
  },
  clockIn(data) {
    return api.post("/hr/attendance/clock-in", data);
  },
  clockOut(data) {
    return api.post("/hr/attendance/clock-out", data);
  },
  saveTimesheet(data) {
    return api.post("/hr/timesheets", data);
  },
  listShifts() {
    return api.get("/hr/shifts");
  },
  saveShift(data) {
    return api.post("/hr/shifts", data);
  },
  listLeaveTypes() {
    return api.get("/hr/leave/types");
  },
  saveLeaveType(data) {
    return api.post("/hr/leave/types", data);
  },
  leaveBalances(params) {
    return api.get("/hr/leave/balances", { params });
  },
  leaveRequests(params) {
    return api.get("/hr/leave/requests", { params });
  },
  applyLeave(data) {
    return api.post("/hr/leave/apply", data);
  },
  approveLeave(id, approved) {
    return api.post(`/hr/leave/approve/${id}`, { approved });
  },
  payrollGenerate(data) {
    return api.post("/hr/payroll/generate", data);
  },
  payrollClose(data) {
    return api.post("/hr/payroll/close", data);
  },
  kpis() {
    return api.get("/hr/performance/kpis");
  },
  saveKPI(data) {
    return api.post("/hr/performance/kpis", data);
  },
  performanceReviews(params) {
    return api.get("/hr/performance/reviews", { params });
  },
  savePerformanceReview(data) {
    return api.post("/hr/performance/reviews", data);
  },
  trainingPrograms() {
    return api.get("/hr/training/programs");
  },
  saveTrainingProgram(data) {
    return api.post("/hr/training/programs", data);
  },
  trainingRecords(params) {
    return api.get("/hr/training/records", { params });
  },
  saveTrainingRecord(data) {
    return api.post("/hr/training/records", data);
  },
  policies() {
    return api.get("/hr/policies");
  },
  savePolicy(data) {
    return api.post("/hr/policies", data);
  },
  acknowledgePolicy(data) {
    return api.post("/hr/policies/acknowledge", data);
  },
  exits(params) {
    return api.get("/hr/exits", { params });
  },
  saveExit(data) {
    return api.post("/hr/exits", data);
  },
  clearance(params) {
    return api.get("/hr/clearance", { params });
  },
  updateClearance(data) {
    return api.post("/hr/clearance/update", data);
  },
};

/**
 * @file transport.route.js
 * @description Routes for the Transport Module
 */
import express from "express";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  listTransportationBills, getTransportationBill, createTransportationBill, updateTransportationBill, deleteTransportationBill, getNextTransportationBillNo
} from "../controllers/transport.controller.js";
import {
  listCompliances, getComplianceById, createCompliance, updateCompliance, deleteCompliance
} from "../controllers/transport-compliance.controller.js";
import {
  listServicing, getServicingById, createServicing, updateServicing, deleteServicing
} from "../controllers/transport-servicing.controller.js";
import {
  listLogbooks, getLogbookById, createLogbook, updateLogbook, deleteLogbook
} from "../controllers/transport-logbook.controller.js";
import {
  listSetupItems, createSetupItem, updateSetupItem, deleteSetupItem
} from "../controllers/transport-setup.controller.js";
import {
  listInspections, getInspectionById, createInspection, updateInspection, deleteInspection
} from "../controllers/transport-inspections.controller.js";
import {
  listRoutes, getRoute, createRoute, updateRoute, toggleRouteStatus
} from "../controllers/transport-routes.controller.js";
import {
  listFuelBills, getFuelBill, createFuelBill, updateFuelBill, deleteFuelBill,
  getNextBillingNo,
  getBilling, createBilling, updateBilling, deleteBilling, submitBilling,
  getTransportDashboardStats,
  listVehicles, createVehicle,
  listDrivers, createDriver, getDriver, updateDriver, toggleDriverStatus,
  listRequests, createRequest, updateRequestStatus,
  listTrips, getTrip, createTrip, updateTrip, startTrip, returnTrip,
  listFuelLogs, createFuelLog, getFuelLog, updateFuelLog, updateFuelLogStatus, deleteFuelLog,
  listFuelExpenses, createFuelExpense,
  listBilling,
  addTripLocation, getTripLocations, submitPOD,
  listBreakdowns, createBreakdown,
  listTransportIncome, createTransportIncome, updateTransportIncome, deleteTransportIncome, updateTransportIncomeVoucherId,
  listTransportExpenses, createTransportExpense, updateTransportExpense, deleteTransportExpense, updateTransportExpenseVoucherId,
  listExpenseLogs, createExpenseLog, updateExpenseLog, deleteExpenseLog, updateExpenseLogVoucherId,
  getTransportFullAnalyticsReport
} from "../controllers/transport.controller.js";

const router = express.Router();

// Dashboard & Analytics
router.get("/dashboard", requireAuth, requireCompanyScope, getTransportDashboardStats);
router.get("/reports/analytics", requireAuth, requireCompanyScope, getTransportFullAnalyticsReport);
router.get("/reports/trip-execution", requireAuth, requireCompanyScope, getTransportFullAnalyticsReport);

// Vehicles
router.get("/vehicles", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.VIEW"), listVehicles);
router.post("/vehicles", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.CREATE"), createVehicle);

// Vehicle Compliance
router.get("/compliance", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.VIEW"), listCompliances);
router.get("/compliance/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.VIEW"), getComplianceById);
router.post("/compliance", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.CREATE"), createCompliance);
router.put("/compliance/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.CREATE"), updateCompliance);
router.delete("/compliance/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.CREATE"), deleteCompliance);

// Vehicle Servicing
router.get("/servicing", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.VIEW"), listServicing);
router.get("/servicing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.VIEW"), getServicingById);
router.post("/servicing", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.CREATE"), createServicing);
router.put("/servicing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.CREATE"), updateServicing);
router.delete("/servicing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.VEHICLES.CREATE"), deleteServicing);

// Drivers
router.get("/drivers", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.VIEW"), listDrivers);
router.post("/drivers", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.CREATE"), createDriver);
router.get("/drivers/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.VIEW"), getDriver);
router.put("/drivers/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.EDIT"), updateDriver);
router.patch("/drivers/:id/status", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.DELETE"), toggleDriverStatus);


// Driver Logbooks
router.get("/logbooks", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.VIEW"), listLogbooks);
router.get("/logbooks/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.VIEW"), getLogbookById);
router.post("/logbooks", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.CREATE"), createLogbook);
router.put("/logbooks/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.CREATE"), updateLogbook);
router.delete("/logbooks/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.DRIVERS.CREATE"), deleteLogbook);

// Requests
router.get("/requests", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.REQUESTS.VIEW"), listRequests);
router.post("/requests", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.REQUESTS.CREATE"), createRequest);
router.put("/requests/:id/status", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.REQUESTS.VIEW"), updateRequestStatus);

// Trips
router.get("/trips", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.VIEW"), listTrips);
router.get("/trips/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.VIEW"), getTrip);
router.post("/trips", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.CREATE"), createTrip);
router.put("/trips/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.EDIT"), updateTrip);
router.put("/trips/:id/start", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.EDIT"), startTrip);
router.put("/trips/:id/return", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.EDIT"), returnTrip);

// Fuel Logs
router.get("/fuel", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.VIEW"), listFuelLogs);
router.post("/fuel", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.CREATE"), createFuelLog);
router.get("/fuel/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.VIEW"), getFuelLog);
router.put("/fuel/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.CREATE"), updateFuelLog);
router.put("/fuel/:id/status", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.CREATE"), updateFuelLogStatus);
router.delete("/fuel/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.CREATE"), deleteFuelLog);

// Billing
router.get("/billing/next-no", requireAuth, requireCompanyScope, getNextBillingNo);
router.get("/billing", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.VIEW"), listBilling);
router.get("/billing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.VIEW"), getBilling);
router.post("/billing", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.MANAGE"), createBilling);
router.put("/billing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.MANAGE"), updateBilling);
router.delete("/billing/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.MANAGE"), deleteBilling);
router.post("/billing/:id/submit", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLING.MANAGE"), submitBilling);

// Transportation Bills
router.get("/transportation-bills/next-no", requireAuth, requireCompanyScope, getNextTransportationBillNo);
router.get("/transportation-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.VIEW"), listTransportationBills);
router.get("/transportation-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.VIEW"), getTransportationBill);
router.post("/transportation-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.MANAGE"), createTransportationBill);
router.put("/transportation-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.MANAGE"), updateTransportationBill);
router.delete("/transportation-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BILLS.MANAGE"), deleteTransportationBill);

// Fuel Bills
router.get("/fuel-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.VIEW"), listFuelBills);
router.get("/fuel-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.VIEW"), getFuelBill);
router.post("/fuel-bills", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.MANAGE"), createFuelBill);
router.put("/fuel-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.MANAGE"), updateFuelBill);
router.delete("/fuel-bills/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL.MANAGE"), deleteFuelBill);


// GPS & POD
router.post("/trips/:id/location", requireAuth, requireCompanyScope, addTripLocation);
router.get("/trips/:id/locations", requireAuth, requireCompanyScope, getTripLocations);
router.post("/trips/:id/pod", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.EDIT"), submitPOD);

// Breakdowns
router.get("/breakdowns", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BREAKDOWN-LOGBOOK.VIEW"), listBreakdowns);
router.post("/breakdowns", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.BREAKDOWN-LOGBOOK.CREATE"), createBreakdown);

// Income
router.get("/income", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INCOME.VIEW"), listTransportIncome);
router.post("/income", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INCOME.CREATE"), createTransportIncome);
router.put("/income/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INCOME.EDIT"), updateTransportIncome);
router.delete("/income/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INCOME.DELETE"), deleteTransportIncome);
router.put("/income/:id/voucher", requireAuth, requireCompanyScope, updateTransportIncomeVoucherId);

// Expenses
router.get("/expenses", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSES.VIEW"), listTransportExpenses);
router.post("/expenses", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSES.CREATE"), createTransportExpense);
router.put("/expenses/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSES.EDIT"), updateTransportExpense);
router.delete("/expenses/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSES.DELETE"), deleteTransportExpense);
router.put("/expenses/:id/voucher", requireAuth, requireCompanyScope, updateTransportExpenseVoucherId);
// Expense Logs
router.get("/expense-logs", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSE_LOG.VIEW"), listExpenseLogs);
router.post("/expense-logs", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSE_LOG.CREATE"), createExpenseLog);
router.put("/expense-logs/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSE_LOG.EDIT"), updateExpenseLog);
router.delete("/expense-logs/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.EXPENSE_LOG.DELETE"), deleteExpenseLog);
router.put("/expense-logs/:id/voucher", requireAuth, requireCompanyScope, updateExpenseLogVoucherId);

// Setup / Settings
router.get("/setup", requireAuth, requireCompanyScope, listSetupItems);
router.post("/setup", requireAuth, requireCompanyScope, createSetupItem);
router.put("/setup/:id", requireAuth, requireCompanyScope, updateSetupItem);
router.delete("/setup/:id", requireAuth, requireCompanyScope, deleteSetupItem);

// Inspections
router.get("/inspections", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INSPECTIONS.VIEW"), listInspections);
router.get("/inspections/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INSPECTIONS.VIEW"), getInspectionById);
router.post("/inspections", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INSPECTIONS.CREATE"), createInspection);
router.put("/inspections/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INSPECTIONS.EDIT"), updateInspection);
router.delete("/inspections/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.INSPECTIONS.DELETE"), deleteInspection);

// Routes
router.get("/routes", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.ROUTES.VIEW"), listRoutes);
router.post("/routes", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.ROUTES.CREATE"), createRoute);
router.get("/routes/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.ROUTES.VIEW"), getRoute);
router.put("/routes/:id", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.ROUTES.EDIT"), updateRoute);
router.put("/routes/:id/toggle", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.ROUTES.EDIT"), toggleRouteStatus);

export default router;

// Fuel Expenses
router.get("/fuel-expenses", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL_EXPENSES.VIEW"), listFuelExpenses);
router.post("/fuel-expenses", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.FUEL_EXPENSES.CREATE"), createFuelExpense);

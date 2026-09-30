// ============================================================================
// HR Validation Utilities
// ============================================================================
// This file contains utility functions to validate incoming request bodies for 
// HR-related operations (requisitions, candidates, leave requests). 
// They ensure payload integrity before processing in the controller layer.

/**
 * Validate an HR requisition request body.
 * @param {Object} body - Request body containing requisition data.
 * @returns {string[]} Array of missing or invalid field names.
 */
// Utility function to validate HR requisition payloads before database insertion or updates
export function validateRequisition(body) {
  // Initialize an empty array to collect validation errors
  const errors = [];
  
  // Validate that the requisition title is provided and not empty
  if (!String(body.title || "").trim()) errors.push("title");
  
  // Validate that the number of vacancies is a valid, non-zero number
  if (!Number(body.vacancies || 0)) errors.push("vacancies");
  
  // Validate that a valid department ID is provided
  if (!Number(body.dept_id || 0)) errors.push("dept_id");
  
  // Validate that a valid position ID is provided
  if (!Number(body.pos_id || 0)) errors.push("pos_id");
  
  // Return the accumulated list of invalid field names
  return errors;
}

/**
 * Validate an HR candidate request body.
 * @param {Object} body - Request body containing candidate data.
 * @returns {string[]} Array of missing or invalid field names.
 */
// Utility function to validate HR candidate profiles before processing their applications
export function validateCandidate(body) {
  // Initialize an empty array to collect validation errors
  const errors = [];
  
  // Validate that the candidate's first name is present
  if (!String(body.first_name || "").trim()) errors.push("first_name");
  
  // Validate that the candidate's last name is present
  if (!String(body.last_name || "").trim()) errors.push("last_name");
  
  // Validate that the candidate's email is present (basic presence check)
  if (!String(body.email || "").trim()) errors.push("email");
  
  // Return the accumulated list of invalid field names
  return errors;
}

/**
 * Validate an HR leave request body.
 * @param {Object} body - Request body containing leave request data.
 * @returns {string[]} Array of missing or invalid field names.
 */
// Utility function to validate HR leave requests to ensure all required scheduling and identity data is provided
export function validateLeaveRequest(body) {
  // Initialize an empty array to collect validation errors
  const errors = [];
  
  // Validate that a valid employee ID is provided
  if (!Number(body.employee_id || 0)) errors.push("employee_id");
  
  // Validate that a valid leave type ID is provided
  if (!Number(body.leave_type_id || 0)) errors.push("leave_type_id");
  
  // Validate that the start date string is provided
  if (!String(body.start_date || "").trim()) errors.push("start_date");
  
  // Validate that the end date string is provided
  if (!String(body.end_date || "").trim()) errors.push("end_date");
  
  // Return the accumulated list of invalid field names
  return errors;
}

/**
 * MySQL Assignments Module
 * Direct MySQL connection for assignments storage
 */

export { assignmentsDb, testConnection } from './db';
export {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentsCountByEmployee,
  getAssignmentsByDateRange,
} from './queries';

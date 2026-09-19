// Central permission matrix for tenant roles. Uses only the roles already
// present in the schema (OWNER, ADMIN, TEACHER, ACCOUNTANT) — no invented
// roles. Every mutation route must enforce the relevant capability
// server-side; UI visibility is never the security boundary.
//
// Capability            | OWNER | ADMIN | ACCOUNTANT | TEACHER
// ----------------------|-------|-------|------------|--------
// manageAcademy (config,|  ✓    |  ✓    |     ✗      |   ✗
//   students, classes,  |
//   staff, settings,    |
//   CMS, CRM edits)     |
// manageFinance         |  ✓    |  ✓    |     ✓      |   ✗
//   (record payments)   |
// markAttendance        |  ✓    |  ✓    |     ✓      |   ✓
// read (all modules)    |  ✓    |  ✓    |     ✓      |   ✓

const MANAGE_ROLES = new Set(['OWNER', 'ADMIN'])
const FINANCE_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT'])

export function canManageAcademy(role: string) {
  return MANAGE_ROLES.has(role)
}

export function canManageFinance(role: string) {
  return FINANCE_ROLES.has(role)
}

// Attendance is a day-to-day operational task available to every active
// tenant user role.
export function canMarkAttendance(_role: string) {
  return true
}

export const ACCOUNT_ROLES = Object.freeze(['candidate', 'startup', 'admin']);
export const SIGNUP_ROLES = Object.freeze(['candidate', 'startup']);

// Older users predate the role field. Treat a missing role as candidate so an
// existing account keeps working without ever becoming a startup account.
export function getAccountRole(role) {
  if (role === undefined || role === null || role === '') return 'candidate';
  return ACCOUNT_ROLES.includes(role) ? role : null;
}

export function isAccountRole(role) {
  return ACCOUNT_ROLES.includes(role);
}

export const ACCOUNT_ROLES = Object.freeze(['candidate', 'startup', 'admin']);

export function getAccountRole(user) {
  const role = user?.role;
  return ACCOUNT_ROLES.includes(role) ? role : null;
}

export function roleHome(user) {
  const role = getAccountRole(user);
  if (role === 'admin') return '/admin';
  if (role === 'startup') return '/startup/dashboard';
  if (role === 'candidate') return '/feed';
  return '/profile';
}

function isSafeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') && !next.startsWith('/register');
}

export function postLoginDestination(user, next) {
  const role = getAccountRole(user);
  if (isSafeNext(next)) {
    const matchesRoute = (prefix) => next === prefix || next.startsWith(`${prefix}/`);
    const candidateNext = ['/feed', '/profile', '/leaderboard'].some(matchesRoute)
      || ['/c/', '/result/', '/badge/'].some((prefix) => next.startsWith(prefix));
    const startupNext = ['/startup', '/post', '/review', '/dashboard', '/profile', '/leaderboard'].some(matchesRoute);
    const adminNext = ['/admin'].some(matchesRoute);
    if (role === 'candidate' && candidateNext) return next;
    if (role === 'startup' && startupNext) return next;
    if (role === 'admin' && adminNext) return next;
  }
  return roleHome(user);
}

export function roleLabel(user) {
  return getAccountRole(user) === 'admin' ? 'Admin' : getAccountRole(user) === 'startup' ? 'Startup' : getAccountRole(user) === 'candidate' ? 'Candidate' : 'Account';
}

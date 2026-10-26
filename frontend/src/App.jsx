import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Post from './pages/Post.jsx';
import Review from './pages/Review.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Solve from './pages/Solve.jsx';
import Result from './pages/Result.jsx';
import BadgePage from './pages/BadgePage.jsx';
import Feed from './pages/Feed.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import CandidateDashboard from './pages/CandidateDashboard.jsx';
import StartupDashboard from './pages/StartupDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { useAuth } from './lib/auth.jsx';
import { getAccountRole, roleHome } from './lib/roles.js';
import { BrandMark } from './components/DomainVisuals.jsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

function ProtectedRoute({ roles, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = getAccountRole(user);
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!role) return <section className="card stack" style={{ maxWidth: 620, margin: '40px auto' }}><h1>Account role unavailable</h1><p className="muted">We could not safely identify this account type. Sign out and contact support before continuing.</p><button className="btn primary" type="button" onClick={logout}>Sign out</button></section>;
  if (roles && !roles.includes(role)) return <Navigate to={roleHome(user)} replace />;
  return children;
}

function LandingRoute() {
  const { user } = useAuth();
  return user ? <Navigate to={roleHome(user)} replace /> : <Home />;
}

export default function App() {
  const { user, logout, loading: authLoading, sessionError } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  if (authLoading) return <main className="session-skeleton" aria-label="Loading ProveIt" aria-live="polite">
    <div className="session-skeleton__brand"><i /> <i /></div>
    <div className="session-skeleton__content"><i /><i /><i /><div><i /><i /></div></div>
  </main>;

  async function signOut() {
    await logout();
    navigate('/');
  }

  return (
    <>
      <header className="nav" style={{ flexWrap: 'wrap' }}>
        <Link to="/" className="logo" aria-label="ProveIt home"><span className="logo-mark"><BrandMark /></span><span className="logo-word">Prove</span><span className="logo-word-accent">It</span></Link>
        {user && <nav aria-label="Main navigation">
          {getAccountRole(user) === 'admin' ? <NavLink to="/admin">Admin overview</NavLink> : getAccountRole(user) === 'startup' ? <>
            <NavLink to="/startup/dashboard">Dashboard</NavLink>
            <NavLink to="/post">Post a challenge</NavLink>
            <NavLink to="/leaderboard">Leaderboard</NavLink>
          </> : getAccountRole(user) === 'candidate' ? <>
            <NavLink to="/feed">Opportunities</NavLink>
            <NavLink to="/leaderboard">Leaderboard</NavLink>
          </> : null}
        </nav>}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={user ? 'signed-in' : 'signed-out'}
            className="row nav-account"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            {user ? <>
              <NavLink to="/profile">Profile</NavLink>
              <button className="btn small ghost" type="button" onClick={signOut}>Log out</button>
            </> : <><NavLink to="/login">Log in</NavLink><NavLink to="/register">Create account</NavLink></>}
          </motion.div>
        </AnimatePresence>
      </header>
      <main className="page">
        {sessionError && <div className="notice" role="status" style={{ marginBottom: 16 }}>{sessionError} Some account data may be stale until the connection returns.</div>}
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/post" element={<ProtectedRoute roles={['startup']}><Post /></ProtectedRoute>} />
          <Route path="/review/:id" element={<ProtectedRoute roles={['startup']}><Review /></ProtectedRoute>} />
          <Route path="/dashboard/:id" element={<ProtectedRoute roles={['startup']}><Dashboard /></ProtectedRoute>} />
          <Route path="/startup" element={<ProtectedRoute roles={['startup']}><StartupDashboard /></ProtectedRoute>} />
          <Route path="/startup/dashboard" element={<ProtectedRoute roles={['startup']}><StartupDashboard /></ProtectedRoute>} />
          <Route path="/c/:id" element={<ProtectedRoute roles={['candidate']}><Solve /></ProtectedRoute>} />
          <Route path="/result/:sid" element={<ProtectedRoute roles={['candidate']}><Result /></ProtectedRoute>} />
          <Route path="/badge/:badgeId" element={<BadgePage />} />
          <Route path="/feed" element={<ProtectedRoute roles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
          <Route path="/candidate/dashboard" element={<ProtectedRoute roles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login initialMode="signup" />} />
          <Route path="/profile" element={<ProtectedRoute roles={['candidate', 'startup']}><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<div className="card">Page not found.</div>} />
        </Routes>
      </main>
    </>
  );
}

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { clearAuth, getAuthUser, getToken, saveAuth } from './store.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const cachedUser = getAuthUser();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const validationStarted = useRef(false);

  useEffect(() => {
    if (validationStarted.current) return;
    validationStarted.current = true;
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then((result) => {
        saveAuth(token, result.user);
        setUser(result.user);
      })
      .catch((error) => {
        if (error.status === 401 || error.status === 403) {
          clearAuth();
          setUser(null);
        } else {
          // A temporary network/database outage must not erase a session that
          // has not been proven invalid.
          setUser(cachedUser ? { ...cachedUser, role: cachedUser.role || 'candidate' } : null);
          setSessionError('We could not validate your session right now.');
        }
      })
      .finally(() => setLoading(false));
  }, [cachedUser]);

  async function login(email, password) {
    const result = await api.login({ email, password });
    saveAuth(result.token, result.user);
    setUser(result.user);
    setSessionError('');
    setLoading(false);
    return result.user;
  }

  async function signup(body) {
    const result = await api.signup(body);
    saveAuth(result.token, result.user);
    setUser(result.user);
    setSessionError('');
    setLoading(false);
    return result.user;
  }

  async function logout() {
    try { await api.logout(); } catch { /* ignore expired or unavailable sessions */ }
    clearAuth();
    setUser(null);
    setSessionError('');
    setLoading(false);
  }

  return <AuthContext.Provider value={{ user, login, signup, logout, setUser, loading, sessionError }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

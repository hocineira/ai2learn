import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [activeFormation, setActiveFormation] = useState(localStorage.getItem('activeFormation') || null);

  const getAuthHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
          setUser(res.data);
          if (!activeFormation) {
            setActiveFormation(res.data.formation || 'bts-sio-sisr');
            localStorage.setItem('activeFormation', res.data.formation || 'bts-sio-sisr');
          }
        } catch {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    const f = res.data.user.formation || 'bts-sio-sisr';
    setActiveFormation(f);
    localStorage.setItem('activeFormation', f);
    return res.data.user;
  };

  const register = async (email, password, fullName, role, formation) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, full_name: fullName, role, formation });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    setActiveFormation(formation);
    localStorage.setItem('activeFormation', formation);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeFormation');
    setToken(null);
    setUser(null);
    setActiveFormation(null);
  };

  const switchFormation = (formationId) => {
    setActiveFormation(formationId);
    localStorage.setItem('activeFormation', formationId);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, getAuthHeaders, API, activeFormation, switchFormation }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

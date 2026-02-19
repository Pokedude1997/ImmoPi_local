import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Transactions } from './pages/Transactions';
import { Documents } from './pages/Documents';
import { RecurringPayments } from './pages/RecurringPayments';
import { Settings } from './pages/Settings';
import { Tenants } from './pages/Tenants';
import { Reports } from './pages/Reports';
import { Login } from './pages/Login';

// Authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextType>({
  isAuthenticated: false,
  logout: () => {},
});

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    const expiry = localStorage.getItem('authExpiry');

    // Check if token exists and hasn't expired
    if (!token || !expiry) {
      setIsAuthenticated(false);
      setIsChecking(false);
      navigate('/login');
      return;
    }

    // Check expiry
    if (new Date(expiry) < new Date()) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authExpiry');
      setIsAuthenticated(false);
      setIsChecking(false);
      navigate('/login');
      return;
    }

    // Verify with server
    try {
      const response = await fetch('http://localhost:8000/api/auth/check', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authExpiry');
        setIsAuthenticated(false);
        navigate('/login');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Allow offline access if token hasn't expired
      setIsAuthenticated(true);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666',
      }}>
        Loading...
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

// Main app with auth provider
const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const expiry = localStorage.getItem('authExpiry');
    const hasValidToken = token && expiry && new Date(expiry) > new Date();
    setIsAuthenticated(!!hasValidToken);
  }, [location]);

  const logout = () => {
    const token = localStorage.getItem('authToken');
    
    // Call logout endpoint
    fetch('http://localhost:8000/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    }).catch(err => console.error('Logout error:', err));

    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('authExpiry');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, logout }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/properties" element={<Properties />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/recurring" element={<RecurringPayments />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/tenants" element={<Tenants />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthContext.Provider>
  );
};

const App = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;

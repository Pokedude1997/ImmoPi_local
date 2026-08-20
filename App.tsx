import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Transactions } from './pages/Transactions';
import { Documents } from './pages/Documents';
import { RecurringPayments } from './pages/RecurringPayments';
import { Settings } from './pages/Settings';
import { Tenants } from './pages/Tenants';
import { Reports } from './pages/Reports';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

const AppContent = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected routes */}
      <Route
        path="/"
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
                <Route path="/settings" element={
                  <ProtectedRoute adminOnly={true}>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
};

export default App;

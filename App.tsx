
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Transactions } from './pages/Transactions';
import { Documents } from './pages/Documents';
import { RecurringPayments } from './pages/RecurringPayments';
import { Settings } from './pages/Settings';
import { Tenants } from './pages/Tenants';
import { Reports } from './pages/Reports';

const App = () => {
  return (
    <HashRouter>
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
    </HashRouter>
  );
};

export default App;

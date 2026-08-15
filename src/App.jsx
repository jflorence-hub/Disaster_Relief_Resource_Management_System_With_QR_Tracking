import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Resources from './pages/Resources';
import QRTracking from './pages/QRTracking';
import Distribution from './pages/Distribution';
import TeamManagement from './pages/TeamManagement';
import Locations from './pages/Locations';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  const isAuthenticated = !!localStorage.getItem('authToken');

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/qr-tracking" element={<QRTracking />} />
          <Route path="/distribution" element={<Distribution />} />
          <Route path="/team" element={<TeamManagement />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
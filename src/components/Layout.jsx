import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, QrCode, Truck, Users, MapPin, FileText, Settings,
  LogOut, Menu, X, Bell, User, Search, ChevronDown
} from 'lucide-react';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/resources', label: 'Resources', icon: Package },
    { path: '/qr-tracking', label: 'QR Tracking', icon: QrCode },
    { path: '/distribution', label: 'Distribution', icon: Truck },
    { path: '/team', label: 'Team Management', icon: Users },
    { path: '/locations', label: 'Locations', icon: MapPin },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 ${sidebarOpen ? 'w-[240px]' : 'w-[72px]'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">DR</div>
              {sidebarOpen && <span className="text-sm font-bold text-slate-800 whitespace-nowrap">Disaster Relief</span>}
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0">
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.path}>
                  <NavLink to={item.path} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-0' : ''}`} title={!sidebarOpen ? item.label : ''}>
                    <item.icon size={20} className="flex-shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="p-3 border-t border-slate-200">
            <button onClick={handleLogout} className={`sidebar-link w-full ${!sidebarOpen ? 'justify-center px-0' : ''}`} title={!sidebarOpen ? 'Logout' : ''}>
              <LogOut size={20} className="flex-shrink-0 text-red-500" />
              {sidebarOpen && <span className="text-red-500">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-[240px]' : 'ml-[72px]'}`}>
        {/* Top navbar */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 lg:hidden">
              <Menu size={20} />
            </button>
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search resources, locations..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">A</div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-800">Admin</p>
                    <p className="text-xs text-slate-500">admin@disasterrelief.org</p>
                  </div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
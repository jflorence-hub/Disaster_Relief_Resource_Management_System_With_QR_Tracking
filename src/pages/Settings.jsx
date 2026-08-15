import { useState, useEffect } from 'react';
import { User, Bell, Shield, Palette, Globe, Database, HelpCircle, ChevronRight, Save, Mail, Lock, Moon, Sun } from 'lucide-react';
import Toast from '../components/Toast';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const handleSave = (section) => {
    setToast({ message: `${section} settings saved!`, type: 'success' });
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'system', label: 'System', icon: Database },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
              <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">A</div>
              <div><h3 className="text-lg font-semibold text-slate-800">Admin</h3><p className="text-sm text-slate-500">admin@disasterrelief.org</p><p className="text-xs text-slate-400 mt-1">Role: Administrator</p></div>
            </div>
            <div><label className="label">Full Name</label><input type="text" className="input-field" defaultValue="Admin" /></div>
            <div><label className="label">Email</label><input type="email" className="input-field" defaultValue="admin@disasterrelief.org" /></div>
            <div><label className="label">Phone</label><input type="tel" className="input-field" placeholder="+63 900 000 0000" /></div>
            <button className="btn-primary flex items-center gap-2" onClick={() => handleSave('Profile')}><Save size={16} /> Save Changes</button>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Manage your notification preferences</p>
            {['Email Notifications', 'Low Stock Alerts', 'QR Scan Alerts'].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100">
                <div><p className="font-medium text-slate-800">{item}</p><p className="text-xs text-slate-400">{i===0?'Receive updates via email':'Get notified when resources are low'}</p></div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={i<2} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
            <button className="btn-primary flex items-center gap-2" onClick={() => handleSave('Notification')}><Save size={16} /> Save Preferences</button>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Update your security settings</p>
            <div><label className="label">Current Password</label><input type="password" className="input-field" placeholder="••••••••" /></div>
            <div><label className="label">New Password</label><input type="password" className="input-field" placeholder="••••••••" /></div>
            <div><label className="label">Confirm New Password</label><input type="password" className="input-field" placeholder="••••••••" /></div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div><p className="font-medium text-slate-800">Two-Factor Auth</p><p className="text-xs text-slate-400">Add extra security</p></div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <button className="btn-primary flex items-center gap-2" onClick={() => handleSave('Security')}><Save size={16} /> Update Security</button>
          </div>
        );
      case 'appearance':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Customize the look and feel</p>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon size={20} className="text-slate-600" /> : <Sun size={20} className="text-amber-500" />}
                <div><p className="font-medium text-slate-800">Dark Mode</p><p className="text-xs text-slate-400">Switch between light and dark theme</p></div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div><label className="label">Primary Color</label><div className="flex gap-3">{['#2563eb','#7c3aed','#059669','#d97706','#dc2626'].map(c => <button key={c} className="w-8 h-8 rounded-full border-2 border-slate-200 hover:border-slate-400 transition-colors" style={{background:c}}></button>)}</div></div>
            <button className="btn-primary flex items-center gap-2" onClick={() => handleSave('Appearance')}><Save size={16} /> Save Theme</button>
          </div>
        );
      case 'system':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">System information</p>
            <div className="grid gap-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Version</span><span className="font-medium text-slate-800">2.4.1</span></div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Last Updated</span><span className="font-medium text-slate-800">2026-08-05</span></div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Database Status</span><span className="badge badge-available">Operational</span></div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-slate-600">API Status</span><span className="badge badge-available">Connected</span></div>
            </div>
            <button className="btn-secondary flex items-center gap-2" onClick={() => handleSave('System')}><Database size={16} /> Check for Updates</button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="mb-6"><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage account and system preferences</p></div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-56 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-2">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                    <span>{tab.label}</span>
                    {isActive && <ChevronRight size={16} className="ml-auto text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">{tabs.find(t => t.id === activeTab)?.label}</h2>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
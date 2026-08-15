import { useState } from 'react';
import { FileText, Download, Search, Filter, Calendar, ChevronDown, Eye, BarChart3, PieChart, TrendingUp, Plus, Trash2 } from 'lucide-react';
import { initialReports, generateId } from '../mockData';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

export default function Reports() {
  const [reports, setReports] = useState(initialReports);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', type: '' });
  const [toast, setToast] = useState(null);

  const types = ['All', 'Resource', 'Distribution', 'QR Tracking', 'Team'];

  const filtered = reports.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'All' || r.type === filterType;
    return matchSearch && matchType;
  });

  const handleGenerate = () => {
    if (!form.title || !form.type) {
      setToast({ message: 'Please fill all fields', type: 'error' });
      return;
    }
    const newReport = {
      id: generateId(),
      ...form,
      date: new Date().toISOString().split('T')[0],
      status: 'Generated',
      size: (Math.random() * 5 + 1).toFixed(1) + ' MB',
    };
    setReports([...reports, newReport]);
    setToast({ message: 'Report generated!', type: 'success' });
    setShowModal(false);
    setForm({ title: '', type: '' });
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this report?')) {
      setReports(reports.filter(r => r.id !== id));
      setToast({ message: 'Report deleted.', type: 'error' });
    }
  };

  const handleDownload = (report) => {
    if (report.status === 'Generated') {
      setToast({ message: `Downloading ${report.title}...`, type: 'success' });
    } else {
      setToast({ message: 'Report not ready for download.', type: 'error' });
    }
  };

  const getStatusBadge = (status) => {
    return <span className={status === 'Generated' ? 'badge badge-available' : 'badge badge-low-stock'}>{status}</span>;
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Generate and view reports</p></div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowModal(true)}><FileText size={16} /> Generate Report</button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Total</p><p className="text-2xl font-bold text-slate-800">{reports.length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Generated</p><p className="text-2xl font-bold text-emerald-600">{reports.filter(r => r.status === 'Generated').length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Pending</p><p className="text-2xl font-bold text-amber-600">{reports.filter(r => r.status === 'Pending').length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">This Month</p><p className="text-2xl font-bold text-blue-600">{reports.filter(r => r.date.startsWith(new Date().toISOString().slice(0,7))).length}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm" />
        </div>
        <div className="relative">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm bg-white">
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Title</th><th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Size</th><th className="px-4 py-3 font-medium text-center">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No reports</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.title}</td>
                    <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-600">{r.type}</span></td>
                    <td className="px-4 py-3 text-slate-600">{r.date}</td>
                    <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.size}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleDownload(r)} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors" title="Download"><Download size={16} /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Generate Report">
        <div className="space-y-3">
          <div><label className="label">Report Title</label><input className="input-field" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div><label className="label">Type</label>
            <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="">Select</option>
              {['Resource','Distribution','QR Tracking','Team'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={handleGenerate} className="btn-primary w-full">Generate</button>
        </div>
      </Modal>
    </div>
  );
}
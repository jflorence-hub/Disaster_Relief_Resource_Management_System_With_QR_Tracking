import { useState } from 'react';
import { Plus, Search, Edit, Trash2, QrCode, Eye, Filter, ChevronDown } from 'lucide-react';
import { generateId,initialResources } from '../mockData';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

export default function Resources() {
  const [resources, setResources] = useState(initialResources);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', quantity: '', location: '', status: 'Available' });
  const [toast, setToast] = useState(null);

  const categories = ['All', 'Food', 'Water', 'Medicine', 'Shelter', 'Clothing'];
  const statuses = ['Available', 'Low Stock', 'Reserved'];

  const filtered = resources.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || r.category === filter;
    return matchSearch && matchFilter;
  });

  const handleSave = () => {
    if (!form.name || !form.category || !form.quantity || !form.location) {
      setToast({ message: 'Please fill all fields', type: 'error' });
      return;
    }
    if (editing) {
      setResources(resources.map(r => r.id === editing.id ? { ...editing, ...form } : r));
      setToast({ message: 'Resource updated!', type: 'success' });
    } else {
      const newRes = { id: generateId(), ...form, lastUpdated: new Date().toISOString().split('T')[0] };
      setResources([...resources, newRes]);
      setToast({ message: 'Resource added!', type: 'success' });
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this resource?')) {
      setResources(resources.filter(r => r.id !== id));
      setToast({ message: 'Resource deleted.', type: 'error' });
    }
  };

  const openEdit = (res) => {
    setEditing(res);
    setForm({ name: res.name, category: res.category, quantity: res.quantity, location: res.location, status: res.status });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', category: '', quantity: '', location: '', status: 'Available' });
  };

  const getStatusBadge = (status) => {
    const classes = {
      Available: 'badge badge-available',
      'Low Stock': 'badge badge-low-stock',
      Reserved: 'badge badge-reserved',
    };
    return <span className={classes[status] || 'badge'}>{status}</span>;
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Resources</h1>
          <p className="page-subtitle">Manage and track all disaster relief resources</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Resource
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm" />
        </div>
        <div className="relative">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm bg-white">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 font-medium">Resource</th><th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Quantity</th><th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Last Updated</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No resources found</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.category}</td>
                    <td className="px-4 py-3 text-slate-600">{r.quantity}</td>
                    <td className="px-4 py-3 text-slate-600">{r.location}</td>
                    <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.lastUpdated}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors" title="View QR"><QrCode size={16} /></button>
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors" title="Edit"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filtered.length} of {resources.length} resources</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors">Previous</button>
            <button className="px-3 py-1 rounded bg-blue-600 text-white">1</button>
            <button className="px-3 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Resource' : 'Add Resource'}>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><label className="label">Category</label>
            <select className="input-field" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="">Select</option>
              {['Food','Water','Medicine','Shelter','Clothing'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Quantity</label><input className="input-field" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} /></div>
          <div><label className="label">Location</label><input className="input-field" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
          <div><label className="label">Status</label>
            <select className="input-field" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={handleSave} className="btn-primary w-full">Save</button>
        </div>
      </Modal>
    </div>
  );
}
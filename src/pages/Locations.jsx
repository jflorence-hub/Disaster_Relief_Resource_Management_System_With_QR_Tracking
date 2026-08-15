import { useState } from 'react';
import { MapPin, Plus, Search, Edit, Trash2, Eye, Filter, Navigation, Building, Warehouse, Home } from 'lucide-react';
import { initialLocations, generateId } from '../mockData';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

export default function Locations() {
  const [locations, setLocations] = useState(initialLocations);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: '', address: '', capacity: '', status: 'Active', resources: 0 });
  const [toast, setToast] = useState(null);

  const types = ['All', 'Warehouse', 'Medical', 'Evacuation', 'Distribution'];

  const filtered = locations.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.address.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'All' || l.type === filterType;
    return matchSearch && matchType;
  });

  const handleSave = () => {
    if (!form.name || !form.type || !form.address || !form.capacity) {
      setToast({ message: 'Please fill all fields', type: 'error' });
      return;
    }
    if (editing) {
      setLocations(locations.map(l => l.id === editing.id ? { ...editing, ...form } : l));
      setToast({ message: 'Location updated!', type: 'success' });
    } else {
      const newLoc = { id: generateId(), ...form };
      setLocations([...locations, newLoc]);
      setToast({ message: 'Location added!', type: 'success' });
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this location?')) {
      setLocations(locations.filter(l => l.id !== id));
      setToast({ message: 'Location deleted.', type: 'error' });
    }
  };

  const openEdit = (l) => {
    setEditing(l);
    setForm({ name: l.name, type: l.type, address: l.address, capacity: l.capacity, status: l.status, resources: l.resources });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', type: '', address: '', capacity: '', status: 'Active', resources: 0 });
  };

  const getTypeIcon = (type) => {
    if (type === 'Warehouse') return <Warehouse size={16} className="text-blue-600" />;
    if (type === 'Medical') return <Building size={16} className="text-emerald-600" />;
    if (type === 'Evacuation') return <Home size={16} className="text-amber-600" />;
    return <MapPin size={16} className="text-purple-600" />;
  };
  const getTypeBadge = (type) => {
    const classes = { Warehouse: 'badge bg-blue-50 text-blue-700', Medical: 'badge bg-emerald-50 text-emerald-700', Evacuation: 'badge bg-amber-50 text-amber-700', Distribution: 'badge bg-purple-50 text-purple-700' };
    return <span className={classes[type] || 'badge'}>{type}</span>;
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div><h1 className="page-title">Locations</h1><p className="page-subtitle">Manage and track all operational locations</p></div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowModal(true)}><Plus size={16} /> Add Location</button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Total</p><p className="text-2xl font-bold text-slate-800">{locations.length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Warehouses</p><p className="text-2xl font-bold text-blue-600">{locations.filter(l => l.type === 'Warehouse').length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Distribution</p><p className="text-2xl font-bold text-amber-600">{locations.filter(l => l.type === 'Distribution').length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Medical</p><p className="text-2xl font-bold text-emerald-600">{locations.filter(l => l.type === 'Medical').length}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search locations..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm" />
        </div>
        <div className="relative">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm bg-white">
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Address</th><th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Resources</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-center">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No locations</td></tr>
              ) : (
                filtered.map(l => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">{getTypeIcon(l.type)}</div><span className="font-medium text-slate-800">{l.name}</span></div></td>
                    <td className="px-4 py-3">{getTypeBadge(l.type)}</td>
                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5"><MapPin size={14} className="text-slate-400 flex-shrink-0" /><span className="truncate max-w-[150px]">{l.address}</span></td>
                    <td className="px-4 py-3 text-slate-600">{l.capacity}</td>
                    <td className="px-4 py-3"><span className="font-medium text-slate-800">{l.resources}</span><span className="text-xs text-slate-400 ml-1">items</span></td>
                    <td className="px-4 py-3"><span className="badge badge-available">Active</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openEdit(l)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors" title="Edit"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Location' : 'Add Location'}>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><label className="label">Type</label>
            <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="">Select</option>
              {['Warehouse','Medical','Evacuation','Distribution'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">Address</label><input className="input-field" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div><label className="label">Capacity</label><input className="input-field" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
          <div><label className="label">Resources (number)</label><input type="number" className="input-field" value={form.resources} onChange={e => setForm({...form, resources: Number(e.target.value)})} /></div>
          <button onClick={handleSave} className="btn-primary w-full">Save</button>
        </div>
      </Modal>
    </div>
  );
}
import { useState } from 'react';
import { Users, UserPlus, Search, Edit, Trash2, Mail, Phone, MapPin, User, Shield, Plus, Filter } from 'lucide-react';
import { initialTeam, generateId } from '../mockData';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

export default function TeamManagement() {
  const [team, setTeam] = useState(initialTeam);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', role: '', email: '', phone: '', location: '', status: 'Active' });
  const [toast, setToast] = useState(null);

  const roles = ['All', 'Admin', 'Team Lead', 'Coordinator', 'Volunteer'];
  const statuses = ['Active', 'Inactive'];

  const filtered = team.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'All' || m.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleSave = () => {
    if (!form.name || !form.email || !form.phone || !form.location) {
      setToast({ message: 'Please fill all fields', type: 'error' });
      return;
    }
    if (editing) {
      setTeam(team.map(m => m.id === editing.id ? { ...editing, ...form } : m));
      setToast({ message: 'Member updated!', type: 'success' });
    } else {
      const newMember = { id: generateId(), ...form, joined: new Date().toISOString().split('T')[0] };
      setTeam([...team, newMember]);
      setToast({ message: 'Member added!', type: 'success' });
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this member?')) {
      setTeam(team.filter(m => m.id !== id));
      setToast({ message: 'Member removed.', type: 'error' });
    }
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name, role: m.role, email: m.email, phone: m.phone, location: m.location, status: m.status });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', role: '', email: '', phone: '', location: '', status: 'Active' });
  };

  const getRoleBadge = (role) => {
    const classes = { Admin: 'badge bg-purple-50 text-purple-700', 'Team Lead': 'badge bg-blue-50 text-blue-700', Coordinator: 'badge bg-amber-50 text-amber-700', Volunteer: 'badge bg-emerald-50 text-emerald-700' };
    return <span className={classes[role] || 'badge'}>{role}</span>;
  };
  const getStatusBadge = (status) => {
    return <span className={status === 'Active' ? 'badge badge-available' : 'badge bg-slate-100 text-slate-700'}>{status}</span>;
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div><h1 className="page-title">Team Management</h1><p className="page-subtitle">Manage volunteers and coordinate relief efforts</p></div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowModal(true)}><UserPlus size={16} /> Add Member</button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Total</p><p className="text-2xl font-bold text-slate-800">{team.length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Active</p><p className="text-2xl font-bold text-emerald-600">{team.filter(m => m.status === 'Active').length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Volunteers</p><p className="text-2xl font-bold text-blue-600">{team.filter(m => m.role === 'Volunteer').length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Team Leads</p><p className="text-2xl font-bold text-amber-600">{team.filter(m => m.role === 'Team Lead').length}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm" />
        </div>
        <div className="relative">
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm bg-white">
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Contact</th><th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium text-center">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No members</td></tr>
              ) : (
                filtered.map(m => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">{m.name.split(' ').map(n => n[0]).join('')}</div><span className="font-medium text-slate-800">{m.name}</span></div></td>
                    <td className="px-4 py-3">{getRoleBadge(m.role)}</td>
                    <td className="px-4 py-3"><div className="flex flex-col gap-0.5"><span className="text-slate-600 text-xs flex items-center gap-1"><Mail size={12} className="text-slate-400" />{m.email}</span><span className="text-slate-600 text-xs flex items-center gap-1"><Phone size={12} className="text-slate-400" />{m.phone}</span></div></td>
                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{m.location}</td>
                    <td className="px-4 py-3">{getStatusBadge(m.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{m.joined}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors" title="Edit"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Remove"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Member' : 'Add Member'}>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><label className="label">Role</label>
            <select className="input-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              {['Volunteer','Coordinator','Team Lead','Admin'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className="label">Email</label><input className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
          <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
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
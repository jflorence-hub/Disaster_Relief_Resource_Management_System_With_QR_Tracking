import { useState } from 'react';
import { QrCode, Scan, Plus, Search, Eye, Clock, CheckCircle, XCircle , Trash2} from 'lucide-react';
import { initialScans, generateId, initialResources } from '../mockData';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

export default function QRTracking() {
  const [scans, setScans] = useState(initialScans);
  const [search, setSearch] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanForm, setScanForm] = useState({ resource: '', scannedBy: '', location: '' });
  const [toast, setToast] = useState(null);

  const filtered = scans.filter(s => s.resource.toLowerCase().includes(search.toLowerCase()));

  const handleGenerateQR = () => {
    if (!selectedResource) return;
    const newScan = {
      id: generateId(),
      resource: selectedResource,
      scannedBy: 'Admin',
      location: 'Generated',
      status: 'Verified',
      time: new Date().toLocaleString(),
    };
    setScans([newScan, ...scans]);
    setToast({ message: 'QR Code generated for ' + selectedResource, type: 'success' });
    setShowQRModal(false);
    setSelectedResource('');
  };

  const handleScan = () => {
    if (!scanForm.resource || !scanForm.scannedBy || !scanForm.location) {
      setToast({ message: 'Please fill all fields', type: 'error' });
      return;
    }
    const newScan = {
      id: generateId(),
      ...scanForm,
      status: 'Verified',
      time: new Date().toLocaleString(),
    };
    setScans([newScan, ...scans]);
    setToast({ message: 'Scan recorded for ' + scanForm.resource, type: 'success' });
    setShowScanModal(false);
    setScanForm({ resource: '', scannedBy: '', location: '' });
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this scan record?')) {
      setScans(scans.filter(s => s.id !== id));
      setToast({ message: 'Scan record deleted.', type: 'error' });
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Verified') return <CheckCircle size={16} className="text-emerald-600" />;
    if (status === 'Pending') return <Clock size={16} className="text-amber-600" />;
    return <XCircle size={16} className="text-rose-600" />;
  };
  const getStatusBadge = (status) => {
    const classes = { Verified: 'badge badge-available', Pending: 'badge badge-low-stock', Failed: 'badge bg-rose-50 text-rose-700' };
    return <span className={classes[status] || 'badge'}>{status}</span>;
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">QR Tracking</h1>
          <p className="page-subtitle">Generate and scan QR codes for quick resource identification</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowQRModal(true)}>
            <Plus size={16} /> Generate QR
          </button>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setShowScanModal(true)}>
            <Scan size={16} /> Scan QR
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Total Scans</p><p className="text-2xl font-bold text-slate-800">{scans.length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Verified</p><p className="text-2xl font-bold text-emerald-600">{scans.filter(s => s.status === 'Verified').length}</p></div>
        <div className="stat-card"><p className="text-sm text-slate-500 font-medium">Pending / Failed</p><p className="text-2xl font-bold text-amber-600">{scans.filter(s => s.status !== 'Verified').length}</p></div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">Scan History</h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scans..." className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm w-48" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Resource</th><th className="px-4 py-3 font-medium">Scanned By</th>
              <th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium text-center">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No scan records</td></tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.resource}</td>
                    <td className="px-4 py-3 text-slate-600">{s.scannedBy}</td>
                    <td className="px-4 py-3 text-slate-600">{s.location}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5">{getStatusIcon(s.status)}{getStatusBadge(s.status)}</div></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.time}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate QR Modal */}
      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="Generate QR Code">
        <div className="space-y-3">
          <div><label className="label">Select Resource</label>
            <select className="input-field" value={selectedResource} onChange={e => setSelectedResource(e.target.value)}>
              <option value="">Choose...</option>
              {initialResources.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <button onClick={handleGenerateQR} className="btn-primary w-full">Generate</button>
        </div>
      </Modal>

      {/* Scan Modal */}
      <Modal isOpen={showScanModal} onClose={() => setShowScanModal(false)} title="Record Scan">
        <div className="space-y-3">
          <div><label className="label">Resource</label>
            <select className="input-field" value={scanForm.resource} onChange={e => setScanForm({...scanForm, resource: e.target.value})}>
              <option value="">Select</option>
              {initialResources.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div><label className="label">Scanned By</label><input className="input-field" value={scanForm.scannedBy} onChange={e => setScanForm({...scanForm, scannedBy: e.target.value})} placeholder="Name" /></div>
          <div><label className="label">Location</label><input className="input-field" value={scanForm.location} onChange={e => setScanForm({...scanForm, location: e.target.value})} placeholder="Location" /></div>
          <button onClick={handleScan} className="btn-primary w-full">Record Scan</button>
        </div>
      </Modal>
    </div>
  );
}
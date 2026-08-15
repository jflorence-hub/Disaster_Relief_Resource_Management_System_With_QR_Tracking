import { useState } from "react";
import {
  Truck,
  Plus,
  Search,
  Eye,
  CheckCircle,
  Clock,
  ChevronDown,
  Filter,
  MapPin,
  Calendar,
  User,
  Edit,
  Trash2,
} from "lucide-react";
import { initialDistributions, generateId } from "../mockData";
import Modal from "../components/Modal";
import Toast from "../components/Toast";

export default function Distribution() {
  const [distributions, setDistributions] = useState(initialDistributions);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    resource: "",
    quantity: "",
    location: "",
    assignedTo: "",
    status: "Pending",
    date: "",
  });
  const [toast, setToast] = useState(null);

  const statuses = ["All", "Completed", "In Progress", "Pending"];

  const filtered = distributions.filter((d) => {
    const matchSearch =
      d.resource.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSave = () => {
    if (
      !form.resource ||
      !form.quantity ||
      !form.location ||
      !form.assignedTo
    ) {
      setToast({ message: "Please fill all fields", type: "error" });
      return;
    }
    if (editing) {
      setDistributions(
        distributions.map((d) =>
          d.id === editing.id ? { ...editing, ...form } : d,
        ),
      );
      setToast({ message: "Distribution updated!", type: "success" });
    } else {
      const newD = {
        id: generateId(),
        ...form,
        date: new Date().toISOString().split("T")[0],
      };
      setDistributions([...distributions, newD]);
      setToast({ message: "Distribution added!", type: "success" });
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this distribution?")) {
      setDistributions(distributions.filter((d) => d.id !== id));
      setToast({ message: "Distribution deleted.", type: "error" });
    }
  };

  const openEdit = (d) => {
    setEditing(d);
    setForm({
      resource: d.resource,
      quantity: d.quantity,
      location: d.location,
      assignedTo: d.assignedTo,
      status: d.status,
      date: d.date,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({
      resource: "",
      quantity: "",
      location: "",
      assignedTo: "",
      status: "Pending",
      date: "",
    });
  };

  const getStatusBadge = (status) => {
    const classes = {
      Completed: "badge badge-available",
      "In Progress": "badge badge-low-stock",
      Pending: "badge bg-slate-100 text-slate-700",
    };
    return <span className={classes[status] || "badge"}>{status}</span>;
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Distribution</h1>
          <p className="page-subtitle">
            Coordinate and track resource distribution
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-1.5"
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} /> New Distribution
        </button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-sm text-slate-500 font-medium">Total</p>
          <p className="text-2xl font-bold text-slate-800">
            {distributions.length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-slate-500 font-medium">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">
            {distributions.filter((d) => d.status === "Completed").length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-slate-500 font-medium">In Progress</p>
          <p className="text-2xl font-bold text-amber-600">
            {distributions.filter((d) => d.status === "In Progress").length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-slate-500 font-medium">Pending</p>
          <p className="text-2xl font-bold text-slate-600">
            {distributions.filter((d) => d.status === "Pending").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by resource or location..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm bg-white"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Quantity</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Assigned To</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No distributions
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {d.resource}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{d.quantity}</td>
                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" />
                      {d.location}
                    </td>
                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5">
                      <User size={14} className="text-slate-400" />
                      {d.assignedTo}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(d.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 flex items-center gap-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      {d.date}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(d)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? "Edit Distribution" : "New Distribution"}
      >
        <div className="space-y-3">
          <div>
            <label className="label">Resource</label>
            <input
              className="input-field"
              value={form.resource}
              onChange={(e) => setForm({ ...form, resource: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Quantity</label>
            <input
              className="input-field"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input-field"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Assigned To</label>
            <input
              className="input-field"
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <button onClick={handleSave} className="btn-primary w-full">
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

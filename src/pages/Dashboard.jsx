import { useNavigate } from "react-router-dom";
import {
  Package,
  QrCode,
  Truck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ChevronRight,
  Eye,
  Plus,
  FileText,
  Users,
} from "lucide-react";
import {
  mockStats,
  mockActivities,
  initialResources as mockResources,
  categoryData,
} from "../mockData";

export default function Dashboard() {
  const navigate = useNavigate();
  const getStatusBadge = (status) => {
    const classes = {
      Available: "badge badge-available",
      "Low Stock": "badge badge-low-stock",
      Reserved: "badge badge-reserved",
      Distributed: "badge badge-distributed",
    };
    return <span className={classes[status] || "badge"}>{status}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, Admin! Here's what's happening today.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/resources")}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} /> Add Resource
          </button>
          <button
            onClick={() => navigate("/qr-tracking")}
            className="btn-secondary flex items-center gap-1.5"
          >
            <QrCode size={16} /> Generate QR
          </button>
          <button
            onClick={() => navigate("/reports")}
            className="btn-secondary flex items-center gap-1.5"
          >
            <FileText size={16} /> Generate Report
          </button>
          <button
            onClick={() => navigate("/team")}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Users size={16} /> Manage Team
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {mockStats.map((stat, idx) => {
          const Icon =
            { Package, QrCode, Truck, AlertTriangle }[stat.icon] || Package;
          const colorClasses = {
            blue: "bg-blue-50 text-blue-600",
            emerald: "bg-emerald-50 text-emerald-600",
            amber: "bg-amber-50 text-amber-600",
            rose: "bg-rose-50 text-rose-600",
          };
          return (
            <div key={idx} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-800 mt-0.5">
                    {stat.value}
                  </p>
                </div>
                <div className={`stat-icon ${colorClasses[stat.color]}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs font-medium">
                {stat.trend === "up" ? (
                  <TrendingUp size={14} className="text-emerald-600" />
                ) : (
                  <TrendingDown size={14} className="text-rose-600" />
                )}
                <span
                  className={
                    stat.trend === "up" ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {stat.change}
                </span>
                <span className="text-slate-400">from last week</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & Activities (same as before but using mockData) */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="card lg:col-span-1">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">
            Inventory Status
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Available</span>
                <span className="font-medium text-slate-800">80%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: "80%" }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Reserved</span>
                <span className="font-medium text-slate-800">12%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: "12%" }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Distributed</span>
                <span className="font-medium text-slate-800">8%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: "8%" }}
                ></div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Total</span>
              <span className="font-bold text-slate-800">100%</span>
            </div>
          </div>
        </div>
        <div className="card lg:col-span-1">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">
            Resource Categories
          </h3>
          <div className="space-y-2.5">
            {categoryData.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${cat.color}`}></div>
                  <span className="text-sm text-slate-600">{cat.name}</span>
                </div>
                <span className="text-sm font-medium text-slate-800">
                  {cat.count} items
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card lg:col-span-1">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">
            Distribution Progress
          </h3>
          <div className="flex items-end justify-between h-32 gap-3">
            {["Jan", "Feb", "Mar", "Apr", "May"].map((month, idx) => {
              const heights = [65, 80, 55, 90, 70];
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div
                    className="w-full max-w-[40px] rounded-lg bg-blue-500 hover:bg-blue-600 transition-all duration-200"
                    style={{ height: `${heights[idx]}%` }}
                  ></div>
                  <span className="text-xs text-slate-500">{month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-sm">
              Recent Activities
            </h3>
            <button className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {mockActivities.map((activity, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                <div>
                  <p className="text-sm text-slate-700">{activity.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-sm">
              Recent Resource Inventory
            </h3>
            <button className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Resource</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Quantity</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">QR Code</th>
                  <th className="pb-2 font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {mockResources.slice(0, 5).map((resource, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 font-medium text-slate-800">
                      {resource.name}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {resource.category}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {resource.quantity}
                    </td>
                    <td className="py-2.5">
                      {getStatusBadge(resource.status)}
                    </td>
                    <td className="py-2.5">
                      <button className="text-blue-600 hover:text-blue-700 font-medium text-xs flex items-center gap-1">
                        <Eye size={14} /> View
                      </button>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {resource.lastUpdated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

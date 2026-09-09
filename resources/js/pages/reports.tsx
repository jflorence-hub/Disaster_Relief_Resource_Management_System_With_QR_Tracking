import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { AlertTriangle, Download, MapPin, Package, QrCode, Truck, Users } from 'lucide-react';

interface Summary {
    total_resources: number;
    total_locations: number;
    total_distributions: number;
    total_beneficiaries: number;
    low_stock_count: number;
    total_scans: number;
}

interface CategoryRow {
    category: string;
    total: number;
    quantity: number;
}

interface MonthRow {
    month: string;
    total_quantity: number;
    beneficiaries: number;
}

interface LocationRow {
    id: number;
    name: string;
    city: string;
    resources_count: number;
    resources_sum_quantity: number | null;
}

interface LowStockRow {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    minimum_threshold: number;
    location?: { name: string } | null;
}

interface ScanTypeRow {
    scan_type: string;
    total: number;
}

export default function Reports({
    summary,
    resourcesByCategory,
    distributionsByMonth,
    resourcesByLocation,
    lowStock,
    scansByType,
}: {
    summary: Summary;
    resourcesByCategory: CategoryRow[];
    distributionsByMonth: MonthRow[];
    resourcesByLocation: LocationRow[];
    lowStock: LowStockRow[];
    scansByType: ScanTypeRow[];
}) {
    const maxCategoryQty = Math.max(1, ...resourcesByCategory.map((c) => c.quantity));

    const cards = [
        { label: 'Total Resource Units', value: summary.total_resources.toLocaleString(), icon: Package, color: 'bg-blue-50 text-blue-600' },
        { label: 'Locations', value: summary.total_locations, icon: MapPin, color: 'bg-purple-50 text-purple-600' },
        { label: 'Completed Distributions', value: summary.total_distributions, icon: Truck, color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Beneficiaries Served', value: summary.total_beneficiaries.toLocaleString(), icon: Users, color: 'bg-blue-50 text-blue-600' },
        { label: 'QR Scans', value: summary.total_scans, icon: QrCode, color: 'bg-purple-50 text-purple-600' },
        { label: 'Low Stock Items', value: summary.low_stock_count, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
    ];

    const exports = [
        { href: '/reports/export/inventory', label: 'Inventory Report' },
        { href: '/reports/export/distributions', label: 'Distribution Report' },
        { href: '/reports/export/qr-scans', label: 'QR Tracking Report' },
    ];

    return (
        <AppLayout title="Reports" subtitle="Aggregate insights across operations">
            <Head title="Reports" />

            <div className="mb-6 flex flex-wrap gap-3">
                {exports.map((e) => (
                    <a key={e.href} href={e.href} className="btn-outline flex items-center gap-2 bg-white">
                        <Download size={16} /> Export {e.label} (CSV)
                    </a>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {cards.map((c) => (
                    <div key={c.label} className="stat-card flex items-center gap-3">
                        <div className={`stat-icon ${c.color}`}>
                            <c.icon size={18} />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-slate-800">{c.value}</p>
                            <p className="text-xs text-slate-500">{c.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="card">
                    <h2 className="mb-4 font-semibold text-slate-800">Resources by Category</h2>
                    <div className="space-y-3">
                        {resourcesByCategory.map((c) => (
                            <div key={c.category}>
                                <div className="mb-1 flex justify-between text-xs text-slate-500">
                                    <span className="capitalize">{c.category}</span>
                                    <span>{c.quantity.toLocaleString()} units</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="h-full rounded-full bg-blue-500"
                                        style={{ width: `${(c.quantity / maxCategoryQty) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h2 className="mb-4 font-semibold text-slate-800">Distributions by Month</h2>
                    {distributionsByMonth.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">No completed distributions yet.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {distributionsByMonth.map((m) => (
                                <li key={m.month} className="flex items-center justify-between py-2.5 text-sm">
                                    <span className="text-slate-600">{m.month}</span>
                                    <span className="text-slate-800">
                                        {m.total_quantity} units · {m.beneficiaries} beneficiaries
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="card lg:col-span-1">
                    <h2 className="mb-4 font-semibold text-slate-800">QR Scans by Type</h2>
                    <ul className="divide-y divide-slate-100">
                        {scansByType.map((s) => (
                            <li key={s.scan_type} className="flex items-center justify-between py-2.5 text-sm">
                                <span className="capitalize text-slate-600">{s.scan_type.replace('_', ' ')}</span>
                                <span className="font-medium text-slate-800">{s.total}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card lg:col-span-1">
                    <h2 className="mb-4 font-semibold text-slate-800">Resources by Location</h2>
                    <ul className="divide-y divide-slate-100">
                        {resourcesByLocation.map((l) => (
                            <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                                <div>
                                    <p className="font-medium text-slate-800">{l.name}</p>
                                    <p className="text-xs text-slate-400">{l.city}</p>
                                </div>
                                <span className="text-right text-slate-600">
                                    {l.resources_count} items
                                    <br />
                                    {(l.resources_sum_quantity ?? 0).toLocaleString()} units
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card lg:col-span-1">
                    <h2 className="mb-4 font-semibold text-slate-800">Low Stock Watchlist</h2>
                    {lowStock.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">Everything is well-stocked.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {lowStock.map((r) => (
                                <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                                    <div>
                                        <p className="font-medium text-slate-800">{r.name}</p>
                                        <p className="text-xs text-slate-400">{r.location?.name ?? 'Unassigned'}</p>
                                    </div>
                                    <span className="badge badge-red">
                                        {r.quantity}/{r.minimum_threshold} {r.unit}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

import AppLayout from '@/layouts/app-layout';
import { Distribution, Location, QrScan, ResourceItem } from '@/types/models';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, MapPin, Package, Plus, QrCode, ScanLine, Truck, Users } from 'lucide-react';
import { useEffect } from 'react';

interface Stats {
    total_resources: number;
    total_families: number;
    total_resource_quantity: number;
    total_locations: number;
    low_stock_count: number;
    pending_distributions: number;
    completed_distributions: number;
    household_member_served: number;
    total_scans: number;
    active_team_members: number;
}

export default function Dashboard({
    stats,
    recentDistributions,
    recentScans,
    lowStockResources,
    userRole,
    staffContext,
}: {
    stats: Stats;
    recentDistributions: Distribution[];
    recentScans: QrScan[];
    lowStockResources: (ResourceItem & { location?: Location })[];
    userRole: string;
    staffContext?: { location: string | null; hasPurok: boolean; purok: string | null } | null;
}) {
    // Poll so stats/scans/low-stock reflect scans recorded from the mobile app.
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['stats', 'recentScans', 'lowStockResources'] });
        }, 20000);

        return () => clearInterval(interval);
    }, []);

    const cards = [
        { label: 'Total Resources', value: stats.total_resources.toLocaleString(), icon: Package, color: 'bg-blue-50 text-blue-600' },
        { label: 'Total Stock Quantity', value: (stats.total_resource_quantity ?? 0).toLocaleString(), icon: Package, color: 'bg-indigo-50 text-indigo-600' },
        ...(userRole === 'admin' ? [{ label: 'Registered Families', value: stats.total_families ?? 0, icon: Users, color: 'bg-cyan-50 text-cyan-600' }] : []),
        ...(userRole === 'admin' ? [{ label: 'Locations', value: stats.total_locations, icon: MapPin, color: 'bg-purple-50 text-purple-600' }] : []),
        { label: 'Low Stock Items', value: stats.low_stock_count, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
        { label: 'Pending / In Transit', value: stats.pending_distributions, icon: Truck, color: 'bg-slate-100 text-slate-600' },
        { label: 'Completed Distributions', value: stats.completed_distributions, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Household Member Served', value: stats.household_member_served.toLocaleString(), icon: Users, color: 'bg-blue-50 text-blue-600' },
        { label: 'QR Scans Logged', value: stats.total_scans.toLocaleString(), icon: QrCode, color: 'bg-purple-50 text-purple-600' },
        ...(userRole === 'admin' ? [{ label: 'Active Team Members', value: stats.active_team_members, icon: Users, color: 'bg-emerald-50 text-emerald-600' }] : []),
    ];

    const quickActions = [
        ...(userRole === 'admin' ? [{ href: '/resources', label: 'Add Resource', icon: Plus }] : []),
        { href: '/qr-tracking', label: 'Scan QR Code', icon: ScanLine },
        { href: '/reports', label: 'Generate Report', icon: Package },
        { href: '/messages', label: 'Message Admin', icon: Users },
    ];

    return (
        <AppLayout title="Dashboard" subtitle="Overview of relief operations">
            <Head title="Dashboard" />

            {staffContext && <div className="card mb-6"><h2 className="text-lg font-semibold text-slate-800">My Assignment</h2><p className="mt-3 text-sm text-slate-500">Assigned Location</p><p className="font-medium text-slate-800">{staffContext.location ?? 'Not assigned'}</p><p className="mt-3 text-sm text-slate-500">Assigned Purok</p><p className="font-medium text-slate-800">{staffContext.hasPurok ? staffContext.purok ?? '' : 'Not assigned'}</p></div>}

            <div className="mb-6 flex flex-wrap gap-3">
                {quickActions.map((a) => (
                    <Link key={a.href} href={a.href} className="btn-outline flex items-center gap-2 bg-white">
                        <a.icon size={16} /> {a.label}
                    </Link>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((c) => (
                    <div key={c.label} className="stat-card flex items-center gap-4">
                        <div className={`stat-icon ${c.color}`}>
                            <c.icon size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">{c.value}</p>
                            <p className="text-sm text-slate-500">{c.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="card">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-800">Recent Distributions</h2>
                        <Link href="/distribution" className="text-sm text-blue-600 hover:underline">
                            View all
                        </Link>
                    </div>
                    {recentDistributions.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">No distributions yet.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {recentDistributions.map((d) => (
                                <li key={d.id} className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{d.recipient_name}</p>
                                        <p className="text-xs text-slate-500">
                                            {d.resource?.name} · {d.quantity} {d.resource?.unit}
                                        </p>
                                    </div>
                                    <span
                                        className={`badge ${d.status === 'completed' ? 'badge-green' : d.status === 'cancelled' ? 'badge-red' : 'badge-amber'} capitalize`}
                                    >
                                        {d.status.replace('_', ' ')}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="card">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-800">Recent QR Scans</h2>
                        <Link href="/qr-tracking" className="text-sm text-blue-600 hover:underline">
                            View all
                        </Link>
                    </div>
                    {recentScans.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">No scans yet.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {recentScans.map((s) => (
                                <li key={s.id} className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{s.resource?.name}</p>
                                        <p className="text-xs text-slate-500">by {s.scanner?.name ?? 'Unknown'}</p>
                                    </div>
                                    <span className="badge badge-blue capitalize">{s.scan_type.replace('_', ' ')}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="mt-6 card">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800">Low Stock Alerts</h2>
                    <Link href="/resources" className="text-sm text-blue-600 hover:underline">
                        Manage resources
                    </Link>
                </div>
                {lowStockResources.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">All resources are well-stocked.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {lowStockResources.map((r) => (
                            <li key={r.id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                                    <p className="text-xs text-slate-500">{r.location?.name ?? 'Unassigned'}</p>
                                </div>
                                <span className="badge badge-red">
                                    {r.quantity} {r.unit} left
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </AppLayout>
    );
}

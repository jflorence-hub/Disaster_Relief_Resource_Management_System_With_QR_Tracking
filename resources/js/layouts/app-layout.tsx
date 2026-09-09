import { Link, router, usePage } from '@inertiajs/react';
import {
    Bell,
    FileText,
    LayoutDashboard,
    LogOut,
    MapPin,
    Menu,
    Package,
    QrCode,
    Settings,
    Truck,
    Users,
    X,
} from 'lucide-react';
import { PropsWithChildren, useState } from 'react';
import type { AuthUser } from '@/types/models';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { href: '/resources', label: 'Resources', icon: Package, adminOnly: false },
    { href: '/qr-tracking', label: 'QR Tracking', icon: QrCode, adminOnly: false },
    { href: '/distribution', label: 'Distribution', icon: Truck, adminOnly: false },
    { href: '/locations', label: 'Locations', icon: MapPin, adminOnly: false },
    { href: '/reports', label: 'Reports', icon: FileText, adminOnly: false },
    { href: '/team', label: 'Team Management', icon: Users, adminOnly: true },
    { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

interface PageProps {
    auth: { user: AuthUser | null };
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function AppLayout({
    title,
    subtitle,
    children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
    const { props, url } = usePage<PageProps>();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const user = props.auth?.user;
    const isAdmin = user?.role === 'admin';

    const handleLogout = () => {
        router.post('/logout');
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <aside
                className={`fixed inset-y-0 left-0 z-50 border-r border-slate-200 bg-white transition-all duration-300 ${sidebarOpen ? 'w-[240px]' : 'w-[72px]'}`}
            >
                <div className="flex h-full flex-col">
                    <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                                DR
                            </div>
                            {sidebarOpen && (
                                <span className="whitespace-nowrap text-sm font-bold text-slate-800">
                                    Disaster Relief
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="flex-shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                        >
                            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                    <nav className="flex-1 overflow-y-auto px-3 py-4">
                        <ul className="space-y-1">
                            {navItems
                                .filter((item) => !item.adminOnly || isAdmin)
                                .map((item) => {
                                    const isActive = url.startsWith(item.href);
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                className={`sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-0' : ''}`}
                                                title={!sidebarOpen ? item.label : ''}
                                            >
                                                <item.icon size={20} className="flex-shrink-0" />
                                                {sidebarOpen && <span>{item.label}</span>}
                                            </Link>
                                        </li>
                                    );
                                })}
                        </ul>
                    </nav>
                    <div className="border-t border-slate-200 p-3">
                        <button
                            onClick={handleLogout}
                            className={`sidebar-link w-full ${!sidebarOpen ? 'justify-center px-0' : ''}`}
                            title={!sidebarOpen ? 'Logout' : ''}
                        >
                            <LogOut size={20} className="flex-shrink-0 text-red-500" />
                            {sidebarOpen && <span className="text-red-500">Logout</span>}
                        </button>
                    </div>
                </div>
            </aside>

            <div
                className={`flex flex-1 flex-col transition-all duration-300 ${sidebarOpen ? 'ml-[240px]' : 'ml-[72px]'}`}
            >
                <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
                        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                            <Bell size={20} />
                        </button>
                        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                                {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <div className="hidden text-left sm:block">
                                <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                                <p className="text-xs capitalize text-slate-500">{user?.role}</p>
                            </div>
                        </div>
                    </div>
                </header>

                {props.flash?.success && (
                    <div className="mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                        {props.flash.success}
                    </div>
                )}
                {props.flash?.error && (
                    <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                        {props.flash.error}
                    </div>
                )}

                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    );
}

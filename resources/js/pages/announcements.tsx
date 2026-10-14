import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { Megaphone, Send, Users, House } from 'lucide-react';
import { useState } from 'react';

interface Announcement {
    id: number;
    title: string;
    body: string;
    audience: 'family' | 'staff';
    sent_by: number | null;
    sender?: { name: string } | null;
    created_at: string;
}

interface FormData {
    title: string;
    body: string;
    audience: 'family' | 'staff';
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function Announcements({
    announcements,
    userRole,
}: {
    announcements: Announcement[];
    userRole: string;
}) {
    const [activeTab, setActiveTab] = useState<'family' | 'staff'>('family');

    const form = useForm<FormData>({
        title: '',
        body: '',
        audience: activeTab,
    });

    const switchTab = (tab: 'family' | 'staff') => {
        setActiveTab(tab);
        form.setData('audience', tab);
        form.clearErrors();
    };

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        form.post('/announcements', {
            onSuccess: () => {
                form.reset('title', 'body');
            },
        });
    };

    const tabAnnouncements = announcements.filter((a) => a.audience === activeTab);

    return (
        <AppLayout title="Announcements" subtitle="Send announcements to families or staff">
            <Head title="Announcements" />

            {/* TAB BAR */}
            <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
                <button
                    type="button"
                    onClick={() => switchTab('family')}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'family'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <House size={15} />
                    For Families
                </button>
                <button
                    type="button"
                    onClick={() => switchTab('staff')}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'staff'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Users size={15} />
                    For Staff
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* COMPOSE CARD */}
                {userRole === 'admin' && (
                    <div className="card">
                        <div className="mb-4 flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Megaphone size={18} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-800">
                                    New Announcement
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {activeTab === 'family'
                                        ? 'This announcement will be sent to all registered families.'
                                        : 'This announcement will be sent to all staff members.'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={submit} className="space-y-4">
                            {/* Hidden audience */}
                            <input type="hidden" value={form.data.audience} />

                            {/* TITLE */}
                            <div>
                                <label className="label">Title</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Announcement title…"
                                    value={form.data.title}
                                    onChange={(e) => form.setData('title', e.target.value)}
                                    required
                                    maxLength={255}
                                />
                                {form.errors.title && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.title}</p>
                                )}
                            </div>

                            {/* BODY */}
                            <div>
                                <label className="label">Message</label>
                                <textarea
                                    className="input-field min-h-[100px]"
                                    placeholder="Write your announcement here…"
                                    value={form.data.body}
                                    onChange={(e) => form.setData('body', e.target.value)}
                                    required
                                    rows={4}
                                />
                                {form.errors.body && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.body}</p>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    className="btn-primary flex items-center gap-2"
                                    disabled={form.processing}
                                >
                                    <Send size={15} />
                                    {form.processing ? 'Sending…' : 'Send Announcement'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ANNOUNCEMENT LIST */}
                <div className={userRole === 'admin' ? '' : 'lg:col-span-2'}>
                    <div className="card">
                        <h2 className="mb-4 font-semibold text-slate-800">
                            Past Announcements
                            {tabAnnouncements.length > 0 && (
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                                    {tabAnnouncements.length}
                                </span>
                            )}
                        </h2>

                        {tabAnnouncements.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                                <Megaphone size={36} strokeWidth={1.2} />
                                <p className="text-sm">
                                    No announcements for{' '}
                                    {activeTab === 'family' ? 'families' : 'staff'} yet.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {tabAnnouncements.map((a) => (
                                    <li key={a.id} className="py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-800">{a.title}</p>
                                                <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                                                    {a.body}
                                                </p>
                                                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                                                    <span>
                                                        by {a.sender?.name ?? 'Admin'}
                                                    </span>
                                                    <span>·</span>
                                                    <span>{formatDate(a.created_at)}</span>
                                                </div>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                    a.audience === 'family'
                                                        ? 'bg-orange-50 text-orange-700'
                                                        : 'bg-blue-50 text-blue-700'
                                                }`}
                                            >
                                                {a.audience === 'family' ? 'Families' : 'Staff'}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

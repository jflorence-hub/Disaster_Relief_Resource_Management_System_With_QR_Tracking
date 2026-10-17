import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';
import { Megaphone, Send, Users, House, Globe, MapPin } from 'lucide-react';
import { useState } from 'react';

interface Announcement {
    id: number;
    title: string;
    body: string;
    audience: 'family' | 'staff' | 'everyone' | 'barangay';
    location_id: number | null;
    location?: { id: number; name: string } | null;
    sent_by: number | null;
    sender?: { name: string } | null;
    created_at: string;
}

interface FormData {
    title: string;
    body: string;
    audience: 'family' | 'staff' | 'everyone' | 'barangay';
    location_id: string;
}

type AudienceTab = 'all' | 'family' | 'staff' | 'everyone' | 'barangay';

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

const audienceBadge: Record<Announcement['audience'], { label: string; cls: string }> = {
    everyone: { label: 'Everyone',  cls: 'bg-green-50 text-green-700' },
    staff:    { label: 'Staff',     cls: 'bg-blue-50 text-blue-700' },
    family:   { label: 'Families',  cls: 'bg-orange-50 text-orange-700' },
    barangay: { label: 'Barangay',  cls: 'bg-purple-50 text-purple-700' },
};

export default function Announcements({
    announcements,
    userRole,
    locations = [],
}: {
    announcements: Announcement[];
    userRole: string;
    locations: { id: number; name: string }[];
}) {
    const [activeTab, setActiveTab] = useState<AudienceTab>('all');

    const form = useForm<FormData>({
        title: '',
        body: '',
        audience: 'everyone',
        location_id: '',
    });

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        form.post('/announcements', {
            onSuccess: () => form.reset('title', 'body'),
        });
    };

    const tabAnnouncements = activeTab === 'all'
        ? announcements
        : announcements.filter((a) => a.audience === activeTab);

    const tabs: { key: AudienceTab; label: string; icon: React.ReactNode }[] = [
        { key: 'all',      label: 'All',      icon: <Megaphone size={14} /> },
        { key: 'everyone', label: 'Everyone', icon: <Globe size={14} /> },
        { key: 'staff',    label: 'Staff',    icon: <Users size={14} /> },
        { key: 'family',   label: 'Families', icon: <House size={14} /> },
        { key: 'barangay', label: 'Barangay', icon: <MapPin size={14} /> },
    ];

    return (
        <AppLayout title="Announcements" subtitle="Send announcements to families or staff">
            <Head title="Announcements" />

            {/* TAB BAR */}
            <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            activeTab === t.key
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                        <span className="ml-0.5 text-xs opacity-70">
                            {t.key === 'all' ? announcements.length : announcements.filter(a => a.audience === t.key).length}
                        </span>
                    </button>
                ))}
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
                                <h2 className="font-semibold text-slate-800">New Announcement</h2>
                                <p className="text-xs text-slate-500">Send to everyone, staff, families, or a specific barangay.</p>
                            </div>
                        </div>

                        <form onSubmit={submit} className="space-y-4">
                            {/* AUDIENCE */}
                            <div>
                                <label className="label">Target Audience</label>
                                <select
                                    className="input-field"
                                    value={form.data.audience}
                                    onChange={(e) => form.setData('audience', e.target.value as FormData['audience'])}
                                >
                                    <option value="everyone">Everyone (staff + families)</option>
                                    <option value="staff">Staff only</option>
                                    <option value="family">Families only</option>
                                    <option value="barangay">Specific Barangay</option>
                                </select>
                                {form.errors.audience && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.audience}</p>
                                )}
                            </div>

                            {/* BARANGAY DROPDOWN (shown only when audience = barangay) */}
                            {form.data.audience === 'barangay' && (
                                <div>
                                    <label className="label">Barangay</label>
                                    <select
                                        className="input-field"
                                        value={form.data.location_id}
                                        onChange={(e) => form.setData('location_id', e.target.value)}
                                        required
                                    >
                                        <option value="">Select barangay…</option>
                                        {locations.map((l) => (
                                            <option key={l.id} value={String(l.id)}>{l.name}</option>
                                        ))}
                                    </select>
                                    {form.errors.location_id && (
                                        <p className="mt-1 text-xs text-red-600">{form.errors.location_id}</p>
                                    )}
                                </div>
                            )}

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
                            {activeTab === 'all' ? 'All Announcements' : `${tabs.find(t => t.key === activeTab)?.label} Announcements`}
                            {tabAnnouncements.length > 0 && (
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                                    {tabAnnouncements.length}
                                </span>
                            )}
                        </h2>

                        {tabAnnouncements.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                                <Megaphone size={36} strokeWidth={1.2} />
                                <p className="text-sm">No announcements here yet.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {tabAnnouncements.map((a) => (
                                    <li key={a.id} className="py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-800">{a.title}</p>
                                                <p className="mt-1 text-sm text-slate-600 line-clamp-2">{a.body}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                    <span>by {a.sender?.name ?? 'Admin'}</span>
                                                    <span>·</span>
                                                    <span>{formatDate(a.created_at)}</span>
                                                    {a.audience === 'barangay' && a.location?.name && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="text-purple-600">{a.location.name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${audienceBadge[a.audience].cls}`}>
                                                {audienceBadge[a.audience].label}
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
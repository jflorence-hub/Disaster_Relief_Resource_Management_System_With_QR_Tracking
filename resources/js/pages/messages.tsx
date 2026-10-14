import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { House, MessageCircle, Send, Users } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

type Person = { id: number; name: string; role?: string };
type Message = {
    id: number;
    sender_id: number;
    recipient_id: number;
    message: string;
    created_at: string;
    sender?: Person;
    recipient?: Person;
};
type FamilyMessage = {
    id: number;
    family_id: number;
    public_family_id: string;
    family_name: string;
    head_name: string;
    sender_type: string;
    message: string;
    created_at: string;
};
type FamilyOption = { id: number; family_id: string; family_name: string };

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByDate<T extends { created_at: string }>(items: T[]): { label: string; items: T[] }[] {
    const groups: { label: string; items: T[] }[] = [];
    let lastLabel = '';
    items.forEach((item) => {
        const label = formatDate(item.created_at);
        if (label !== lastLabel) {
            groups.push({ label, items: [] });
            lastLabel = label;
        }
        groups[groups.length - 1].items.push(item);
    });
    return groups;
}

// ──────────────────────────────────────────────
// BUBBLE
// ──────────────────────────────────────────────

function Bubble({ text, time, isSelf, name }: { text: string; time: string; isSelf: boolean; name?: string }) {
    return (
        <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[72%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isSelf && name && (
                    <span className="ml-1 text-xs font-medium text-slate-500">{name}</span>
                )}
                <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isSelf
                            ? 'rounded-br-sm bg-blue-600 text-white'
                            : 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200'
                    }`}
                >
                    {text}
                </div>
                <span className="mx-1 text-xs text-slate-400">{time}</span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────
// DATE DIVIDER
// ──────────────────────────────────────────────

function DateDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 py-2">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-400">{label}</span>
            <div className="h-px flex-1 bg-slate-100" />
        </div>
    );
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────

export default function Messages({
    messages,
    staff = [],
    admin,
    userRole,
    familyMessages = [],
    families = [],
}: {
    messages: Message[];
    staff?: Person[];
    admin: Person | null;
    userRole: string;
    familyMessages?: FamilyMessage[];
    families?: FamilyOption[];
}) {
    // For admin: selected staff id (string) or 'family:{id}' for family tabs
    // For staff: 'staff' (single thread with admin)
    const [activeTab, setActiveTab] = useState<string>(() => {
        if (userRole === 'admin' && staff.length > 0) return String(staff[0].id);
        return 'staff';
    });

    const form = useForm<{ message: string; staff_id: string; family_id: string }>(
        { message: '', staff_id: userRole === 'admin' && staff.length > 0 ? String(staff[0].id) : '', family_id: '' },
    );

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const familyEndRef   = useRef<HTMLDivElement>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeTab]);
    useEffect(() => { familyEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [familyMessages, activeTab]);

    useEffect(() => {
        const t = setInterval(() => router.reload({ only: ['messages', 'familyMessages'] }), 10000);
        return () => clearInterval(t);
    }, []);

    // ── Determine what's shown ──

    const isFamilyTab = activeTab.startsWith('family:');
    const selectedFamilyId = isFamilyTab ? activeTab.replace('family:', '') : '';
    const selectedStaffId  = !isFamilyTab && activeTab !== 'staff' ? activeTab : (activeTab === 'staff' ? '' : '');
    const isStaffTab = !isFamilyTab;

    // Filter staff messages to only the selected staff thread (for admin)
    const visibleMessages = userRole === 'admin' && selectedStaffId
        ? messages.filter(
            (m) =>
                (String(m.sender_id) === selectedStaffId || String(m.recipient_id) === selectedStaffId)
          )
        : messages;

    const staffGroups = groupByDate(visibleMessages);

    // Family thread
    const selectedFamily = families.find((f) => String(f.id) === selectedFamilyId);
    const familyThread   = familyMessages.filter((m) => String(m.family_id) === selectedFamilyId);
    const familyGroups   = groupByDate(familyThread);

    // Only show families that have at least one message
    const familiesWithMessages = families.filter((f) =>
        familyMessages.some((m) => String(m.family_id) === String(f.id))
    );

    // Submit
    const submitStaff = (e: FormEvent) => {
        e.preventDefault();
        form.post('/messages', { onSuccess: () => form.reset('message') });
    };
    const submitFamily = (e: FormEvent) => {
        e.preventDefault();
        form.post('/messages', { onSuccess: () => form.reset('message') });
    };

    const selectStaff = (staffId: string) => {
        setActiveTab(staffId);
        form.setData('staff_id', staffId);
        form.setData('family_id', '');
        form.reset('message');
    };

    const selectFamily = (familyId: string) => {
        setActiveTab(`family:${familyId}`);
        form.setData('family_id', familyId);
        form.setData('staff_id', '');
        form.reset('message');
    };

    // Last message preview per staff member
    const lastStaffMessage = (staffId: number) => {
        const thread = messages.filter(
            (m) => String(m.sender_id) === String(staffId) || String(m.recipient_id) === String(staffId)
        );
        return thread[thread.length - 1];
    };

    return (
        <AppLayout title="Messages" subtitle="Conversations">
            <Head title="Messages" />

            <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                {/* ── LEFT SIDEBAR ── */}
                <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-100">
                    <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conversations</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">

                        {/* STAFF SIDE: single admin thread */}
                        {userRole === 'staff' && (
                            <button
                                type="button"
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${activeTab === 'staff' ? 'bg-blue-50' : ''}`}
                                onClick={() => setActiveTab('staff')}
                            >
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                    <Users size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className={`truncate text-sm font-medium ${activeTab === 'staff' ? 'text-blue-700' : 'text-slate-800'}`}>
                                        Admin — {admin?.name ?? 'Admin'}
                                    </p>
                                    <p className="truncate text-xs text-slate-400">
                                        {messages.length > 0
                                            ? messages[messages.length - 1].message.slice(0, 30) + (messages[messages.length - 1].message.length > 30 ? '…' : '')
                                            : 'No messages yet'}
                                    </p>
                                </div>
                            </button>
                        )}

                        {/* ADMIN SIDE: one entry per staff member */}
                        {userRole === 'admin' && (
                            <>
                                {staff.length === 0 && (
                                    <p className="px-4 py-3 text-xs text-slate-400">No staff members yet.</p>
                                )}

                                {familiesWithMessages.length > 0 && (
                                    <div className="border-t border-slate-100 px-4 py-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Staff</p>
                                    </div>
                                )}
                                {staff.map((s) => {
                                    const last = lastStaffMessage(s.id);
                                    const isActive = activeTab === String(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${isActive ? 'bg-blue-50' : ''}`}
                                            onClick={() => selectStaff(String(s.id))}
                                        >
                                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                                                {s.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`truncate text-sm font-medium ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>
                                                    {s.name}
                                                </p>
                                                <p className="truncate text-xs text-slate-400">
                                                    {last ? last.message.slice(0, 28) + (last.message.length > 28 ? '…' : '') : 'No messages yet'}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Divider before family section */}
                                {familiesWithMessages.length > 0 && (
                                    <div className="border-t border-slate-100 px-4 py-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Families</p>
                                    </div>
                                )}

                                {familiesWithMessages.map((f) => {
                                    const lastMsg = familyMessages.filter((m) => String(m.family_id) === String(f.id)).slice(-1)[0];
                                    const isActive = activeTab === `family:${f.id}`;
                                    return (
                                        <button
                                            key={f.id}
                                            type="button"
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${isActive ? 'bg-blue-50' : ''}`}
                                            onClick={() => selectFamily(String(f.id))}
                                        >
                                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                                <House size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`truncate text-sm font-medium ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>
                                                    {f.family_name}
                                                </p>
                                                <p className="truncate text-xs text-slate-400">
                                                    {lastMsg ? lastMsg.message.slice(0, 28) + (lastMsg.message.length > 28 ? '…' : '') : f.family_id}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </aside>

                {/* ── CHAT PANEL ── */}
                <div className="flex flex-1 flex-col overflow-hidden">

                    {/* ── STAFF / ADMIN THREAD ── */}
                    {isStaffTab && (
                        <>
                            {/* Header */}
                            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                                {userRole === 'admin' && selectedStaffId ? (
                                    <>
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                                            {(staff.find(s => String(s.id) === selectedStaffId)?.name ?? '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                {staff.find(s => String(s.id) === selectedStaffId)?.name ?? 'Staff'}
                                            </p>
                                            <p className="text-xs text-slate-400">Staff member</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                            <Users size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                Admin — {admin?.name ?? 'Admin'}
                                            </p>
                                            <p className="text-xs text-slate-400">Direct chat with administration</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4 space-y-1">
                                {staffGroups.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                                        <MessageCircle size={36} strokeWidth={1.2} />
                                        <p className="text-sm">No messages yet. Say hello!</p>
                                    </div>
                                ) : (
                                    staffGroups.map((group) => (
                                        <div key={group.label}>
                                            <DateDivider label={group.label} />
                                            <div className="space-y-2">
                                                {group.items.map((m) => {
                                                    const isSelf = userRole === 'admin'
                                                        ? m.sender?.role === 'admin'
                                                        : m.sender_id !== admin?.id;
                                                    return (
                                                        <Bubble
                                                            key={m.id}
                                                            text={m.message}
                                                            time={formatTime(m.created_at)}
                                                            isSelf={isSelf}
                                                            name={isSelf ? undefined : m.sender?.name}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Compose */}
                            <form onSubmit={submitStaff} className="flex items-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
                                <textarea
                                    className="input-field min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
                                    placeholder={
                                        userRole === 'admin'
                                            ? `Message ${staff.find(s => String(s.id) === selectedStaffId)?.name ?? 'staff'}…`
                                            : 'Write a message to admin…'
                                    }
                                    rows={1}
                                    value={form.data.message}
                                    onChange={(e) => form.setData('message', e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitStaff(e as unknown as FormEvent); }
                                    }}
                                    required
                                    maxLength={5000}
                                />
                                <button
                                    type="submit"
                                    className="btn-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full p-0"
                                    disabled={form.processing || (userRole === 'admin' && !form.data.staff_id)}
                                    title="Send"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── FAMILY THREAD ── */}
                    {isFamilyTab && selectedFamily && (
                        <>
                            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                    <House size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{selectedFamily.family_name}</p>
                                    <p className="text-xs text-slate-400">{selectedFamily.family_id} · Family App conversation</p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4 space-y-1">
                                {familyGroups.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                                        <MessageCircle size={36} strokeWidth={1.2} />
                                        <p className="text-sm">No messages from this family yet.</p>
                                    </div>
                                ) : (
                                    familyGroups.map((group) => (
                                        <div key={group.label}>
                                            <DateDivider label={group.label} />
                                            <div className="space-y-2">
                                                {group.items.map((m) => (
                                                    <Bubble
                                                        key={m.id}
                                                        text={m.message}
                                                        time={formatTime(m.created_at)}
                                                        isSelf={m.sender_type === 'admin'}
                                                        name={m.sender_type !== 'admin' ? m.family_name : undefined}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={familyEndRef} />
                            </div>

                            <form onSubmit={submitFamily} className="flex items-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
                                <textarea
                                    className="input-field min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
                                    placeholder={`Reply to ${selectedFamily.family_name}…`}
                                    rows={1}
                                    value={form.data.message}
                                    onChange={(e) => form.setData('message', e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitFamily(e as unknown as FormEvent); }
                                    }}
                                    required
                                    maxLength={5000}
                                />
                                <button
                                    type="submit"
                                    className="btn-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full p-0"
                                    disabled={form.processing}
                                    title="Send"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </>
                    )}

                    {/* Empty state when no tab is active */}
                    {!isStaffTab && !selectedFamily && (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                            <MessageCircle size={40} strokeWidth={1} />
                            <p className="text-sm">Select a conversation</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

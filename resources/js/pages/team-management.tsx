import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEventHandler } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import type { Location, PendingStaff, TeamMember } from '@/types/models';

const roles = ['admin', 'staff'];
const statuses = ['active', 'on_leave', 'inactive'];
const staffBirthdateMax = (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
})();

const roleBadge: Record<string, string> = {
    admin: 'badge-purple',
    staff: 'badge-blue',
};

const statusBadge: Record<string, string> = {
    active: 'badge-green',
    on_leave: 'badge-amber',
    inactive: 'badge-slate',
    pending: 'badge-amber',
};

interface FormData {
    name: string;
    email: string;
    password: string;
    role: string;
    phone: string;
    status: string;
    location_id: string;
    purok_id: string;
    birthdate: string;
    home_address: string;
}

const emptyForm: FormData = {
    name: '',
    email: '',
    password: '',
    role: 'staff',
    phone: '',
    status: 'active',
    location_id: '',
    purok_id: '',
    birthdate: '',
    home_address: '',
};

type PurokOption = {
    id: number;
    name: string;
    code: string;
    location_id: number | null;
    assigned_staff_id: number | null;
};

export default function TeamManagement({
    members,
    locations,
    puroks,
    pendingStaff,
}: {
    members: TeamMember[];
    locations: Location[];
    puroks: PurokOption[];
    pendingStaff: PendingStaff[];
}) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<TeamMember | null>(null);
    const [deleting, setDeleting] = useState<TeamMember | null>(null);
    const [filterLocation, setFilterLocation] = useState<string>('');
    const [approvingStaff, setApprovingStaff] = useState<PendingStaff | null>(
        null,
    );
    const [approveSelectedPurokId, setApproveSelectedPurokId] =
        useState<string>('');
    const [rejectingStaff, setRejectingStaff] = useState<PendingStaff | null>(
        null,
    );
    const [rejectionReason, setRejectionReason] = useState('');
    const [approveLoading, setApproveLoading] = useState(false);
    const [rejectLoading, setRejectLoading] = useState(false);

    const form = useForm<FormData>(emptyForm);

    const formPuroks = useMemo(() => {
        if (!form.data.location_id) {
            return [];
        }

        return puroks
            .filter(
                (p) =>
                    String(p.location_id) === form.data.location_id &&
                    /^Purok [1-7]$/.test(p.name),
            )
            .sort((a, b) => Number(a.name.slice(6)) - Number(b.name.slice(6)));
    }, [puroks, form.data.location_id]);

    // Filter + sort by purok_id ascending when a location is selected
    const visibleMembers = useMemo(() => {
        if (!filterLocation) return members;
        return members
            .filter(
                (m) =>
                    m.location_id !== null &&
                    String(m.location_id) === filterLocation,
            )
            .slice()
            .sort((a, b) => (a.purok_id ?? 0) - (b.purok_id ?? 0));
    }, [members, filterLocation]);

    const openCreate = () => {
        setEditing(null);
        form.setData({ ...emptyForm });
        setShowForm(true);
    };

    const openEdit = (member: TeamMember) => {
        setEditing(member);
        form.setData({
            name: member.name,
            email: member.email,
            password: '',
            role: member.role,
            phone: member.phone ?? '',
            status: member.status,
            location_id: member.location_id ? String(member.location_id) : '',
            purok_id: member.purok_id ? String(member.purok_id) : '',
            birthdate: member.birthdate ?? '',
            home_address: member.home_address ?? '',
        });
        setShowForm(true);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (editing) {
            form.put(`/team/${editing.id}`, {
                onSuccess: () => setShowForm(false),
            });
        } else {
            form.post('/team', { onSuccess: () => setShowForm(false) });
        }
    };

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/team/${deleting.id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    const submitApprove = () => {
        if (!approvingStaff) return;
        setApproveLoading(true);
        router.post(
            `/team/${approvingStaff.id}/approve`,
            { purok_id: approveSelectedPurokId || null },
            {
                onFinish: () => {
                    setApproveLoading(false);
                    setApprovingStaff(null);
                    setApproveSelectedPurokId('');
                },
            },
        );
    };

    const submitReject = () => {
        if (!rejectingStaff) return;
        setRejectLoading(true);
        router.post(
            `/team/${rejectingStaff.id}/reject`,
            { rejection_reason: rejectionReason },
            {
                onFinish: () => {
                    setRejectLoading(false);
                    setRejectingStaff(null);
                    setRejectionReason('');
                },
            },
        );
    };

    return (
        <AppLayout
            title="Team Management"
            subtitle="Personnel accounts, roles, and assignments"
        >
            <Head title="Team Management" />

            <div className="mb-4 flex items-center justify-between gap-3">
                <select
                    className="input-field w-64"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                >
                    <option value="">All Locations</option>
                    {locations.map((l) => (
                        <option key={l.id} value={String(l.id)}>
                            {l.name}
                        </option>
                    ))}
                </select>
                <button
                    className="btn-primary flex items-center gap-2"
                    onClick={openCreate}
                >
                    <Plus size={16} /> Add Member
                </button>
            </div>

            {/* Pending Registrations Section */}
            <div className="card mb-6 overflow-hidden p-0">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-700">
                        Pending Registrations
                    </h2>
                    <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {pendingStaff.length}
                    </span>
                </div>
                {pendingStaff.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">
                        No pending registrations.
                    </p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                                <th className="px-4 py-3">Name / Email</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Location</th>
                                <th className="px-4 py-3">Requested Purok</th>
                                <th className="px-4 py-3">Preferred Puroks</th>
                                <th className="px-4 py-3">Registered On</th>
                                <th className="px-4 py-3 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingStaff.map((m) => (
                                <tr
                                    key={m.id}
                                    className="border-b border-slate-50 hover:bg-slate-50"
                                >
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-slate-800">
                                            {m.name}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {m.email}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {m.phone ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {m.location?.name ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {m.purok?.name ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {m.preferred_purok_ids &&
                                        m.preferred_purok_ids.length > 0 ? (
                                            puroks
                                                .filter((p) =>
                                                    m.preferred_purok_ids!.includes(
                                                        p.id,
                                                    ),
                                                )
                                                .map((p) => p.name)
                                                .join(', ') || '—'
                                        ) : (
                                            <span className="text-slate-400">
                                                Any
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {new Date(
                                            m.created_at,
                                        ).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                                                onClick={() => {
                                                    setApprovingStaff(m);
                                                    const preferred =
                                                        m.preferred_purok_ids ??
                                                        [];
                                                    const available = puroks
                                                        .filter(
                                                            (p) =>
                                                                String(
                                                                    p.location_id,
                                                                ) ===
                                                                    String(
                                                                        m.location_id,
                                                                    ) &&
                                                                /^Purok [1-7]$/.test(
                                                                    p.name,
                                                                ) &&
                                                                p.assigned_staff_id ===
                                                                    null,
                                                        )
                                                        .sort(
                                                            (a, b) =>
                                                                Number(
                                                                    a.name.slice(
                                                                        6,
                                                                    ),
                                                                ) -
                                                                Number(
                                                                    b.name.slice(
                                                                        6,
                                                                    ),
                                                                ),
                                                        );
                                                    const selected =
                                                        available.find(
                                                            (p) =>
                                                                p.id ===
                                                                m.purok_id,
                                                        ) ??
                                                        available.find((p) =>
                                                            preferred.includes(
                                                                p.id,
                                                            ),
                                                        ) ??
                                                        (preferred.length === 0
                                                            ? available[0]
                                                            : undefined);
                                                    setApproveSelectedPurokId(
                                                        selected
                                                            ? String(
                                                                  selected.id,
                                                              )
                                                            : '',
                                                    );
                                                }}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                                                onClick={() => {
                                                    setRejectingStaff(m);
                                                    setRejectionReason('');
                                                }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Staff ID</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Purok</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleMembers.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    {filterLocation
                                        ? 'No team members at this location.'
                                        : 'No team members yet.'}
                                </td>
                            </tr>
                        )}
                        {visibleMembers.map((m) => (
                            <tr
                                key={m.id}
                                className="border-b border-slate-50 hover:bg-slate-50"
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                                            {m.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800">
                                                {m.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {m.email}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {m.staff_id ? (
                                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                                            {m.staff_id}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-300">
                                            —
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`badge ${roleBadge[m.role]} capitalize`}
                                    >
                                        {m.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {m.location?.name ?? '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {m.purok?.name ?? '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                    {m.phone ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`badge ${statusBadge[m.status]} capitalize`}
                                    >
                                        {m.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1.5">
                                        <button
                                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                            title="Edit"
                                            onClick={() => openEdit(m)}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        {m.status === 'active' && (
                                            <button
                                                className="rounded-lg px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                                                title="Deactivate"
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            `Deactivate "${m.name}"? Their purok will be freed.`,
                                                        )
                                                    ) {
                                                        router.put(
                                                            `/team/${m.id}`,
                                                            {
                                                                ...m,
                                                                status: 'inactive',
                                                                location_id:
                                                                    m.location_id ??
                                                                    '',
                                                                purok_id:
                                                                    m.purok_id ??
                                                                    '',
                                                                password: '',
                                                                birthdate:
                                                                    m.birthdate ??
                                                                    '',
                                                                home_address:
                                                                    m.home_address ??
                                                                    '',
                                                            },
                                                        );
                                                    }
                                                }}
                                            >
                                                Deactivate
                                            </button>
                                        )}
                                        <button
                                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                            title="Delete"
                                            onClick={() => setDeleting(m)}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title={editing ? 'Edit Member' : 'Add Team Member'}
                wide
            >
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {editing?.staff_id && (
                            <div className="sm:col-span-2">
                                <label className="label">Staff ID</label>
                                <div className="input-field flex cursor-not-allowed items-center gap-2 bg-slate-50 text-slate-500">
                                    <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-xs">
                                        {editing.staff_id}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        Auto-generated · read-only
                                    </span>
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="label">Full name</label>
                            <input
                                className="input-field"
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                            />
                            {form.errors.name && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.name}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={form.data.email}
                                onChange={(e) =>
                                    form.setData('email', e.target.value)
                                }
                            />
                            {form.errors.email && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.email}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="label">
                                {editing
                                    ? 'New password (optional)'
                                    : 'Password'}
                            </label>
                            <input
                                type="password"
                                className="input-field"
                                value={form.data.password}
                                onChange={(e) =>
                                    form.setData('password', e.target.value)
                                }
                            />
                            {form.errors.password && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.password}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="label">Phone</label>
                            <input
                                className="input-field"
                                value={form.data.phone}
                                onChange={(e) =>
                                    form.setData('phone', e.target.value)
                                }
                            />
                        </div>
                        <div>
                            <label className="label">System role</label>
                            <select
                                className="input-field"
                                value={form.data.role}
                                onChange={(e) => {
                                    const role = e.target.value;
                                    form.setData({
                                        ...form.data,
                                        role,
                                        purok_id:
                                            role === 'staff'
                                                ? form.data.purok_id
                                                : '',
                                    });
                                }}
                            >
                                {roles.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Status</label>
                            <select
                                className="input-field"
                                value={form.data.status}
                                onChange={(e) =>
                                    form.setData('status', e.target.value)
                                }
                            >
                                {statuses.map((s) => (
                                    <option key={s} value={s}>
                                        {s.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Assigned location</label>
                            <select
                                className="input-field"
                                value={form.data.location_id}
                                onChange={(e) => {
                                    form.setData({
                                        ...form.data,
                                        location_id: e.target.value,
                                        purok_id: '',
                                    });
                                }}
                            >
                                <option value="">Unassigned</option>

                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {form.data.role === 'staff' && (
                            <div>
                                <label className="label">Assigned Purok</label>
                                <select
                                    className="input-field"
                                    value={form.data.purok_id}
                                    onChange={(e) =>
                                        form.setData('purok_id', e.target.value)
                                    }
                                    disabled={!form.data.location_id}
                                >
                                    {!form.data.location_id && (
                                        <option value="">
                                            Select a location first
                                        </option>
                                    )}
                                    {form.data.location_id && (
                                        <option value="">Unassigned</option>
                                    )}
                                    {formPuroks.map((purok) => {
                                        const isOccupied =
                                            purok.assigned_staff_id !== null &&
                                            purok.assigned_staff_id !==
                                                editing?.id;

                                        return (
                                            <option
                                                key={purok.id}
                                                value={purok.id}
                                                disabled={isOccupied}
                                            >
                                                {purok.name}
                                                {isOccupied
                                                    ? ' — occupied'
                                                    : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                {form.errors.purok_id && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {form.errors.purok_id}
                                    </p>
                                )}
                            </div>
                        )}
                        <div>
                            <label className="label">
                                Date of birth
                                {form.data.role === 'staff'
                                    ? ' (required for staff)'
                                    : ''}
                            </label>
                            <input
                                type="date"
                                className="input-field"
                                max={
                                    form.data.role === 'staff'
                                        ? staffBirthdateMax
                                        : undefined
                                }
                                value={form.data.birthdate}
                                onChange={(e) =>
                                    form.setData('birthdate', e.target.value)
                                }
                                required={form.data.role === 'staff'}
                            />
                            {form.errors.birthdate && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.birthdate}
                                </p>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <label className="label">Home address</label>
                            <input
                                className="input-field"
                                placeholder="Street, Barangay, City"
                                value={form.data.home_address}
                                onChange={(e) =>
                                    form.setData('home_address', e.target.value)
                                }
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setShowForm(false)}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={form.processing}
                        >
                            {form.processing
                                ? 'Saving…'
                                : editing
                                  ? 'Save changes'
                                  : 'Add member'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                message={`Remove "${deleting?.name}" from the team? This deletes their login account.`}
            />

            {/* Approve Modal */}
            <Modal
                open={!!approvingStaff}
                onClose={() => setApprovingStaff(null)}
                title="Approve Registration"
            >
                {approvingStaff && (
                    <div className="space-y-4">
                        <div className="space-y-1 text-sm">
                            <p>
                                <span className="font-medium text-slate-700">
                                    Name:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {approvingStaff.name}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Email:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {approvingStaff.email}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Date of birth:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {approvingStaff.birthdate ?? '—'}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Home address:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {approvingStaff.home_address ?? '—'}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Location:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {approvingStaff.location?.name ?? '—'}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Requested Purok:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {approvingStaff.purok?.name ?? '—'}
                                </span>
                            </p>
                        </div>
                        <p className="text-sm text-slate-500">
                            On approval, this account becomes active and is
                            assigned to the requested purok and location.
                        </p>
                        {/* Purok assignment selector */}
                        <div>
                            <label className="label">Assign purok</label>
                            <select
                                className="input-field"
                                value={approveSelectedPurokId}
                                onChange={(e) =>
                                    setApproveSelectedPurokId(e.target.value)
                                }
                            >
                                <option value="">
                                    — No purok assignment —
                                </option>
                                {puroks
                                    .filter(
                                        (p) =>
                                            String(p.location_id) ===
                                                String(
                                                    approvingStaff.location_id,
                                                ) &&
                                            /^Purok [1-7]$/.test(p.name),
                                    )
                                    .sort(
                                        (a, b) =>
                                            Number(a.name.slice(6)) -
                                            Number(b.name.slice(6)),
                                    )
                                    .map((p) => {
                                        const isPreferred =
                                            approvingStaff.preferred_purok_ids?.includes(
                                                p.id,
                                            );

                                        const isOccupied =
                                            p.assigned_staff_id !== null;

                                        return (
                                            <option
                                                key={p.id}
                                                value={String(p.id)}
                                                disabled={isOccupied}
                                            >
                                                {p.name}
                                                {isPreferred
                                                    ? ' ★ preferred'
                                                    : ''}
                                                {isOccupied
                                                    ? ' — occupied'
                                                    : ''}
                                            </option>
                                        );
                                    })}
                            </select>
                            {approvingStaff.preferred_purok_ids &&
                                approvingStaff.preferred_purok_ids.length >
                                    0 && (
                                    <p className="mt-1 text-xs text-slate-400">
                                        Preferred:{' '}
                                        {puroks
                                            .filter(
                                                (p) =>
                                                    String(p.location_id) ===
                                                        String(
                                                            approvingStaff.location_id,
                                                        ) &&
                                                    /^Purok [1-7]$/.test(
                                                        p.name,
                                                    ) &&
                                                    approvingStaff.preferred_purok_ids!.includes(
                                                        p.id,
                                                    ),
                                            )
                                            .sort(
                                                (a, b) =>
                                                    Number(a.name.slice(6)) -
                                                    Number(b.name.slice(6)),
                                            )
                                            .map((p) => p.name)
                                            .join(', ')}
                                    </p>
                                )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setApprovingStaff(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                onClick={submitApprove}
                                disabled={approveLoading}
                            >
                                {approveLoading
                                    ? 'Approving…'
                                    : 'Confirm Approval'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Reject Modal */}
            <Modal
                open={!!rejectingStaff}
                onClose={() => {
                    setRejectingStaff(null);
                    setRejectionReason('');
                }}
                title="Reject Registration"
            >
                {rejectingStaff && (
                    <div className="space-y-4">
                        <div className="space-y-1 text-sm">
                            <p>
                                <span className="font-medium text-slate-700">
                                    Name:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {rejectingStaff.name}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Email:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {rejectingStaff.email}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Location:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {rejectingStaff.location?.name ?? '—'}
                                </span>
                            </p>
                            <p>
                                <span className="font-medium text-slate-700">
                                    Requested Purok:
                                </span>{' '}
                                <span className="text-slate-600">
                                    {rejectingStaff.purok?.name ?? '—'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <label htmlFor="rejection-reason" className="label">
                                Reason for rejection (will be sent to applicant)
                            </label>
                            <textarea
                                id="rejection-reason"
                                className="input-field min-h-[80px] w-full resize-y"
                                placeholder="Optional — leave blank for a generic rejection email"
                                value={rejectionReason}
                                onChange={(e) =>
                                    setRejectionReason(e.target.value)
                                }
                                maxLength={1000}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setRejectingStaff(null);
                                    setRejectionReason('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                onClick={submitReject}
                                disabled={rejectLoading}
                            >
                                {rejectLoading
                                    ? 'Rejecting…'
                                    : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </AppLayout>
    );
}

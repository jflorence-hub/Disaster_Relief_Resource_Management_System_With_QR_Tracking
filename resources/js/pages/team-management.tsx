import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Location, TeamMember } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

const roles = ['admin', 'staff'];
const statuses = ['active', 'on_leave', 'inactive'];

const roleBadge: Record<string, string> = {
    admin: 'badge-purple',
    staff: 'badge-blue',
};

const statusBadge: Record<string, string> = {
    active: 'badge-green',
    on_leave: 'badge-amber',
    inactive: 'badge-slate',
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
    responsibilities: string;
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
    responsibilities: '',
};

export default function TeamManagement({
    members,
    locations,
    puroks,
}: {
    members: TeamMember[];
    locations: Location[];
    puroks: { id: number; name: string; code: string }[];
}) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<TeamMember | null>(null);
    const [deleting, setDeleting] = useState<TeamMember | null>(null);

    const form = useForm<FormData>(emptyForm);

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
            responsibilities: member.responsibilities ?? '',
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

    return (
        <AppLayout
            title="Team Management"
            subtitle="Personnel accounts, roles, and assignments"
        >
            <Head title="Team Management" />

            <div className="mb-4 flex justify-end">
                <button
                    className="btn-primary flex items-center gap-2"
                    onClick={openCreate}
                >
                    <Plus size={16} /> Add Member
                </button>
            </div>

            <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Purok</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    No team members yet.
                                </td>
                            </tr>
                        )}
                        {members.map((m) => (
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
                                    {m.purok_id?? '—'}
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
                                            onClick={() => openEdit(m)}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
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
                                onChange={(e) =>
                                    form.setData('role', e.target.value)
                                }
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
                                onChange={(e) =>
                                    form.setData('location_id', e.target.value)
                                }
                            >
                                <option value="">Unassigned</option>

                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Assigned Purok</label>

                            <select
                                className="input-field"
                                value={form.data.purok_id}
                                onChange={(e) =>
                                    form.setData('purok_id', e.target.value)
                                }
                            >
                                <option value="">Unassigned</option>

                                {puroks.map((purok) => (
                                    <option key={purok.id} value={purok.id}>
                                        {purok.name}
                                    </option>
                                ))}
                            </select>

                            {form.errors.purok_id && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.purok_id}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="label">Responsibilities</label>
                            <input
                                className="input-field"
                                placeholder="e.g. Warehouse coordinator"
                                value={form.data.responsibilities}
                                onChange={(e) =>
                                    form.setData(
                                        'responsibilities',
                                        e.target.value,
                                    )
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
        </AppLayout>
    );
}

import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ChevronDown,
    Pencil,
    Plus,
    Search,
    Trash2,
    Users,
    UserCog,
} from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';

interface Purok {
    id: number;
    name: string;
    code?: string;
}

interface Family {
    id: number;
    family_id: string;
    family_name: string;
    head_name: string;
    phone?: string | null;
    beneficiary_count: number;
    address?: string | null;
    purok_id: number;
    pin?: string;
    status: string;
    purok?: Purok;
}
interface Staff {
    id: number;
    name: string;
    purok_id?: number | null;
}

interface FormData {
    family_id: string;
    family_name: string;
    head_name: string;
    phone: string;
    address: string;
    purok_id: string;
    pin: string;
    status: string;
    beneficiary_count: number | string;
}

const emptyForm: FormData = {
    family_id: '',
    family_name: '',
    head_name: '',
    phone: '',
    address: '',
    purok_id: '',
    pin: '',
    status: 'active',
    beneficiary_count: '',
};

const statusBadge: Record<string, string> = {
    active: 'badge-green',
    inactive: 'badge-slate',
};

export default function Families({
    families,
    puroks,
    staff = [],
}: {
    families: Family[];
    puroks: Purok[];
    staff: Staff[];
}) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Family | null>(null);
    const [deleting, setDeleting] = useState<Family | null>(null);
    const [search, setSearch] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');

    const form = useForm<FormData>(emptyForm);

    const filteredFamilies = useMemo(() => {
        const query = search.toLowerCase().trim();

        let result = families;

        // Filter by selected staff
        if (selectedStaffId) {
            const selectedStaff = staff.find(
                (member) => String(member.id) === selectedStaffId,
            );

            if (selectedStaff?.purok_id) {
                result = result.filter(
                    (family) => family.purok_id === selectedStaff.purok_id,
                );
            }
        }

        // Filter by search
        if (query) {
            result = result.filter((family) =>
                [
                    family.family_id,
                    family.family_name,
                    family.head_name,
                    family.phone,
                    family.address,
                    family.purok?.name,
                ]
                    .filter(Boolean)
                    .some((value) =>
                        String(value).toLowerCase().includes(query),
                    ),
            );
        }

        return result;
    }, [families, staff, search, selectedStaffId]);

    const openCreate = () => {
        setEditing(null);

        form.setData({
            ...emptyForm,
            family_id: `FAM-${String(families.length + 1).padStart(4, '0')}`,
        });

        setShowForm(true);
    };

    const openEdit = (family: Family) => {
        setEditing(family);

        form.setData({
            family_id: family.family_id,
            family_name: family.family_name,
            head_name: family.head_name,
            phone: family.phone ?? '',
            address: family.address ?? '',
            purok_id: String(family.purok_id),
            pin: '',
            status: family.status,
            beneficiary_count: family.beneficiary_count,
        });

        setShowForm(true);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        if (editing) {
            form.put(`/families/${editing.id}`, {
                onSuccess: () => {
                    setShowForm(false);
                    setEditing(null);
                },
            });
        } else {
            form.post('/families', {
                onSuccess: () => {
                    setShowForm(false);
                },
            });
        }
    };

    const confirmDelete = () => {
        if (!deleting) return;

        router.delete(`/families/${deleting.id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    return (
        <AppLayout
            title="Family Management"
            subtitle="Manage registered families and relief recipients"
        >
            <Head title="Family Management" />

            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Users size={18} />
                    <span>{filteredFamilies.length} registered families</span>
                </div>

                <div className="flex items-center justify-end gap-3">
                    <div className="relative">
                        <UserCog
                            size={18}
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
                        />

                        <select
                            className="input-field appearance-none pr-10 pl-10"
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                        >
                            <option value="">All Staff</option>

                            {staff.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name}
                                </option>
                            ))}
                        </select>

                        <ChevronDown
                            size={18}
                            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-500"
                        />
                    </div>

                    <button
                        className="btn-primary flex items-center justify-center gap-2"
                        onClick={openCreate}
                    >
                        <Plus size={16} />
                        Add Family
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search
                        size={17}
                        className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                    />

                    <input
                        className="input-field pl-10"
                        placeholder="Search family ID, family name, head, phone, or Purok..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Family table */}
            <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                            <th className="px-4 py-3">Family</th>
                            <th className="px-4 py-3">Head of Family</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Beneficiaries</th>
                            <th className="px-4 py-3">Purok</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredFamilies.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    {search
                                        ? 'No families found.'
                                        : 'No families registered yet.'}
                                </td>
                            </tr>
                        )}

                        {filteredFamilies.map((family) => (
                            <tr
                                key={family.id}
                                className="border-b border-slate-50 hover:bg-slate-50"
                            >
                                <td className="px-4 py-3">
                                    <div>
                                        <p className="font-medium text-slate-800">
                                            {family.family_name}
                                        </p>

                                        <p className="text-xs text-slate-400">
                                            ID: {family.family_id}
                                        </p>
                                    </div>
                                </td>

                                <td className="px-4 py-3 text-slate-600">
                                    {family.head_name}
                                </td>

                                <td className="px-4 py-3 text-slate-500">
                                    {family.phone || 'No cellphone'}
                                </td>

                                <td className="px-4 py-3 text-slate-600">
                                    {family.beneficiary_count}
                                </td>

                                <td className="px-4 py-3">
                                    <span className="badge badge-blue">
                                        {family.purok?.name ?? 'Unassigned'}
                                    </span>
                                </td>

                                <td className="px-4 py-3">
                                    <span
                                        className={`badge ${
                                            statusBadge[family.status] ??
                                            'badge-slate'
                                        } capitalize`}
                                    >
                                        {family.status}
                                    </span>
                                </td>

                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1.5">
                                        <button
                                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                            onClick={() => openEdit(family)}
                                            title="Edit family"
                                        >
                                            <Pencil size={15} />
                                        </button>

                                        <button
                                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                            onClick={() => setDeleting(family)}
                                            title="Delete family"
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

            {/* Add/Edit Family Modal */}
            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title={editing ? 'Edit Family' : 'Add Family'}
                wide
            >
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Family ID */}
                        <div>
                            <label className="label">Family ID</label>

                            <input
                                className="input-field"
                                value={form.data.family_id}
                                onChange={(e) =>
                                    form.setData('family_id', e.target.value)
                                }
                                placeholder="FAM-0001"
                            />

                            {form.errors.family_id && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.family_id}
                                </p>
                            )}
                        </div>

                        {/* Family Name */}
                        <div>
                            <label className="label">Family Name</label>

                            <input
                                className="input-field"
                                value={form.data.family_name}
                                onChange={(e) =>
                                    form.setData('family_name', e.target.value)
                                }
                                placeholder="e.g. Dela Cruz Family"
                            />

                            {form.errors.family_name && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.family_name}
                                </p>
                            )}
                        </div>

                        {/* Head */}
                        <div>
                            <label className="label">Head of Family</label>

                            <input
                                className="input-field"
                                value={form.data.head_name}
                                onChange={(e) =>
                                    form.setData('head_name', e.target.value)
                                }
                                placeholder="Full name"
                            />

                            {form.errors.head_name && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.head_name}
                                </p>
                            )}
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="label">Phone Number</label>

                            <input
                                className="input-field"
                                value={form.data.phone}
                                onChange={(e) =>
                                    form.setData('phone', e.target.value)
                                }
                                placeholder="Optional"
                            />

                            <p className="mt-1 text-xs text-slate-400">
                                Leave empty if the family has no cellphone.
                            </p>
                        </div>

                        {/* Beneficiary */}
                        <div>
                            <label className="label">Beneficiary count</label>
                            <input
                                type="number"
                                min={1}
                                className="input-field"
                                value={form.data.beneficiary_count}
                                onChange={(e) =>
                                    form.setData(
                                        'beneficiary_count',
                                        e.target.value,
                                    )
                                }
                            />
                        </div>

                        {/* Purok */}
                        <div>
                            <label className="label">Assigned Purok</label>

                            <select
                                className="input-field"
                                value={form.data.purok_id}
                                onChange={(e) =>
                                    form.setData('purok_id', e.target.value)
                                }
                            >
                                <option value="">Select Purok</option>

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

                        {/* Status */}
                        <div>
                            <label className="label">Status</label>

                            <select
                                className="input-field"
                                value={form.data.status}
                                onChange={(e) =>
                                    form.setData('status', e.target.value)
                                }
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        {/* Address */}
                        <div className="sm:col-span-2">
                            <label className="label">Address</label>

                            <input
                                className="input-field"
                                value={form.data.address}
                                onChange={(e) =>
                                    form.setData('address', e.target.value)
                                }
                                placeholder="Complete address"
                            />
                        </div>

                        {/* PIN */}
                        <div className="sm:col-span-2">
                            <label className="label">Family App PIN</label>

                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                className="input-field"
                                value={form.data.pin}
                                onChange={(e) =>
                                    form.setData(
                                        'pin',
                                        e.target.value.replace(/\D/g, ''),
                                    )
                                }
                                placeholder={
                                    editing
                                        ? 'Leave empty to keep current PIN'
                                        : 'Enter 4–6 digit PIN'
                                }
                            />

                            <p className="mt-1 text-xs text-slate-400">
                                Families can use their Family ID and PIN to
                                access the mobile app, even without a cellphone
                                number.
                            </p>

                            {form.errors.pin && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.pin}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Buttons */}
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
                                  ? 'Save Changes'
                                  : 'Add Family'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete confirmation */}
            <ConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                message={`Remove "${deleting?.family_name}" from the registered families? This will also affect their relief distribution records.`}
            />
        </AppLayout>
    );
}

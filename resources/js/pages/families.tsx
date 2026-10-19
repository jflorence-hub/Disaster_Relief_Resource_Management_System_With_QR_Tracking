import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronRight,
    Pencil,
    Plus,
    Search,
    Trash2,
    Users,
    UserCog,
    Minus,
    FileUp,
    QrCode,
    Check,
    X,
} from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface Purok {
    id: number;
    name: string;
    code?: string;
    location_id?: number | null;
}

interface Location {
    id: number;
    name: string;
    status: string;
    capacity?: number | null;
}

interface FamilyMember {
    id: number;
    household_member_number: number;
    name?: string | null;
}

interface Family {
    id: number;
    family_id: string;
    head_name: string;
    email?: string | null;
    phone?: string | null;
    qr_code: string;
    household_member: number | FamilyMember[];
    purok_id: number;
    location_id?: number | null;
    pin?: string;
    status: string;
    purok?: Purok;
    location?: Location;
    created_at?: string;
}

interface Staff {
    id: number;
    name: string;
    purok_id?: number | null;
}

interface FormData {
    head_name: string;
    email: string;
    phone: string;
    location_id: string;
    purok_id: string;
    pin: string;
    status: string;
    household_member: number | string;
    member_names: string[];
}

const emptyForm: FormData = {
    head_name: '',
    email: '',
    phone: '',
    location_id: '',
    purok_id: '',
    pin: '',
    status: 'active',
    household_member: '',
    member_names: [''],
};

const statusBadge: Record<string, string> = {
    active: 'badge-green',
    inactive: 'badge-slate',
};

// Row that can toggle to show household members
function FamilyRow({
    family,
    userRole,
    onEdit,
    onDelete,
    onViewQr,
}: {
    family: Family;
    userRole: string;
    onEdit: (f: Family) => void;
    onDelete: (f: Family) => void;
    onViewQr: (f: Family) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const members = family.household_member as unknown as
        FamilyMember[] | undefined;
    const memberCount = Array.isArray(members)
        ? members.length
        : (family.household_member as number);

    return (
        <>
            <tr className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3">
                    <div>
                        <p className="font-medium text-slate-800">
                            {family.family_id}
                        </p>
                    </div>
                </td>

                <td className="px-4 py-3 text-slate-600">{family.head_name}</td>

                <td className="px-4 py-3 text-slate-500">
                    {family.phone || 'No cellphone'}
                </td>

                <td className="px-4 py-3 text-slate-600">
                    <button
                        className="flex items-center gap-1 text-slate-600 hover:text-blue-600"
                        onClick={() => setExpanded((v) => !v)}
                        title="Show household members"
                    >
                        <span>{memberCount}</span>
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                            {memberCount}
                        </span>
                        {expanded ? (
                            <ChevronDown size={14} />
                        ) : (
                            <ChevronRight size={14} />
                        )}
                    </button>
                </td>

                <td className="px-4 py-3">
                    <span className="badge badge-blue">
                        {family.purok?.name ?? 'Unassigned'}
                    </span>
                </td>

                <td className="px-4 py-3">
                    <span className="badge badge-slate">
                        {family.location?.name ?? 'Unassigned'}
                    </span>
                </td>

                <td className="px-4 py-3">
                    <span
                        className={`badge ${
                            statusBadge[family.status] ?? 'badge-slate'
                        } capitalize`}
                    >
                        {family.status}
                    </span>
                </td>

                <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                        <button
                            type="button"
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                            onClick={() => onViewQr(family)}
                            title="View family QR code"
                            aria-label={`View QR code for ${family.head_name}`}
                        >
                            <QrCode size={15} />
                        </button>
                        {userRole === 'admin' && (
                            <>
                                <button
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                    onClick={() => onEdit(family)}
                                    title="Edit family"
                                >
                                    <Pencil size={15} />
                                </button>

                                <button
                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                    onClick={() => onDelete(family)}
                                    title="Delete family"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>

            {/* Expandable members row */}
            {expanded && (
                <tr className="border-b border-slate-50 bg-blue-50/40">
                    <td colSpan={8} className="px-6 py-3">
                        <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Household Members
                        </p>
                        {Array.isArray(members) && members.length > 0 ? (
                            <ul className="flex flex-wrap gap-2">
                                {members.map((m) => (
                                    <li
                                        key={m.id}
                                        className="rounded-full border border-slate-100 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm"
                                    >
                                        {m.household_member_number}.{' '}
                                        {m.name ??
                                            `Member #${m.household_member_number}`}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-slate-400">
                                No member names recorded.
                            </p>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

export default function Families({
    families,
    pendingFamilies = [],
    puroks,
    locations = [],
    allLocations = [],
    staff = [],
    userRole,
    filters = {},
}: {
    families: Family[];
    pendingFamilies?: Family[];
    puroks: Purok[];
    locations: Location[];
    allLocations: Location[];
    staff: Staff[];
    userRole: string;
    filters: Record<string, string>;
}) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Family | null>(null);
    const [deleting, setDeleting] = useState<Family | null>(null);
    const [qrFamily, setQrFamily] = useState<Family | null>(null);
    const [reviewingFamily, setReviewingFamily] = useState<Family | null>(null);
    const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>(
        'approve',
    );
    const [search, setSearch] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [filterLocationId, setFilterLocationId] = useState(
        filters.location_id ?? '',
    );

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
                    family.head_name,
                    family.email,
                    family.phone,
                    family.location?.name,
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
        form.setData({ ...emptyForm, member_names: [''] });
        setShowForm(true);
    };

    const openEdit = (family: Family) => {
        setEditing(family);
        const members = family.household_member as unknown as
            FamilyMember[] | undefined;
        const existingNames: string[] =
            Array.isArray(members) && members.length > 0
                ? members.map((m) => m.name ?? '')
                : [''];

        form.setData({
            head_name: family.head_name,
            email: family.email ?? '',
            phone: family.phone ?? '',
            location_id: family.location_id ? String(family.location_id) : '',
            purok_id: String(family.purok_id),
            pin: '',
            status: family.status,
            household_member: family.household_member as unknown as number,
            member_names: existingNames,
        });

        setShowForm(true);
    };

    const addMember = () => {
        form.setData('member_names', [...form.data.member_names, '']);
    };

    const removeMember = (index: number) => {
        const updated = form.data.member_names.filter((_, i) => i !== index);
        form.setData('member_names', updated.length > 0 ? updated : ['']);
    };

    const updateMember = (index: number, value: string) => {
        const updated = [...form.data.member_names];
        updated[index] = value;
        form.setData('member_names', updated);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        // Keep household_member in sync with member_names count
        const dataWithCount = {
            ...form.data,
            household_member: form.data.member_names.length,
        };
        form.setData(dataWithCount);

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

    const submitFamilyReview = () => {
        if (!reviewingFamily) return;

        router.post(
            `/families/${reviewingFamily.id}/${reviewAction}`,
            {},
            { onFinish: () => setReviewingFamily(null) },
        );
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

                <div className="flex flex-wrap items-center justify-end gap-3">
                    {/* Barangay filter — admin only */}
                    {userRole === 'admin' && (
                        <select
                            className="input-field w-48"
                            value={filterLocationId}
                            onChange={(e) =>
                                setFilterLocationId(e.target.value)
                            }
                        >
                            <option value="">All Barangays</option>
                            {allLocations.map((l) => (
                                <option key={l.id} value={String(l.id)}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Staff filter */}
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
                            {userRole === 'admin' && (
                                <option value="">All Staff</option>
                            )}
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

                    {/* Import button — admin only */}
                    {userRole === 'admin' && (
                        <button
                            className="btn-secondary flex items-center gap-2 text-sm"
                            onClick={() => router.visit('/families/import')}
                        >
                            <FileUp size={15} /> Import
                        </button>
                    )}

                    <button
                        className="btn-primary flex items-center justify-center gap-2"
                        onClick={openCreate}
                    >
                        <Plus size={16} />
                        Add Family
                    </button>
                </div>
            </div>

            {userRole === 'admin' && pendingFamilies.length > 0 && (
                <section className="card mb-4 overflow-hidden p-0">
                    <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
                        <h2 className="font-semibold text-amber-900">
                            Family registrations awaiting review
                        </h2>
                        <p className="mt-1 text-sm text-amber-800">
                            Verify the household details before approving
                            access.
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {pendingFamilies.map((family) => (
                            <div
                                key={family.id}
                                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800">
                                        {family.head_name}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {family.email} · {family.phone}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {family.location?.name ?? 'No barangay'}{' '}
                                        · {family.purok?.name ?? 'No Purok'} ·{' '}
                                        {Array.isArray(family.household_member)
                                            ? family.household_member.length
                                            : family.household_member}{' '}
                                        household members
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                                        onClick={() => {
                                            setReviewAction('approve');
                                            setReviewingFamily(family);
                                        }}
                                    >
                                        <Check size={15} /> Approve
                                    </button>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                        onClick={() => {
                                            setReviewAction('reject');
                                            setReviewingFamily(family);
                                        }}
                                    >
                                        <X size={15} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search
                        size={17}
                        className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                    />

                    <input
                        className="input-field pl-10"
                        placeholder="Search family ID, head, phone, email, location, or Purok..."
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
                            <th className="px-4 py-3">Family ID</th>
                            <th className="px-4 py-3">Head of Family</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Household Members</th>
                            <th className="px-4 py-3">Purok</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredFamilies.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    {search
                                        ? 'No families found.'
                                        : 'No families registered yet.'}
                                </td>
                            </tr>
                        )}

                        {filteredFamilies.map((family) => (
                            <FamilyRow
                                key={family.id}
                                family={family}
                                userRole={userRole}
                                onEdit={openEdit}
                                onDelete={setDeleting}
                                onViewQr={setQrFamily}
                            />
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

                        {/* Email */}
                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={form.data.email}
                                onChange={(e) =>
                                    form.setData('email', e.target.value)
                                }
                                placeholder="Optional"
                            />

                            {form.errors.email && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.email}
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

                        {/* Location */}
                        <div>
                            <label className="label">Location</label>

                            <select
                                className="input-field"
                                value={form.data.location_id}
                                onChange={(e) =>
                                    form.setData({
                                        ...form.data,
                                        location_id: e.target.value,
                                        purok_id: '',
                                    })
                                }
                            >
                                <option value="">Select Location</option>

                                {locations.map((location) => (
                                    <option
                                        key={location.id}
                                        value={location.id}
                                    >
                                        {location.name}
                                    </option>
                                ))}
                            </select>

                            {form.errors.location_id && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.location_id}
                                </p>
                            )}
                        </div>

                        {/* Purok */}
                        <div>
                            <label className="label">Assigned Purok</label>

                            <select
                                className="input-field"
                                value={form.data.purok_id}
                                disabled={!form.data.location_id}
                                onChange={(e) =>
                                    form.setData('purok_id', e.target.value)
                                }
                            >
                                <option value="">
                                    {form.data.location_id
                                        ? 'Select Purok'
                                        : 'Select Location first'}
                                </option>

                                {puroks
                                    .filter(
                                        (purok) =>
                                            String(purok.location_id) ===
                                            form.data.location_id,
                                    )
                                    .map((purok) => (
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
                                Families sign in with their email or phone
                                number and PIN.
                            </p>

                            {form.errors.pin && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.pin}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Household Members section */}
                    <div className="sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between">
                            <label className="label mb-0">
                                Household Members{' '}
                                <span className="font-normal text-slate-400">
                                    ({form.data.member_names.length})
                                </span>
                            </label>

                            <button
                                type="button"
                                className="btn-secondary flex items-center gap-1 py-1 text-xs"
                                onClick={addMember}
                            >
                                <Plus size={13} />
                                Add member
                            </button>
                        </div>

                        <div className="space-y-2">
                            {form.data.member_names.map((name, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2"
                                >
                                    <span className="w-6 shrink-0 text-center text-xs text-slate-400">
                                        {index + 1}.
                                    </span>

                                    <input
                                        className="input-field flex-1"
                                        value={name}
                                        onChange={(e) =>
                                            updateMember(index, e.target.value)
                                        }
                                        placeholder={`Member ${index + 1} full name`}
                                    />

                                    {form.data.member_names.length > 1 && (
                                        <button
                                            type="button"
                                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                                            onClick={() => removeMember(index)}
                                            title="Remove member"
                                        >
                                            <Minus size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {form.errors.member_names && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.member_names}
                            </p>
                        )}
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

            <Modal
                open={!!qrFamily}
                onClose={() => setQrFamily(null)}
                title="Family QR Code"
            >
                {qrFamily && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="rounded-xl border border-slate-100 p-4">
                            <QRCodeCanvas
                                value={qrFamily.qr_code}
                                size={200}
                                level="M"
                            />
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-slate-800">
                                {qrFamily.head_name}
                            </p>
                            <p className="text-xs text-slate-400">
                                {qrFamily.family_id}
                            </p>
                            <p className="text-xs text-slate-400">
                                {qrFamily.qr_code}
                            </p>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete confirmation */}
            <ConfirmDialog
                open={!!reviewingFamily}
                onClose={() => setReviewingFamily(null)}
                onConfirm={submitFamilyReview}
                title={
                    reviewAction === 'approve'
                        ? 'Approve family registration?'
                        : 'Reject family registration?'
                }
                message={
                    reviewAction === 'approve'
                        ? `Approve ${reviewingFamily?.head_name}'s registration? They will be able to sign in, and an acceptance email will be sent to ${reviewingFamily?.email}.`
                        : `Reject ${reviewingFamily?.head_name}'s registration? Their account will be inactive and a notification email will be sent.`
                }
                confirmLabel={reviewAction === 'approve' ? 'Approve' : 'Reject'}
            />
            <ConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                message={`Remove "${deleting?.head_name}" from the registered families? This will also affect their relief distribution records.`}
            />
        </AppLayout>
    );
}

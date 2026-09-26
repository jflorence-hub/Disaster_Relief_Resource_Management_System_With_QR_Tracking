import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Distribution, Location, ResourceItem } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ChevronDown,
    Download,
    Pencil,
    Plus,
    QrCode,
    Search,
    Trash2,
    Truck,
    UserCog,
} from 'lucide-react';
import {
    FormEventHandler,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const CATEGORY_LABELS: Record<string, string> = {
    food: 'Food',
    water: 'Drinks',
    medical: 'Medicine',
    clothing: 'Clothes',
    tools: 'Tool',
    hygiene: 'Hygiene',
    set: 'Set',
    shelter: 'Shelter',
    other: 'Other',
};

const CATEGORY_ORDER = [
    'food',
    'water',
    'medical',
    'clothing',
    'tools',
    'hygiene',
    'set',
    'shelter',
    'other',
];

interface FormData {
    resource_id: string;
    resource_category: string;
    additional_resource_id: string;
    additional_resource_category: string;
    has_additional: boolean;
    location_id: string;
    quantity: number | string;
    additional_quantity: number | string;
    recipient_name: string;
    recipient_contact: string;
    beneficiary_count: number | string;
    distribution_date: string;
    status: string;
    notes: string;
    family_id: string;
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
    status: string;
    purok?: {
        id: number;
        name: string;
    };
}

interface Staff {
    id: number;
    name: string;
    purok_id?: number | null;
}

const emptyForm: FormData = {
    resource_id: '',
    resource_category: '',
    additional_resource_id: '',
    additional_resource_category: '',
    has_additional: false,
    location_id: '',
    family_id: '',
    quantity: 1,
    additional_quantity: 1,
    recipient_name: '',
    recipient_contact: '',
    beneficiary_count: '',
    distribution_date: new Date().toISOString().slice(0, 16),
    status: 'pending',
    notes: '',
};

const statusBadge: Record<string, string> = {
    completed: 'badge-green',
    pending: 'badge-slate',
    in_transit: 'badge-amber',
    cancelled: 'badge-red',
};

export default function DistributionPage({
    distributions,
    resources,
    locations,
    filters,
    staff = [],
    families = [],
}: {
    distributions: Distribution[];
    resources: ResourceItem[];
    locations: Location[];
    filters: {
        search?: string;
        status?: string;
    };
    staff: Staff[];
    families: Family[];
}) {
    const [search, setSearch] = useState(filters.search ?? '');

    const [showForm, setShowForm] = useState(false);

    const [editing, setEditing] = useState<Distribution | null>(null);

    const [deleting, setDeleting] = useState<Distribution | null>(null);

    const [qrDistribution, setQrDistribution] =
        useState<Distribution | null>(null);

    const [selectedStaffId, setSelectedStaffId] = useState('');

    const qrRef = useRef<HTMLDivElement>(null);

    const form = useForm<FormData>(emptyForm);

    /*
    |--------------------------------------------------------------------------
    | Refresh families automatically
    |--------------------------------------------------------------------------
    |
    | This allows a newly registered family from the Families page to appear
    | on the Distribution page without manually refreshing the browser.
    |
    */

    useEffect(() => {
        const interval = window.setInterval(() => {
            router.reload({
                only: ['families', 'staff', 'resources']
            });
        }, 5000);

        return () => {
            window.clearInterval(interval);
        };
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Default Resource
    |--------------------------------------------------------------------------
    |
    | The distribution list should show "Set of Goods" as the default
    | resource. We look for it by name.
    |
    */

    const defaultResource = useMemo(() => {
        return (
            resources.find(
                (resource) =>
                    resource.name.trim().toLowerCase() === 'set of goods',
            ) ?? resources[0]
        );
    }, [resources]);

    /*
    |--------------------------------------------------------------------------
    | Families for selected Staff/Purok
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | Families are now the source of the Distribution list.
    |
    | If no staff is selected:
    |     show ALL active families.
    |
    | If a staff member is selected:
    |     show only families from that staff member's Purok.
    |
    */

    const availableFamilies = useMemo(() => {
        const activeFamilies = families.filter(
            (family) => family.status === 'active',
        );

        if (!selectedStaffId) {
            return activeFamilies;
        }

        const selectedStaff = staff.find(
            (member) => String(member.id) === selectedStaffId,
        );

        if (!selectedStaff?.purok_id) {
            return [];
        }

        return activeFamilies.filter(
            (family) => family.purok_id === selectedStaff.purok_id,
        );
    }, [families, staff, selectedStaffId]);

    /*
    |--------------------------------------------------------------------------
    | Search Families
    |--------------------------------------------------------------------------
    */


    const filteredFamilies = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return availableFamilies;
        }

        return availableFamilies.filter((family) => {
            return (
                family.family_name.toLowerCase().includes(query) ||
                family.family_id.toLowerCase().includes(query) ||
                family.head_name.toLowerCase().includes(query) ||
                family.purok?.name?.toLowerCase().includes(query)
            );
        });
    }, [availableFamilies, search]);

    /*
    |--------------------------------------------------------------------------
    | Filter Existing Distribution Records
    |--------------------------------------------------------------------------
    |
    | This is still used by the actual distribution history.
    |
    */

    const filteredDistributions = useMemo(() => {
        if (!selectedStaffId) {
            return distributions;
        }

        const selectedStaff = staff.find(
            (member) => String(member.id) === selectedStaffId,
        );

        if (!selectedStaff?.purok_id) {
            return [];
        }

        return distributions.filter(
            (distribution) =>
                distribution.family?.purok_id === selectedStaff.purok_id,
        );
    }, [distributions, staff, selectedStaffId]);

    /*
    |--------------------------------------------------------------------------
    | Resources
    |--------------------------------------------------------------------------
    */

    const resourcesByCategory = (category: string) =>
        resources.filter((r) => r.category === category);

    const availableCategories = CATEGORY_ORDER.filter(
        (category) => resourcesByCategory(category).length > 0,
    );

    /*
    |--------------------------------------------------------------------------
    | Open Create / Record Distribution
    |--------------------------------------------------------------------------
    */

    const openCreate = (family?: Family) => {
        setEditing(null);

        const resource = defaultResource;

        form.setData({
            ...emptyForm,

            family_id: family ? String(family.id) : '',

            resource_id: resource ? String(resource.id) : '',

            resource_category: resource?.category ?? '',

            quantity: 1,

            beneficiary_count: family?.beneficiary_count ?? '',

            recipient_name: family?.family_name ?? '',

            recipient_contact: family?.phone ?? '',

            distribution_date: new Date().toISOString().slice(0, 16),

            status: 'pending',
        });

        if (family?.purok_id) {
            const familyStaff = staff.find(
                (member) => member.purok_id === family.purok_id,
            );

            if (familyStaff) {
                setSelectedStaffId(String(familyStaff.id));
            }
        }

        setShowForm(true);
    };

    /*
    |--------------------------------------------------------------------------
    | Open Edit
    |--------------------------------------------------------------------------
    */

    const openEdit = (d: Distribution) => {
        setEditing(d);

        const primaryResource = resources.find(
            (r) => r.id === d.resource_id,
        );

        const additionalResource = d.additional_resource_id
            ? resources.find((r) => r.id === d.additional_resource_id)
            : undefined;

        /*
         * Find the staff assigned to this family's Purok.
         *
         * This allows the Family dropdown to show the correct
         * families when editing.
         */

        if (d.family?.purok_id) {
            const familyStaff = staff.find(
                (member) => member.purok_id === d.family?.purok_id,
            );

            if (familyStaff) {
                setSelectedStaffId(String(familyStaff.id));
            }
        }

        form.setData({
            resource_id: String(d.resource_id),

            resource_category: primaryResource?.category ?? '',

            additional_resource_id: d.additional_resource_id
                ? String(d.additional_resource_id)
                : '',

            additional_resource_category:
                additionalResource?.category ?? '',

            has_additional: !!d.additional_resource_id,

            location_id: d.location_id ? String(d.location_id) : '',

            family_id: d.family_id ? String(d.family_id) : '',

            quantity: d.quantity,

            additional_quantity: d.additional_quantity ?? 1,

            recipient_name: d.recipient_name ?? '',

            recipient_contact: d.recipient_contact ?? '',

            beneficiary_count: d.beneficiary_count ?? '',

            distribution_date: d.distribution_date.slice(0, 16),

            status: d.status,

            notes: d.notes ?? '',
        });

        setShowForm(true);
    };

    /*
    |--------------------------------------------------------------------------
    | Submit Actual Distribution Record
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | Families appearing in the table DOES NOT call this function.
    |
    | This function only runs when the user actually chooses
    | "Record Distribution".
    |
    */

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const payload = {
            family_id: form.data.family_id,

            resource_id: form.data.resource_id,

            location_id: form.data.location_id,

            quantity: form.data.quantity || 1,

            additional_resource_id: form.data.has_additional
                ? form.data.additional_resource_id
                : '',

            additional_quantity: form.data.has_additional
                ? form.data.additional_quantity
                : '',

            recipient_name: form.data.recipient_name,

            recipient_contact: form.data.recipient_contact,

            beneficiary_count: form.data.beneficiary_count,

            distribution_date: form.data.distribution_date,

            status: form.data.status,

            notes: form.data.notes,
        };

        form.transform(() => payload);

        if (editing) {
            form.put(`/distribution/${editing.id}`, {
                onSuccess: () => {
                    setShowForm(false);
                    setEditing(null);
                },
            });
        } else {
            form.post('/distribution', {
                onSuccess: () => {
                    setShowForm(false);
                },
            });
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Delete
    |--------------------------------------------------------------------------
    */

    const confirmDelete = () => {
        if (!deleting) return;

        router.delete(`/distribution/${deleting.id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    /*
    |--------------------------------------------------------------------------
    | Search
    |--------------------------------------------------------------------------
    |
    | Search is now handled locally for the family distribution list.
    | This means newly registered families can be searched immediately.
    |
    */

    const runSearch = (value: string) => {
        setSearch(value);
    };

    /*
    |--------------------------------------------------------------------------
    | QR Download
    |--------------------------------------------------------------------------
    */

    const downloadQr = () => {
        const canvas = qrRef.current?.querySelector('canvas');

        if (!canvas || !qrDistribution) return;

        const link = document.createElement('a');

        link.download = `${qrDistribution.qr_code ?? 'distribution'}-qr.png`;

        link.href = canvas.toDataURL('image/png');

        link.click();
    };

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <AppLayout
            title="Distribution"
            subtitle="Track supplies delivered to recipients"
        >
            <Head title="Distribution" />

            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search
                        className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                        size={16}
                    />

                    <input
                        className="input-field pl-9"
                        placeholder="Search family..."
                        value={search}
                        onChange={(e) => runSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center justify-end gap-3">
                    {/* Staff filter */}
                    <div className="relative">
                        <UserCog
                            size={18}
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
                        />

                        <select
                            className="input-field appearance-none pr-10 pl-10"
                            value={selectedStaffId}
                            onChange={(e) =>
                                setSelectedStaffId(e.target.value)
                            }
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
                </div>
            </div>

            {/* ========================================================= */}
            {/* REGISTERED FAMILIES / DISTRIBUTION QUEUE                 */}
            {/* ========================================================= */}

            <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-slate-800">
                            Families for Distribution
                        </h2>

                        <p className="text-xs text-slate-400">
                            Registered families automatically appear here.
                            No distribution record is created until a
                            distribution is actually recorded.
                        </p>
                    </div>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                        {filteredFamilies.length}{' '}
                        {filteredFamilies.length === 1
                            ? 'Family'
                            : 'Families'}
                    </span>
                </div>

                <div className="card overflow-x-auto p-0">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                                <th className="px-4 py-3">Family</th>

                                <th className="px-4 py-3">Head of Family</th>

                                <th className="px-4 py-3">Purok</th>

                                <th className="px-4 py-3">
                                    Beneficiaries
                                </th>

                                <th className="px-4 py-3 text-right">
                                    Action
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredFamilies.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-4 py-10 text-center text-slate-400"
                                    >
                                        No registered families found.
                                    </td>
                                </tr>
                            )}

                            {filteredFamilies.map((family) => (
                                <tr
                                    key={family.id}
                                    className="border-b border-slate-50 hover:bg-slate-50"
                                >
                                    {/* Family */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                                <Truck size={16} />
                                            </div>

                                            <div>
                                                <p className="font-medium text-slate-800">
                                                    {family.family_name}
                                                </p>

                                                <p className="text-xs text-slate-400">
                                                    {family.family_id}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Head */}
                                    <td className="px-4 py-3 text-slate-600">
                                        {family.head_name}
                                    </td>

                                    {/* Purok */}
                                    <td className="px-4 py-3 text-slate-600">
                                        {family.purok?.name ??
                                            `Purok ${family.purok_id}`}
                                    </td>

                                    {/* Beneficiaries */}
                                    <td className="px-4 py-3 text-slate-600">
                                        <span className="font-medium">
                                            {family.beneficiary_count}
                                        </span>
                                    </td>

                                    {/* Action */}
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                className="btn-primary flex items-center gap-2"
                                                onClick={() =>
                                                    openCreate(family)
                                                }
                                            >
                                                <Plus size={14} />
                                                Record
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================================= */}
            {/* ACTUAL DISTRIBUTION RECORDS / HISTORY                    */}
            {/* ========================================================= */}

            <div>
                <div className="mb-3">
                    <h2 className="text-base font-semibold text-slate-800">
                        Distribution Records
                    </h2>

                    <p className="text-xs text-slate-400">
                        Actual distributions that have been recorded.
                    </p>
                </div>

                <div className="card overflow-x-auto p-0">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                                <th className="px-4 py-3">Recipient</th>

                                <th className="px-4 py-3">Resource</th>

                                <th className="px-4 py-3">Quantity</th>

                                <th className="px-4 py-3">Beneficiaries</th>

                                <th className="px-4 py-3">Date</th>

                                <th className="px-4 py-3">Status</th>

                                <th className="px-4 py-3 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredDistributions.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-10 text-center text-slate-400"
                                    >
                                        No distribution records found.
                                    </td>
                                </tr>
                            )}

                            {filteredDistributions.map((d) => (
                                <tr
                                    key={d.id}
                                    className="border-b border-slate-50 hover:bg-slate-50"
                                >
                                    {/* Recipient */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                                <Truck size={16} />
                                            </div>

                                            <div>
                                                <p className="font-medium text-slate-800">
                                                    {d.family?.family_name ??
                                                        d.recipient_name}
                                                </p>

                                                {d.family && (
                                                    <p className="text-xs text-slate-400">
                                                        {d.family.family_id}
                                                    </p>
                                                )}

                                                {d.location && (
                                                    <p className="text-xs text-slate-400">
                                                        {d.location.name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Resource */}
                                    <td className="px-4 py-3 text-slate-600">
                                        <p>{d.resource?.name}</p>

                                        {d.additional_resource && (
                                            <p className="text-xs text-purple-600">
                                                +{' '}
                                                {
                                                    d.additional_resource
                                                        .name
                                                }
                                            </p>
                                        )}
                                    </td>

                                    {/* Quantity */}
                                    <td className="px-4 py-3 text-slate-600">
                                        <p>
                                            {d.quantity}{' '}
                                            {d.resource?.unit}
                                        </p>

                                        {d.additional_resource && (
                                            <p className="text-xs text-purple-600">
                                                +{' '}
                                                {d.additional_quantity}{' '}
                                                {
                                                    d.additional_resource
                                                        .unit
                                                }
                                            </p>
                                        )}
                                    </td>

                                    {/* Beneficiaries */}
                                    <td className="px-4 py-3 text-slate-600">
                                        {d.beneficiary_count}
                                    </td>

                                    {/* Date */}
                                    <td className="px-4 py-3 text-slate-500">
                                        {new Date(
                                            d.distribution_date,
                                        ).toLocaleDateString()}
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3">
                                        <span
                                            className={`badge ${
                                                statusBadge[d.status] ??
                                                'badge-slate'
                                            } capitalize`}
                                        >
                                            {d.status.replace('_', ' ')}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                type="button"
                                                className="rounded-lg p-1.5 text-purple-500 hover:bg-purple-50"
                                                onClick={() =>
                                                    setQrDistribution(d)
                                                }
                                                title="View QR code"
                                            >
                                                <QrCode size={15} />
                                            </button>

                                            <button
                                                type="button"
                                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                                onClick={() =>
                                                    openEdit(d)
                                                }
                                                title="Edit"
                                            >
                                                <Pencil size={15} />
                                            </button>

                                            <button
                                                type="button"
                                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                                onClick={() =>
                                                    setDeleting(d)
                                                }
                                                title="Delete"
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
            </div>

            {/* ========================================================= */}
            {/* DISTRIBUTION FORM MODAL                                  */}
            {/* ========================================================= */}

            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title={
                    editing
                        ? 'Edit Distribution'
                        : 'Record Distribution'
                }
                wide
            >
                <form onSubmit={submit} className="space-y-4">
                    {/* Staff / Purok */}
                    <div>
                        <label className="label">Staff / Purok</label>

                        <select
                            className="input-field"
                            value={selectedStaffId}
                            onChange={(e) => {
                                setSelectedStaffId(e.target.value);

                                form.setData('family_id', '');

                                form.setData('recipient_name', '');

                                form.setData(
                                    'recipient_contact',
                                    '',
                                );

                                form.setData(
                                    'beneficiary_count',
                                    '',
                                );
                            }}
                        >
                            <option value="">Select Staff</option>

                            {staff.map((member) => (
                                <option
                                    key={member.id}
                                    value={member.id}
                                >
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Family */}
                    <div>
                        <label className="label">Family</label>

                        <select
                            className="input-field"
                            value={form.data.family_id}
                            onChange={(e) => {
                                const familyId = e.target.value;

                                const family =
                                    availableFamilies.find(
                                        (item) =>
                                            String(item.id) ===
                                            familyId,
                                    );

                                form.setData(
                                    'family_id',
                                    familyId,
                                );

                                if (family) {
                                    form.setData(
                                        'recipient_name',
                                        family.family_name,
                                    );

                                    form.setData(
                                        'recipient_contact',
                                        family.phone ?? '',
                                    );

                                    form.setData(
                                        'beneficiary_count',
                                        family.beneficiary_count,
                                    );
                                }
                            }}
                        >
                            <option value="">
                                Select Family
                            </option>

                            {availableFamilies.map((family) => (
                                <option
                                    key={family.id}
                                    value={family.id}
                                >
                                    {family.family_name} —{' '}
                                    {family.family_id}
                                </option>
                            ))}
                        </select>

                        {form.errors.family_id && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.family_id}
                            </p>
                        )}
                    </div>

                    {/* Resource */}
                    <div>
                        <label className="label">Resource</label>

                        <select
                            className="input-field"
                            value={form.data.resource_id}
                            onChange={(e) => {
                                const resourceId = e.target.value;

                                const resource = resources.find(
                                    (r) =>
                                        String(r.id) ===
                                        resourceId,
                                );

                                form.setData(
                                    'resource_id',
                                    resourceId,
                                );

                                form.setData(
                                    'resource_category',
                                    resource?.category ?? '',
                                );
                            }}
                        >
                            <option value="">
                                Select Resource
                            </option>

                            {availableCategories.map(
                                (category) => (
                                    <optgroup
                                        key={category}
                                        label={
                                            CATEGORY_LABELS[
                                                category
                                            ] ?? category
                                        }
                                    >
                                        {resourcesByCategory(
                                            category,
                                        ).map((resource) => (
                                            <option
                                                key={resource.id}
                                                value={resource.id}
                                            >
                                                {resource.name}
                                                {resource.unit
                                                    ? ` (${resource.unit})`
                                                    : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                ),
                            )}
                        </select>

                        {form.errors.resource_id && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.resource_id}
                            </p>
                        )}
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="label">
                            Quantity
                        </label>

                        <input
                            type="number"
                            min={1}
                            className="input-field"
                            value={form.data.quantity}
                            onChange={(e) =>
                                form.setData(
                                    'quantity',
                                    e.target.value,
                                )
                            }
                        />

                        <p className="mt-1 text-xs text-slate-400">
                            Default: 1 box of Set of Goods.
                        </p>

                        {form.errors.quantity && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.quantity}
                            </p>
                        )}
                    </div>

                    {/* Beneficiaries */}
                    <div>
                        <label className="label">
                            Beneficiaries
                        </label>

                        <input
                            type="number"
                            className="input-field bg-slate-50"
                            value={form.data.beneficiary_count}
                            readOnly
                        />

                        <p className="mt-1 text-xs text-slate-400">
                            Automatically taken from the
                            selected family's beneficiary
                            count.
                        </p>

                        {form.errors.beneficiary_count && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.beneficiary_count}
                            </p>
                        )}
                    </div>

                    {/* Additional Resource */}
                    <div className="sm:col-span-2">
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                checked={
                                    form.data.has_additional
                                }
                                onChange={(e) => {
                                    const checked =
                                        e.target.checked;

                                    form.setData(
                                        'has_additional',
                                        checked,
                                    );

                                    if (!checked) {
                                        form.setData(
                                            'additional_resource_id',
                                            '',
                                        );

                                        form.setData(
                                            'additional_resource_category',
                                            '',
                                        );

                                        form.setData(
                                            'additional_quantity',
                                            1,
                                        );
                                    }
                                }}
                            />

                            <span className="text-sm font-medium text-slate-700">
                                Request additional emergency
                                resource
                            </span>
                        </label>
                    </div>

                    {form.data.has_additional && (
                        <>
                            <div>
                                <label className="label">
                                    Emergency Resource
                                </label>

                                <select
                                    className="input-field"
                                    value={
                                        form.data
                                            .additional_resource_id
                                    }
                                    onChange={(e) => {
                                        const resourceId =
                                            e.target.value;

                                        const resource =
                                            resources.find(
                                                (r) =>
                                                    String(
                                                        r.id,
                                                    ) ===
                                                    resourceId,
                                            );

                                        form.setData(
                                            'additional_resource_id',
                                            resourceId,
                                        );

                                        form.setData(
                                            'additional_resource_category',
                                            resource?.category ??
                                                '',
                                        );
                                    }}
                                >
                                    <option value="">
                                        Select Emergency Resource
                                    </option>

                                    {resources.map(
                                        (resource) => (
                                            <option
                                                key={
                                                    resource.id
                                                }
                                                value={
                                                    resource.id
                                                }
                                            >
                                                {resource.name}
                                                {resource.unit
                                                    ? ` (${resource.unit})`
                                                    : ''}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="label">
                                    Emergency Quantity
                                </label>

                                <input
                                    type="number"
                                    min={1}
                                    className="input-field"
                                    value={
                                        form.data
                                            .additional_quantity
                                    }
                                    onChange={(e) =>
                                        form.setData(
                                            'additional_quantity',
                                            e.target.value,
                                        )
                                    }
                                />
                            </div>
                        </>
                    )}

                    {/* Location */}
                    <div>
                        <label className="label">
                            Location
                        </label>

                        <select
                            className="input-field"
                            value={form.data.location_id}
                            onChange={(e) =>
                                form.setData(
                                    'location_id',
                                    e.target.value,
                                )
                            }
                        >
                            <option value="">
                                Select Location
                            </option>

                            {locations.map((location) => (
                                <option
                                    key={location.id}
                                    value={location.id}
                                >
                                    {location.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Distribution Date */}
                    <div>
                        <label className="label">
                            Distribution Date
                        </label>

                        <input
                            type="datetime-local"
                            className="input-field"
                            value={
                                form.data.distribution_date
                            }
                            onChange={(e) =>
                                form.setData(
                                    'distribution_date',
                                    e.target.value,
                                )
                            }
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="label">
                            Status
                        </label>

                        <select
                            className="input-field"
                            value={form.data.status}
                            onChange={(e) =>
                                form.setData(
                                    'status',
                                    e.target.value,
                                )
                            }
                        >
                            <option value="pending">
                                Pending
                            </option>

                            <option value="in_transit">
                                In Transit
                            </option>

                            <option value="completed">
                                Completed
                            </option>

                            <option value="cancelled">
                                Cancelled
                            </option>
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="label">
                            Notes
                        </label>

                        <textarea
                            className="input-field min-h-24"
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData(
                                    'notes',
                                    e.target.value,
                                )
                            }
                            placeholder="Optional notes..."
                        />
                    </div>

                    {/* Hidden/Automatically generated recipient info */}
                    <input
                        type="hidden"
                        value={form.data.recipient_name}
                    />

                    <input
                        type="hidden"
                        value={form.data.recipient_contact}
                    />

                    {/* Buttons */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                                setShowForm(false)
                            }
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
                                  : 'Record Distribution'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ========================================================= */}
            {/* QR MODAL                                                  */}
            {/* ========================================================= */}

            <Modal
                open={!!qrDistribution}
                onClose={() => setQrDistribution(null)}
                title="Distribution QR Code"
            >
                {qrDistribution && (
                    <div className="flex flex-col items-center gap-4">
                        <div
                            ref={qrRef}
                            className="rounded-xl border border-slate-100 p-4"
                        >
                            <QRCodeCanvas
                                value={
                                    qrDistribution.qr_code ??
                                    String(qrDistribution.id)
                                }
                                size={200}
                                level="M"
                            />
                        </div>

                        <div className="text-center">
                            <p className="font-medium text-slate-800">
                                {
                                    qrDistribution.recipient_name
                                }
                            </p>

                            <p className="text-xs text-slate-400">
                                {qrDistribution.qr_code}
                            </p>
                        </div>

                        <p className="text-center text-xs text-slate-500">
                            Keep this QR code on file for this
                            family. Scanning or looking it up
                            before a future distribution helps
                            confirm whether they have already
                            received relief.
                        </p>

                        <button
                            type="button"
                            className="btn-primary flex items-center gap-2"
                            onClick={downloadQr}
                        >
                            <Download size={16} />
                            Download PNG
                        </button>
                    </div>
                )}
            </Modal>

            {/* ========================================================= */}
            {/* DELETE CONFIRMATION                                      */}
            {/* ========================================================= */}

            <ConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                message={`Delete distribution to "${deleting?.recipient_name}"? Completed distributions will restore stock.`}
            />
        </AppLayout>
    );
}
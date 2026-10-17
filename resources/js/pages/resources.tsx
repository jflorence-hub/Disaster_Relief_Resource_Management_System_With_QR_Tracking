import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Location, ResourceItem, ResourceSet, ResourceSetItem } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronUp,
    Download,
    Layers,
    Package,
    Pencil,
    Plus,
    QrCode,
    Search,
    Trash2,
} from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const categories = [
    'food',
    'water',
    'medical',
    'shelter',
    'clothing',
    'hygiene',
    'tools',
    'set',
    'other',
];

// Keep in sync with ResourceController::DISASTER_TYPES
const DISASTER_TYPES = [
    'Typhoon',
    'Flood',
    'Earthquake',
    'Volcanic Eruption',
    'Landslide',
    'Tsunami',
    'Storm Surge',
    'Drought',
    'Wildfire',
    'Tornado',
    'Hurricane',
    'Cyclone',
    'Flash Flood',
    'Mudslide',
    'Hailstorm',
    'Blizzard',
    'Heat Wave',
    'Cold Wave',
    'Industrial Accident',
    'Oil Spill',
    'Pandemic / Disease Outbreak',
    'Other',
];

const statusBadge: Record<string, string> = {
    in_stock: 'badge-green',
    low_stock: 'badge-amber',
    out_of_stock: 'badge-red',
};

interface FormData {
    name: string;
    category: string;
    quantity: number | string;
    unit: string;
    minimum_threshold: number | string;
    expiry_date: string;
    location_id: string;
    notes: string;
    disaster: string;
}

const emptyForm: FormData = {
    name: '',
    category: 'food',
    quantity: 0,
    unit: 'pieces',
    minimum_threshold: 10,
    expiry_date: '',
    location_id: '',
    notes: '',
    disaster: '',
};

export default function Resources({
    resources,
    resourceSets = [],
    locations,
    filters,
    userRole,
    disasterTypes,
}: {
    resources: ResourceItem[];
    resourceSets?: ResourceSet[];
    userRole: string;
    locations: Location[];
    disasterTypes?: string[];
    filters: {
        search?: string;
        category?: string;
        location_id?: string;
        disaster?: string;
    };
}) {
    const effectiveDisasterTypes = disasterTypes ?? DISASTER_TYPES;

    const mainWarehouse = locations.find(
        (location) =>
            location.name.trim().toLowerCase() === 'main warehouse',
    );

    // ─── Resource tab state ───────────────────────────────────────────────
    const [search, setSearch] = useState(filters.search ?? '');

    const [selectedLocation, setSelectedLocation] = useState(
        filters.location_id ??
            (mainWarehouse ? String(mainWarehouse.id) : ''),
    );

    const [selectedDisaster, setSelectedDisaster] = useState(
        filters.disaster ?? '',
    );

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<ResourceItem | null>(null);
    const [deleting, setDeleting] = useState<ResourceItem | null>(null);
    const [qrResource, setQrResource] = useState<ResourceItem | null>(null);

    const qrRef = useRef<HTMLDivElement>(null);

    const form = useForm<FormData>(emptyForm);

    // ─── Tab state ────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'resources' | 'sets'>('resources');

    // ─── Sets state ───────────────────────────────────────────────────────
    const [expandedSetIds, setExpandedSetIds] = useState<Set<number>>(new Set());

    const [showSetForm, setShowSetForm] = useState(false);
    const [editingSet, setEditingSet] = useState<ResourceSet | null>(null);
    const [setFormData, setSetFormData] = useState({
        name: '',
        description: '',
        location_id: '',
        disaster: '',
    });
    const [setFormItems, setSetFormItems] = useState<{ resource_id: string; quantity: number }[]>([]);
    const [setFormErrors, setSetFormErrors] = useState<Record<string, string>>({});
    const [deletingSet, setDeletingSet] = useState<ResourceSet | null>(null);

    // ─── Resource helpers ─────────────────────────────────────────────────

    /*
     * NEW RESOURCE
     *
     * Every newly-created resource belongs to Main Warehouse.
     * Users cannot choose another location when adding stock.
     */
    const openCreate = () => {
        setEditing(null);

        form.setData({
            ...emptyForm,
            location_id: mainWarehouse
                ? String(mainWarehouse.id)
                : '',
        });

        setShowForm(true);
    };

    /*
     * EDIT RESOURCE
     *
     * Existing resource keeps its current location.
     * Location should NOT be changed from this page.
     * Inventory movement belongs in QR Tracking.
     */
    const openEdit = (resource: ResourceItem) => {
        setEditing(resource);

        form.setData({
            name: resource.name,
            category: resource.category,
            quantity: resource.quantity,
            unit: resource.unit,
            minimum_threshold: resource.minimum_threshold,
            expiry_date: resource.expiry_date ?? '',
            location_id: resource.location_id
                ? String(resource.location_id)
                : '',
            notes: resource.notes ?? '',
            disaster: resource.disaster ?? '',
        });

        setShowForm(true);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        if (!mainWarehouse && !editing) {
            alert(
                'Main Warehouse was not found. Please create a location named "Main Warehouse" first.',
            );
            return;
        }

        if (editing) {
            form.put(`/resources/${editing.id}`, {
                onSuccess: () => setShowForm(false),
            });
        } else {
            form.post('/resources', {
                onSuccess: () => setShowForm(false),
            });
        }
    };

    const confirmDelete = () => {
        if (!deleting) return;

        router.delete(`/resources/${deleting.id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    /*
     * SEARCH
     */
    const runSearch = (value: string) => {
        setSearch(value);

        router.get(
            '/resources',
            {
                ...filters,
                search: value,
                location_id: selectedLocation || undefined,
                disaster: selectedDisaster || undefined,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    /*
     * LOCATION FILTER
     */
    const changeLocation = (value: string) => {
        setSelectedLocation(value);

        router.get(
            '/resources',
            {
                ...filters,
                search,
                location_id: value || undefined,
                disaster: selectedDisaster || undefined,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    /*
     * DISASTER FILTER
     */
    const changeDisaster = (value: string) => {
        setSelectedDisaster(value);

        router.get(
            '/resources',
            {
                ...filters,
                search,
                location_id: selectedLocation || undefined,
                disaster: value || undefined,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    /*
     * QR DOWNLOAD
     */
    const downloadQr = () => {
        const canvas = qrRef.current?.querySelector('canvas');

        if (!canvas || !qrResource) return;

        const link = document.createElement('a');

        link.download = `${qrResource.sku}-qr.png`;
        link.href = canvas.toDataURL('image/png');

        link.click();
    };

    // ─── Sets helpers ─────────────────────────────────────────────────────

    /** Toggle set card expansion */
    const toggleSetExpand = (id: number) => {
        setExpandedSetIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    /** Open create set form */
    const openCreateSet = () => {
        setEditingSet(null);
        setSetFormData({ name: '', description: '', location_id: '', disaster: '' });
        setSetFormItems([]);
        setSetFormErrors({});
        setShowSetForm(true);
    };

    /** Open edit set form */
    const openEditSet = (set: ResourceSet) => {
        setEditingSet(set);
        setSetFormData({
            name: set.name,
            description: set.description ?? '',
            location_id: set.location_id ? String(set.location_id) : '',
            disaster: set.disaster ?? '',
        });
        setSetFormItems(
            (set.items ?? []).map((item: ResourceSetItem) => ({
                resource_id: String(item.resource_id),
                quantity: item.quantity,
            }))
        );
        setSetFormErrors({});
        setShowSetForm(true);
    };

    /** Checklist helpers */
    const isItemChecked = (resourceId: number) =>
        setFormItems.some((i) => Number(i.resource_id) === resourceId);

    const getItemQty = (resourceId: number) =>
        setFormItems.find((i) => Number(i.resource_id) === resourceId)?.quantity ?? 1;

    const toggleSetItem = (resourceId: number) => {
        if (isItemChecked(resourceId)) {
            setSetFormItems((prev) => prev.filter((i) => Number(i.resource_id) !== resourceId));
        } else {
            setSetFormItems((prev) => [...prev, { resource_id: String(resourceId), quantity: 1 }]);
        }
    };

    const updateSetItemQty = (resourceId: number, qty: number) => {
        setSetFormItems((prev) =>
            prev.map((i) =>
                Number(i.resource_id) === resourceId ? { ...i, quantity: qty } : i
            )
        );
    };

    /** Submit set form */
    const submitSetForm = (e: React.FormEvent) => {
        e.preventDefault();
        setSetFormErrors({});

        const payload = {
            name: setFormData.name,
            description: setFormData.description || null,
            location_id: setFormData.location_id ? Number(setFormData.location_id) : null,
            disaster: setFormData.disaster || null,
            items: setFormItems.map((i) => ({
                resource_id: Number(i.resource_id),
                quantity: Number(i.quantity),
            })),
        };

        if (editingSet) {
            router.put(`/resource-sets/${editingSet.id}`, payload, {
                onSuccess: () => {
                    setShowSetForm(false);
                    setEditingSet(null);
                },
                onError: (errors) => setSetFormErrors(errors as Record<string, string>),
            });
        } else {
            router.post('/resource-sets', payload, {
                onSuccess: () => setShowSetForm(false),
                onError: (errors) => setSetFormErrors(errors as Record<string, string>),
            });
        }
    };

    /** Delete set */
    const confirmDeleteSet = () => {
        if (!deletingSet) return;
        router.delete(`/resource-sets/${deletingSet.id}`, {
            onSuccess: () => setDeletingSet(null),
            onError: () => setDeletingSet(null),
        });
    };

    return (
        <AppLayout
            title="Resources"
            subtitle="Manage relief supply inventory"
        >
            <Head title="Resources" />

            {/* TAB SWITCHER */}
            <div className="mb-4 flex gap-1 border-b border-slate-200">
                <button
                    type="button"
                    onClick={() => setActiveTab('resources')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'resources'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Resources
                </button>
                {userRole === 'admin' && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('sets')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'sets'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Layers size={14} />
                        Sets
                    </button>
                )}
            </div>

            {/* ── RESOURCES TAB ──────────────────────────────────────────────── */}
            {activeTab === 'resources' && (
                <>
                    {/* TOP CONTROLS */}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* SEARCH */}
                        <div className="relative w-full sm:max-w-xs">
                            <Search
                                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                                size={16}
                            />

                            <input
                                className="input-field pl-9"
                                placeholder="Search resources…"
                                value={search}
                                onChange={(e) =>
                                    runSearch(e.target.value)
                                }
                            />
                        </div>

                        {/* LOCATION + DISASTER + ADD RESOURCE */}
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <select
                                disabled={userRole !== 'admin'}
                                className="input-field min-w-[210px]"
                                value={selectedLocation}
                                onChange={(e) =>
                                    changeLocation(e.target.value)
                                }
                            >
                                {locations.map((location) => (
                                    <option
                                        key={location.id}
                                        value={String(location.id)}
                                    >
                                        {location.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                className="input-field min-w-[180px]"
                                value={selectedDisaster}
                                onChange={(e) =>
                                    changeDisaster(e.target.value)
                                }
                            >
                                <option value="">All Disasters</option>
                                {DISASTER_TYPES.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>

                            {userRole === 'admin' && <button
                                type="button"
                                className="btn-primary flex min-w-[160px] shrink-0 items-center justify-center gap-2 whitespace-nowrap"
                                onClick={openCreate}
                            >
                                <Plus size={16} />
                                Add Resource
                            </button>}
                        </div>
                    </div>

                    {/* CURRENT LOCATION */}
                    {selectedLocation && (
                        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                            Showing resources currently at{' '}
                            <strong>
                                {locations.find(
                                    (location) =>
                                        String(location.id) ===
                                        String(selectedLocation),
                                )?.name ?? 'Selected Location'}
                            </strong>
                        </div>
                    )}

                    {/* RESOURCE TABLE */}
                    <div className="card overflow-x-auto p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                                    <th className="px-4 py-3">
                                        Resource
                                    </th>

                                    <th className="px-4 py-3">
                                        Category
                                    </th>

                                    <th className="px-4 py-3">
                                        Quantity
                                    </th>

                                    <th className="px-4 py-3">
                                        Location
                                    </th>

                                    <th className="px-4 py-3">
                                        Disaster
                                    </th>

                                    <th className="px-4 py-3">
                                        Status
                                    </th>

                                    <th className="px-4 py-3 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {resources.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-10 text-center text-slate-400"
                                        >
                                            No resources found at this
                                            location.
                                        </td>
                                    </tr>
                                )}

                                {resources.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="border-b border-slate-50 hover:bg-slate-50"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                                    <Package size={16} />
                                                </div>

                                                <div>
                                                    <p className="font-medium text-slate-800">
                                                        {r.name}
                                                    </p>

                                                    <p className="text-xs text-slate-400">
                                                        {r.sku}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 capitalize text-slate-600">
                                            {r.category}
                                        </td>

                                        <td className="px-4 py-3 text-slate-600">
                                            {r.quantity} {r.unit}
                                        </td>

                                        <td className="px-4 py-3 text-slate-600">
                                            {r.location?.name ?? '—'}
                                        </td>

                                        <td className="px-4 py-3 text-slate-600">
                                            {r.disaster ? (
                                                <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                                                    {r.disaster}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span
                                                className={`badge ${statusBadge[r.status]}`}
                                            >
                                                {r.status.replace('_', ' ')}
                                            </span>
                                            {r.status === 'low_stock' && r.families_at_location != null && r.families_at_location > 0 && (
                                                <p className="mt-0.5 text-xs text-amber-600">
                                                    ~{r.quantity} {r.unit} / {r.families_at_location} families
                                                </p>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1.5">
                                                {/* VIEW QR */}
                                                <button
                                                    type="button"
                                                    className="rounded-lg p-1.5 text-purple-500 hover:bg-purple-50"
                                                    onClick={() =>
                                                        setQrResource(r)
                                                    }
                                                    title="View QR code"
                                                >
                                                    <QrCode size={15} />
                                                </button>

                                                {/* EDIT */}
                                                {userRole === 'admin' && <button
                                                    type="button"
                                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                                    onClick={() =>
                                                        openEdit(r)
                                                    }
                                                    title="Edit resource"
                                                >
                                                    <Pencil size={15} />
                                                </button>}

                                                {/* DELETE */}
                                                {userRole === 'admin' && <button
                                                    type="button"
                                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                                    onClick={() =>
                                                        setDeleting(r)
                                                    }
                                                    title="Delete resource"
                                                >
                                                    <Trash2 size={15} />
                                                </button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ADD / EDIT RESOURCE MODAL */}
                    <Modal
                        open={showForm}
                        onClose={() => setShowForm(false)}
                        title={
                            editing
                                ? 'Edit Resource'
                                : 'Add Resource'
                        }
                        wide
                    >
                        <form
                            onSubmit={submit}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {/* NAME */}
                                <div>
                                    <label className="label">
                                        Name
                                    </label>

                                    <input
                                        className="input-field"
                                        value={form.data.name}
                                        onChange={(e) =>
                                            form.setData(
                                                'name',
                                                e.target.value,
                                            )
                                        }
                                    />

                                    {form.errors.name && (
                                        <p className="mt-1 text-xs text-red-600">
                                            {form.errors.name}
                                        </p>
                                    )}
                                </div>

                                {/* CATEGORY */}
                                <div>
                                    <label className="label">
                                        Category
                                    </label>

                                    <select
                                        className="input-field"
                                        value={form.data.category}
                                        onChange={(e) =>
                                            form.setData(
                                                'category',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        {categories.map((c) => (
                                            <option
                                                key={c}
                                                value={c}
                                            >
                                                {c[0].toUpperCase() +
                                                    c.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* QUANTITY */}
                                <div>
                                    <label className="label">
                                        Quantity
                                    </label>

                                    <input
                                        type="number"
                                        min={0}
                                        className="input-field"
                                        value={form.data.quantity}
                                        onChange={(e) =>
                                            form.setData(
                                                'quantity',
                                                e.target.value,
                                            )
                                        }
                                    />

                                    {form.errors.quantity && (
                                        <p className="mt-1 text-xs text-red-600">
                                            {form.errors.quantity}
                                        </p>
                                    )}
                                </div>

                                {/* UNIT */}
                                <div>
                                    <label className="label">
                                        Unit
                                    </label>

                                    <input
                                        className="input-field"
                                        placeholder="pieces, boxes, kg…"
                                        value={form.data.unit}
                                        onChange={(e) =>
                                            form.setData(
                                                'unit',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>

                                {/* MINIMUM THRESHOLD */}
                                <div>
                                    <label className="label">
                                        Minimum threshold
                                    </label>

                                    <input
                                        type="number"
                                        min={0}
                                        className="input-field"
                                        value={
                                            form.data
                                                .minimum_threshold
                                        }
                                        onChange={(e) =>
                                            form.setData(
                                                'minimum_threshold',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>

                                {/* EXPIRY */}
                                <div>
                                    <label className="label">
                                        Expiry date (optional)
                                    </label>

                                    <input
                                        type="date"
                                        className="input-field"
                                        value={
                                            form.data.expiry_date
                                        }
                                        onChange={(e) =>
                                            form.setData(
                                                'expiry_date',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>

                                {/* LOCATION */}
                                <div className="sm:col-span-2">
                                    <label className="label">
                                        Location
                                    </label>

                                    <div className="input-field flex items-center bg-slate-50">
                                        {editing
                                            ? editing.location?.name ??
                                              'Unknown Location'
                                            : mainWarehouse?.name ??
                                              'Main Warehouse'}
                                    </div>

                                    <p className="mt-1 text-xs text-slate-400">
                                        {editing
                                            ? 'Inventory location can only be changed through QR Tracking.'
                                            : 'New resources are always added to the Main Warehouse.'}
                                    </p>
                                </div>

                                {/* NOTES */}
                                <div className="sm:col-span-2">
                                    <label className="label">
                                        Notes
                                    </label>

                                    <textarea
                                        className="input-field"
                                        rows={2}
                                        value={form.data.notes}
                                        onChange={(e) =>
                                            form.setData(
                                                'notes',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>

                                {/* DISASTER */}
                                <div className="sm:col-span-2">
                                    <label className="label">
                                        Disaster (optional)
                                    </label>

                                    <select
                                        className="input-field"
                                        value={form.data.disaster}
                                        onChange={(e) =>
                                            form.setData(
                                                'disaster',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">— None —</option>
                                        {DISASTER_TYPES.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>

                                    <p className="mt-1 text-xs text-slate-400">
                                        Tag this resource to a specific type of disaster for filtering.
                                    </p>

                                    {form.errors.disaster && (
                                        <p className="mt-1 text-xs text-red-600">
                                            {form.errors.disaster}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {!editing && (
                                <p className="text-xs text-slate-400">
                                    A unique SKU and QR code will be
                                    generated automatically.
                                </p>
                            )}

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
                                          ? 'Save changes'
                                          : 'Add resource'}
                                </button>
                            </div>
                        </form>
                    </Modal>

                    {/* QR MODAL */}
                    <Modal
                        open={!!qrResource}
                        onClose={() => setQrResource(null)}
                        title="Resource QR Code"
                    >
                        {qrResource && (
                            <div className="flex flex-col items-center gap-4">
                                <div
                                    ref={qrRef}
                                    className="rounded-xl border border-slate-100 p-4"
                                >
                                    <QRCodeCanvas
                                        value={qrResource.qr_code}
                                        size={200}
                                        level="M"
                                    />
                                </div>

                                <div className="text-center">
                                    <p className="font-medium text-slate-800">
                                        {qrResource.name}
                                    </p>

                                    <p className="text-xs text-slate-400">
                                        {qrResource.qr_code}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                        {qrResource.location?.name ??
                                            'Main Warehouse'}
                                    </p>
                                </div>

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

                    {/* DELETE CONFIRMATION */}
                    <ConfirmDialog
                        open={!!deleting}
                        onClose={() => setDeleting(null)}
                        onConfirm={confirmDelete}
                        message={`Delete "${deleting?.name}"? This cannot be undone.`}
                    />
                </>
            )}

            {/* ── SETS TAB ───────────────────────────────────────────────────── */}
            {activeTab === 'sets' && (
                <div className="space-y-4">
                    {/* SETS HEADER */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">Resource Sets</h2>
                        <button
                            type="button"
                            className="btn-primary flex items-center gap-2"
                            onClick={openCreateSet}
                        >
                            <Plus size={16} />
                            Create Set
                        </button>
                    </div>

                    {/* EMPTY STATE */}
                    {resourceSets.length === 0 && (
                        <div className="card flex flex-col items-center gap-3 py-12 text-center">
                            <Layers size={32} className="text-slate-300" />
                            <p className="text-slate-500">No resource sets yet.</p>
                            <p className="text-sm text-slate-400">Create one to bundle resources for reuse across distributions.</p>
                            <button type="button" className="btn-primary mt-2" onClick={openCreateSet}>
                                <Plus size={16} className="inline mr-1" />
                                Create Set
                            </button>
                        </div>
                    )}

                    {/* SET CARDS */}
                    {resourceSets.map((set) => (
                        <div key={set.id} className="card">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-slate-800">{set.name}</h3>
                                        {set.disaster && (
                                            <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                                                {set.disaster}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-sm text-slate-500">
                                        {set.items?.length ?? 0} item{(set.items?.length ?? 0) !== 1 ? 's' : ''} · {set.location?.name ?? '—'}
                                    </p>
                                    {set.description && (
                                        <p className="mt-1 text-sm text-slate-500">{set.description}</p>
                                    )}
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                        onClick={() => openEditSet(set)}
                                        title="Edit set"
                                    >
                                        <Pencil size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                        onClick={() => setDeletingSet(set)}
                                        title="Delete set"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                        onClick={() => toggleSetExpand(set.id)}
                                        title={expandedSetIds.has(set.id) ? 'Collapse' : 'Expand'}
                                    >
                                        {expandedSetIds.has(set.id) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                    </button>
                                </div>
                            </div>

                            {expandedSetIds.has(set.id) && set.items && set.items.length > 0 && (
                                <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-3">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-xs text-slate-400 uppercase">
                                                <th className="pb-2 pr-4">Resource</th>
                                                <th className="pb-2 pr-4">Unit</th>
                                                <th className="pb-2">Qty/Family</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {set.items.map((item) => (
                                                <tr key={item.id} className="border-t border-slate-50">
                                                    <td className="py-1.5 pr-4 text-slate-700">{item.resource?.name ?? `Resource #${item.resource_id}`}</td>
                                                    <td className="py-1.5 pr-4 text-slate-500">{item.resource?.unit ?? '—'}</td>
                                                    <td className="py-1.5 text-slate-700">{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* DELETE SET ERROR (from back() redirect) */}
                    {setFormErrors.resource_set && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                            {setFormErrors.resource_set}
                        </div>
                    )}
                </div>
            )}

            {/* ── SET CREATE / EDIT MODAL ────────────────────────────────────── */}
            <Modal
                open={showSetForm}
                onClose={() => { setShowSetForm(false); setEditingSet(null); }}
                title={editingSet ? 'Edit Resource Set' : 'Create Resource Set'}
                wide
            >
                <form onSubmit={submitSetForm} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* NAME */}
                        <div className="sm:col-span-2">
                            <label className="label">Set Name *</label>
                            <input
                                className="input-field"
                                value={setFormData.name}
                                onChange={(e) => setSetFormData((p) => ({ ...p, name: e.target.value }))}
                            />
                            {setFormErrors.name && <p className="mt-1 text-xs text-red-600">{setFormErrors.name}</p>}
                        </div>

                        {/* DESCRIPTION */}
                        <div className="sm:col-span-2">
                            <label className="label">Description (optional)</label>
                            <textarea
                                className="input-field"
                                rows={2}
                                value={setFormData.description}
                                onChange={(e) => setSetFormData((p) => ({ ...p, description: e.target.value }))}
                            />
                        </div>

                        {/* LOCATION */}
                        <div>
                            <label className="label">Location *</label>
                            <select
                                className="input-field"
                                value={setFormData.location_id}
                                onChange={(e) => setSetFormData((p) => ({ ...p, location_id: e.target.value }))}
                            >
                                <option value="">— Select location —</option>
                                {locations.map((loc) => (
                                    <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                                ))}
                            </select>
                            {setFormErrors.location_id && <p className="mt-1 text-xs text-red-600">{setFormErrors.location_id}</p>}
                        </div>

                        {/* DISASTER TAG */}
                        <div>
                            <label className="label">Disaster Tag (optional)</label>
                            <select
                                className="input-field"
                                value={setFormData.disaster}
                                onChange={(e) => setSetFormData((p) => ({ ...p, disaster: e.target.value }))}
                            >
                                <option value="">— None —</option>
                                {effectiveDisasterTypes.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* RESOURCES CHECKLIST */}
                    <div>
                        <label className="label">Resources *</label>
                        {setFormErrors.items && <p className="mb-2 text-xs text-red-600">{setFormErrors.items}</p>}
                        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                            {resources.length === 0 && (
                                <p className="px-4 py-3 text-sm text-slate-400">No resources available.</p>
                            )}
                            {resources.map((r) => (
                                <div
                                    key={r.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 ${isItemChecked(r.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                >
                                    <input
                                        type="checkbox"
                                        id={`set-item-${r.id}`}
                                        checked={isItemChecked(r.id)}
                                        onChange={() => toggleSetItem(r.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                    />
                                    <label htmlFor={`set-item-${r.id}`} className="flex-1 text-sm text-slate-700 cursor-pointer">
                                        {r.name}
                                        <span className="ml-1 text-xs text-slate-400">({r.unit})</span>
                                    </label>
                                    {isItemChecked(r.id) && (
                                        <div className="flex items-center gap-1">
                                            <label className="text-xs text-slate-500">Qty:</label>
                                            <input
                                                type="number"
                                                min={1}
                                                className="input-field w-20 py-1 text-sm"
                                                value={getItemQty(r.id)}
                                                onChange={(e) => updateSetItemQty(r.id, Number(e.target.value))}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{setFormItems.length} resource{setFormItems.length !== 1 ? 's' : ''} selected</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => { setShowSetForm(false); setEditingSet(null); }}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary">
                            {editingSet ? 'Save changes' : 'Create Set'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* DELETE SET CONFIRMATION */}
            <ConfirmDialog
                open={!!deletingSet}
                onClose={() => setDeletingSet(null)}
                onConfirm={confirmDeleteSet}
                message={`Delete set "${deletingSet?.name}"? This cannot be undone.`}
            />
        </AppLayout>
    );
}

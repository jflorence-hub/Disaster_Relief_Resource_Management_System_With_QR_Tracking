import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Location, ResourceItem } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import {
    Download,
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
};

export default function Resources({
    resources,
    locations,
    filters,
}: {
    resources: ResourceItem[];
    locations: Location[];
    filters: {
        search?: string;
        category?: string;
        location_id?: string;
    };
}) {
    const mainWarehouse = locations.find(
        (location) =>
            location.name.trim().toLowerCase() === 'main warehouse',
    );

    const [search, setSearch] = useState(filters.search ?? '');

    const [selectedLocation, setSelectedLocation] = useState(
        filters.location_id ??
            (mainWarehouse ? String(mainWarehouse.id) : ''),
    );

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<ResourceItem | null>(null);
    const [deleting, setDeleting] = useState<ResourceItem | null>(null);
    const [qrResource, setQrResource] = useState<ResourceItem | null>(null);

    const qrRef = useRef<HTMLDivElement>(null);

    const form = useForm<FormData>(emptyForm);

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

    return (
        <AppLayout
            title="Resources"
            subtitle="Manage relief supply inventory"
        >
            <Head title="Resources" />

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

                {/* LOCATION + ADD RESOURCE */}
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <select
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

                    <button
                        type="button"
                        className="btn-primary flex min-w-[160px] shrink-0 items-center justify-center gap-2 whitespace-nowrap"
                        onClick={openCreate}
                    >
                        <Plus size={16} />
                        Add Resource
                    </button>
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
                                    colSpan={6}
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

                                <td className="px-4 py-3">
                                    <span
                                        className={`badge ${statusBadge[r.status]}`}
                                    >
                                        {r.status.replace(
                                            '_',
                                            ' ',
                                        )}
                                    </span>
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
                                        <button
                                            type="button"
                                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                            onClick={() =>
                                                openEdit(r)
                                            }
                                            title="Edit resource"
                                        >
                                            <Pencil size={15} />
                                        </button>

                                        {/* DELETE */}
                                        <button
                                            type="button"
                                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                            onClick={() =>
                                                setDeleting(r)
                                            }
                                            title="Delete resource"
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
        </AppLayout>
    );
}
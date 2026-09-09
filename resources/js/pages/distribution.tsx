import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Distribution, Location, ResourceItem } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { Download, Pencil, Plus, QrCode, Search, Trash2, Truck } from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';
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

const CATEGORY_ORDER = ['food', 'water', 'medical', 'clothing', 'tools', 'hygiene', 'set', 'shelter', 'other'];

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
}

const emptyForm: FormData = {
    resource_id: '',
    resource_category: '',
    additional_resource_id: '',
    additional_resource_category: '',
    has_additional: false,
    location_id: '',
    quantity: 1,
    additional_quantity: 1,
    recipient_name: '',
    recipient_contact: '',
    beneficiary_count: 1,
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
}: {
    distributions: Distribution[];
    resources: ResourceItem[];
    locations: Location[];
    filters: { search?: string; status?: string };
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Distribution | null>(null);
    const [deleting, setDeleting] = useState<Distribution | null>(null);
    const [qrDistribution, setQrDistribution] = useState<Distribution | null>(null);
    const qrRef = useRef<HTMLDivElement>(null);

    const form = useForm<FormData>(emptyForm);

    const resourcesByCategory = (category: string) => resources.filter((r) => r.category === category);

    const availableCategories = CATEGORY_ORDER.filter((c) => resourcesByCategory(c).length > 0);

    const openCreate = () => {
        setEditing(null);
        form.setData({ ...emptyForm });
        setShowForm(true);
    };

    const openEdit = (d: Distribution) => {
        setEditing(d);
        const primaryResource = resources.find((r) => r.id === d.resource_id);
        const additionalResource = d.additional_resource_id
            ? resources.find((r) => r.id === d.additional_resource_id)
            : undefined;

        form.setData({
            resource_id: String(d.resource_id),
            resource_category: primaryResource?.category ?? '',
            additional_resource_id: d.additional_resource_id ? String(d.additional_resource_id) : '',
            additional_resource_category: additionalResource?.category ?? '',
            has_additional: !!d.additional_resource_id,
            location_id: d.location_id ? String(d.location_id) : '',
            quantity: d.quantity,
            additional_quantity: d.additional_quantity ?? 1,
            recipient_name: d.recipient_name,
            recipient_contact: d.recipient_contact ?? '',
            beneficiary_count: d.beneficiary_count,
            distribution_date: d.distribution_date.slice(0, 16),
            status: d.status,
            notes: d.notes ?? '',
        });
        setShowForm(true);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const payload = {
            resource_id: form.data.resource_id,
            location_id: form.data.location_id,
            quantity: form.data.quantity,
            additional_resource_id: form.data.has_additional ? form.data.additional_resource_id : '',
            additional_quantity: form.data.has_additional ? form.data.additional_quantity : '',
            recipient_name: form.data.recipient_name,
            recipient_contact: form.data.recipient_contact,
            beneficiary_count: form.data.beneficiary_count,
            distribution_date: form.data.distribution_date,
            status: form.data.status,
            notes: form.data.notes,
        };

        form.transform(() => payload);

        if (editing) {
            form.put(`/distribution/${editing.id}`, { onSuccess: () => setShowForm(false) });
        } else {
            form.post('/distribution', { onSuccess: () => setShowForm(false) });
        }
    };

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/distribution/${deleting.id}`, { onFinish: () => setDeleting(null) });
    };

    const runSearch = (value: string) => {
        setSearch(value);
        router.get('/distribution', { ...filters, search: value }, { preserveState: true, replace: true });
    };

    const downloadQr = () => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (!canvas || !qrDistribution) return;
        const link = document.createElement('a');
        link.download = `${qrDistribution.qr_code ?? 'distribution'}-qr.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <AppLayout title="Distribution" subtitle="Track supplies delivered to recipients">
            <Head title="Distribution" />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        className="input-field pl-9"
                        placeholder="Search recipient / family…"
                        value={search}
                        onChange={(e) => runSearch(e.target.value)}
                    />
                </div>
                <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
                    <Plus size={16} /> Record Distribution
                </button>
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
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {distributions.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                                    No distributions found.
                                </td>
                            </tr>
                        )}
                        {distributions.map((d) => (
                            <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Truck size={16} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800">{d.recipient_name}</p>
                                            {d.location && <p className="text-xs text-slate-400">{d.location.name}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    <p>{d.resource?.name}</p>
                                    {d.additional_resource && (
                                        <p className="text-xs text-purple-600">+ {d.additional_resource.name}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    <p>
                                        {d.quantity} {d.resource?.unit}
                                    </p>
                                    {d.additional_resource && (
                                        <p className="text-xs text-purple-600">
                                            + {d.additional_quantity} {d.additional_resource.unit}
                                        </p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{d.beneficiary_count}</td>
                                <td className="px-4 py-3 text-slate-500">
                                    {new Date(d.distribution_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`badge ${statusBadge[d.status]} capitalize`}>
                                        {d.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1.5">
                                        <button
                                            className="rounded-lg p-1.5 text-purple-500 hover:bg-purple-50"
                                            onClick={() => setQrDistribution(d)}
                                            title="View QR code"
                                        >
                                            <QrCode size={15} />
                                        </button>
                                        <button
                                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                            onClick={() => openEdit(d)}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                            onClick={() => setDeleting(d)}
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
                title={editing ? 'Edit Distribution' : 'Record Distribution'}
                wide
            >
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Category</label>
                            <select
                                className="input-field"
                                value={form.data.resource_category}
                                onChange={(e) => {
                                    form.setData('resource_category', e.target.value);
                                    form.setData('resource_id', '');
                                }}
                            >
                                <option value="">Select category</option>
                                {availableCategories.map((c) => (
                                    <option key={c} value={c}>
                                        {CATEGORY_LABELS[c] ?? c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Resource</label>
                            <select
                                className="input-field"
                                value={form.data.resource_id}
                                disabled={!form.data.resource_category}
                                onChange={(e) => form.setData('resource_id', e.target.value)}
                            >
                                <option value="">
                                    {form.data.resource_category ? 'Select resource' : 'Choose a category first'}
                                </option>
                                {resourcesByCategory(form.data.resource_category).map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} ({r.quantity} {r.unit} available)
                                    </option>
                                ))}
                            </select>
                            {form.errors.resource_id && (
                                <p className="mt-1 text-xs text-red-600">{form.errors.resource_id}</p>
                            )}
                        </div>
                        <div>
                            <label className="label">Quantity</label>
                            <input
                                type="number"
                                min={1}
                                className="input-field"
                                value={form.data.quantity}
                                onChange={(e) => form.setData('quantity', e.target.value)}
                            />
                            {form.errors.quantity && <p className="mt-1 text-xs text-red-600">{form.errors.quantity}</p>}
                        </div>
                        <div>
                            <label className="label">Destination location</label>
                            <select
                                className="input-field"
                                value={form.data.location_id}
                                onChange={(e) => form.setData('location_id', e.target.value)}
                            >
                                <option value="">None</option>
                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={form.data.has_additional}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    form.setData('has_additional', checked);
                                    if (!checked) {
                                        form.setData('additional_resource_category', '');
                                        form.setData('additional_resource_id', '');
                                    }
                                }}
                            />
                            Add an additional resource for this family (optional)
                        </label>
                        <p className="mt-1 text-xs text-slate-500">
                            e.g. extra medicine for a family with a sick member, on top of their regular relief goods.
                        </p>

                        {form.data.has_additional && (
                            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="label">Additional category</label>
                                    <select
                                        className="input-field"
                                        value={form.data.additional_resource_category}
                                        onChange={(e) => {
                                            form.setData('additional_resource_category', e.target.value);
                                            form.setData('additional_resource_id', '');
                                        }}
                                    >
                                        <option value="">Select category</option>
                                        {availableCategories.map((c) => (
                                            <option key={c} value={c}>
                                                {CATEGORY_LABELS[c] ?? c}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Additional resource</label>
                                    <select
                                        className="input-field"
                                        value={form.data.additional_resource_id}
                                        disabled={!form.data.additional_resource_category}
                                        onChange={(e) => form.setData('additional_resource_id', e.target.value)}
                                    >
                                        <option value="">
                                            {form.data.additional_resource_category ? 'Select resource' : 'Choose a category first'}
                                        </option>
                                        {resourcesByCategory(form.data.additional_resource_category)
                                            .filter((r) => String(r.id) !== form.data.resource_id)
                                            .map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name} ({r.quantity} {r.unit} available)
                                                </option>
                                            ))}
                                    </select>
                                    {form.errors.additional_resource_id && (
                                        <p className="mt-1 text-xs text-red-600">{form.errors.additional_resource_id}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="label">Additional quantity</label>
                                    <input
                                        type="number"
                                        min={1}
                                        className="input-field"
                                        value={form.data.additional_quantity}
                                        onChange={(e) => form.setData('additional_quantity', e.target.value)}
                                    />
                                    {form.errors.additional_quantity && (
                                        <p className="mt-1 text-xs text-red-600">{form.errors.additional_quantity}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Beneficiary count</label>
                            <input
                                type="number"
                                min={1}
                                className="input-field"
                                value={form.data.beneficiary_count}
                                onChange={(e) => form.setData('beneficiary_count', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Recipient name</label>
                            <input
                                className="input-field"
                                value={form.data.recipient_name}
                                onChange={(e) => form.setData('recipient_name', e.target.value)}
                            />
                            {form.errors.recipient_name && (
                                <p className="mt-1 text-xs text-red-600">{form.errors.recipient_name}</p>
                            )}
                        </div>
                        <div>
                            <label className="label">Recipient contact</label>
                            <input
                                className="input-field"
                                value={form.data.recipient_contact}
                                onChange={(e) => form.setData('recipient_contact', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Distribution date</label>
                            <input
                                type="datetime-local"
                                className="input-field"
                                value={form.data.distribution_date}
                                onChange={(e) => form.setData('distribution_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Status</label>
                            <select
                                className="input-field"
                                value={form.data.status}
                                onChange={(e) => form.setData('status', e.target.value)}
                            >
                                <option value="pending">Pending</option>
                                <option value="in_transit">In Transit</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="label">Notes</label>
                            <textarea
                                className="input-field"
                                rows={2}
                                value={form.data.notes}
                                onChange={(e) => form.setData('notes', e.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">
                        Marking a distribution as "Completed" automatically deducts the quantity (and additional
                        quantity, if any) from resource stock. A unique QR code is generated automatically so this
                        family's relief record can be verified later to avoid duplicate distribution.
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={form.processing}>
                            {form.processing ? 'Saving…' : editing ? 'Save changes' : 'Record distribution'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!qrDistribution} onClose={() => setQrDistribution(null)} title="Distribution QR Code">
                {qrDistribution && (
                    <div className="flex flex-col items-center gap-4">
                        <div ref={qrRef} className="rounded-xl border border-slate-100 p-4">
                            <QRCodeCanvas value={qrDistribution.qr_code ?? String(qrDistribution.id)} size={200} level="M" />
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-slate-800">{qrDistribution.recipient_name}</p>
                            <p className="text-xs text-slate-400">{qrDistribution.qr_code}</p>
                        </div>
                        <p className="text-center text-xs text-slate-500">
                            Keep this QR code on file for this family. Scanning or looking it up before a future
                            distribution helps confirm whether they've already received relief.
                        </p>
                        <button className="btn-primary flex items-center gap-2" onClick={downloadQr}>
                            <Download size={16} /> Download PNG
                        </button>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                message={`Delete distribution to "${deleting?.recipient_name}"? Completed distributions will restore stock.`}
            />
        </AppLayout>
    );
}

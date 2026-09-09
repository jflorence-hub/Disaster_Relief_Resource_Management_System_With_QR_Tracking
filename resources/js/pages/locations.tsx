import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Location } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

const types = ['warehouse', 'distribution_center', 'shelter', 'field_office'];

const statusBadge: Record<string, string> = {
    active: 'badge-green',
    inactive: 'badge-slate',
    maintenance: 'badge-amber',
};

interface FormData {
    name: string;
    type: string;
    address: string;
    city: string;
    latitude: string;
    longitude: string;
    capacity: number | string;
    contact_person: string;
    contact_phone: string;
    status: string;
}

const emptyForm: FormData = {
    name: '',
    type: 'warehouse',
    address: '',
    city: '',
    latitude: '',
    longitude: '',
    capacity: 0,
    contact_person: '',
    contact_phone: '',
    status: 'active',
};

export default function Locations({ locations }: { locations: Location[] }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Location | null>(null);
    const [deleting, setDeleting] = useState<Location | null>(null);

    const form = useForm<FormData>(emptyForm);

    const openCreate = () => {
        setEditing(null);
        form.setData({ ...emptyForm });
        setShowForm(true);
    };

    const openEdit = (location: Location) => {
        setEditing(location);
        form.setData({
            name: location.name,
            type: location.type,
            address: location.address,
            city: location.city,
            latitude: location.latitude ? String(location.latitude) : '',
            longitude: location.longitude ? String(location.longitude) : '',
            capacity: location.capacity,
            contact_person: location.contact_person ?? '',
            contact_phone: location.contact_phone ?? '',
            status: location.status,
        });
        setShowForm(true);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (editing) {
            form.put(`/locations/${editing.id}`, { onSuccess: () => setShowForm(false) });
        } else {
            form.post('/locations', { onSuccess: () => setShowForm(false) });
        }
    };

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/locations/${deleting.id}`, { onFinish: () => setDeleting(null) });
    };

    return (
        <AppLayout title="Locations" subtitle="Warehouses, shelters, and distribution points">
            <Head title="Locations" />

            <div className="mb-4 flex justify-end">
                <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
                    <Plus size={16} /> Add Location
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {locations.length === 0 && (
                    <p className="col-span-full py-10 text-center text-slate-400">No locations yet.</p>
                )}
                {locations.map((l) => (
                    <div key={l.id} className="card">
                        <div className="mb-2 flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{l.name}</p>
                                    <p className="text-xs text-slate-500 capitalize">{l.type.replace('_', ' ')}</p>
                                </div>
                            </div>
                            <span className={`badge ${statusBadge[l.status]} capitalize`}>{l.status}</span>
                        </div>
                        <p className="text-sm text-slate-600">{l.address}</p>
                        <p className="text-sm text-slate-500">{l.city}</p>

                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                            <div>
                                <p className="text-slate-400">Capacity</p>
                                <p className="font-medium text-slate-700">{l.capacity.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-slate-400">Resources stocked</p>
                                <p className="font-medium text-slate-700">
                                    {l.resources_count ?? 0} items · {(l.resources_sum_quantity ?? 0).toLocaleString()} units
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-400">Deliveries completed</p>
                                <p className="font-medium text-slate-700">{l.completed_distributions_count ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-slate-400">Beneficiaries served</p>
                                <p className="font-medium text-slate-700">{l.beneficiaries_served ?? 0}</p>
                            </div>
                        </div>

                        {l.contact_person && (
                            <p className="mt-2 text-xs text-slate-400">
                                {l.contact_person} · {l.contact_phone}
                            </p>
                        )}
                        <div className="mt-4 flex justify-end gap-1.5 border-t border-slate-100 pt-3">
                            <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => openEdit(l)}>
                                <Pencil size={15} />
                            </button>
                            <button className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => setDeleting(l)}>
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Location' : 'Add Location'} wide>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Name</label>
                            <input
                                className="input-field"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                            />
                            {form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}
                        </div>
                        <div>
                            <label className="label">Type</label>
                            <select
                                className="input-field"
                                value={form.data.type}
                                onChange={(e) => form.setData('type', e.target.value)}
                            >
                                {types.map((t) => (
                                    <option key={t} value={t}>
                                        {t.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="label">Address</label>
                            <input
                                className="input-field"
                                value={form.data.address}
                                onChange={(e) => form.setData('address', e.target.value)}
                            />
                            {form.errors.address && <p className="mt-1 text-xs text-red-600">{form.errors.address}</p>}
                        </div>
                        <div>
                            <label className="label">City</label>
                            <input
                                className="input-field"
                                value={form.data.city}
                                onChange={(e) => form.setData('city', e.target.value)}
                            />
                            {form.errors.city && <p className="mt-1 text-xs text-red-600">{form.errors.city}</p>}
                        </div>
                        <div>
                            <label className="label">Capacity</label>
                            <input
                                type="number"
                                min={0}
                                className="input-field"
                                value={form.data.capacity}
                                onChange={(e) => form.setData('capacity', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Latitude (optional)</label>
                            <input
                                className="input-field"
                                value={form.data.latitude}
                                onChange={(e) => form.setData('latitude', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Longitude (optional)</label>
                            <input
                                className="input-field"
                                value={form.data.longitude}
                                onChange={(e) => form.setData('longitude', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Contact person</label>
                            <input
                                className="input-field"
                                value={form.data.contact_person}
                                onChange={(e) => form.setData('contact_person', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Contact phone</label>
                            <input
                                className="input-field"
                                value={form.data.contact_phone}
                                onChange={(e) => form.setData('contact_phone', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Operational status</label>
                            <select
                                className="input-field"
                                value={form.data.status}
                                onChange={(e) => form.setData('status', e.target.value)}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="maintenance">Under maintenance</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={form.processing}>
                            {form.processing ? 'Saving…' : editing ? 'Save changes' : 'Add location'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                message={`Delete "${deleting?.name}"? Resources assigned here will become unassigned.`}
            />
        </AppLayout>
    );
}

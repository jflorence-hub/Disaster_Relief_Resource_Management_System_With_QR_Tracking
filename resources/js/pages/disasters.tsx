import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { CalendarDays, Flame, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface DisasterEvent {
    id: number;
    name: string;
    type: string;
    affected_area: string | null;
    starts_on: string;
    ends_on: string | null;
    status: 'active' | 'completed' | 'cancelled';
    description: string | null;
    schedules_count: number;
}

interface Barangay {
    id: number;
    name: string;
}

interface EventForm {
    name: string;
    type: string;
    affected_area: string;
    starts_on: string;
    ends_on: string;
    status: DisasterEvent['status'];
    description: string;
}

const emptyForm: EventForm = {
    name: '',
    type: '',
    affected_area: '',
    starts_on: new Date().toISOString().slice(0, 10),
    ends_on: '',
    status: 'active',
    description: '',
};

const statusStyles: Record<DisasterEvent['status'], string> = {
    active: 'bg-emerald-50 text-emerald-700',
    completed: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-red-50 text-red-700',
};

export default function Disasters({
    events,
    types,
    locations,
}: {
    events: DisasterEvent[];
    types: string[];
    locations: Barangay[];
}) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<DisasterEvent | null>(null);
    const [deleting, setDeleting] = useState<DisasterEvent | null>(null);
    const form = useForm<EventForm>(emptyForm);

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.setData({ ...emptyForm, type: types[0] ?? 'Other' });
        form.clearErrors();
        setShowForm(true);
    };

    const openEdit = (event: DisasterEvent) => {
        setEditing(event);
        form.setData({
            name: event.name,
            type: event.type,
            affected_area: event.affected_area ?? '',
            starts_on: event.starts_on.slice(0, 10),
            ends_on: event.ends_on?.slice(0, 10) ?? '',
            status: event.status,
            description: event.description ?? '',
        });
        form.clearErrors();
        setShowForm(true);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            affected_area: data.affected_area || null,
            ends_on: data.ends_on || null,
            description: data.description || null,
        }));
        if (editing) {
            form.put(`/disasters/${editing.id}`, {
                onSuccess: () => setShowForm(false),
            });
        } else {
            form.post('/disasters', { onSuccess: () => setShowForm(false) });
        }
    };

    const deleteEvent = () => {
        if (!deleting) return;
        router.delete(`/disasters/${deleting.id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    return (
        <AppLayout
            title="Disaster Events"
            subtitle="Manage response events and their schedules"
        >
            <Head title="Disaster Events" />

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-slate-600">
                    Create one record for each real-world incident. Tag relief
                    schedules to an event; inventory remains independent of
                    disaster type.
                </p>
                <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2"
                    onClick={openCreate}
                >
                    <Plus size={16} /> New event
                </button>
            </div>

            {events.length === 0 ? (
                <div className="card flex flex-col items-center py-12 text-center">
                    <Flame size={32} className="text-slate-300" />
                    <p className="mt-3 font-medium text-slate-700">
                        No disaster events yet
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                        Create an event before assigning it to a relief
                        schedule.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {events.map((event) => (
                        <article key={event.id} className="card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                                        <Flame size={19} />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="font-semibold break-words text-slate-800">
                                            {event.name}
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            {event.type}
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[event.status]}`}
                                >
                                    {event.status}
                                </span>
                            </div>
                            <div className="mt-4 space-y-2 text-sm text-slate-600">
                                <p className="flex items-center gap-2">
                                    <CalendarDays
                                        size={15}
                                        className="text-slate-400"
                                    />
                                    {event.starts_on}
                                    {event.ends_on ? ` – ${event.ends_on}` : ''}
                                </p>
                                <p>
                                    <span className="font-medium text-slate-500">
                                        Affected area:
                                    </span>{' '}
                                    {event.affected_area || 'Not specified'}
                                </p>
                                <p>
                                    <span className="font-medium text-slate-500">
                                        Schedules:
                                    </span>{' '}
                                    {event.schedules_count}
                                </p>
                                {event.description && (
                                    <p className="whitespace-pre-wrap text-slate-500">
                                        {event.description}
                                    </p>
                                )}
                            </div>
                            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                                <button
                                    type="button"
                                    className="btn-secondary inline-flex items-center gap-1.5"
                                    onClick={() => openEdit(event)}
                                >
                                    <Pencil size={14} /> Edit
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary inline-flex items-center gap-1.5 text-red-600 hover:text-red-700"
                                    onClick={() => setDeleting(event)}
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title={editing ? 'Edit Disaster Event' : 'New Disaster Event'}
            >
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="label">Event name *</label>
                        <input
                            className="input-field"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="e.g. Typhoon Carina – July 2026"
                            required
                        />
                        {form.errors.name && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.name}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Disaster type *</label>
                            <select
                                className="input-field"
                                value={form.data.type}
                                onChange={(e) =>
                                    form.setData('type', e.target.value)
                                }
                                required
                            >
                                {types.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                            {form.errors.type && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.type}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="label">Status *</label>
                            <select
                                className="input-field"
                                value={form.data.status}
                                onChange={(e) =>
                                    form.setData(
                                        'status',
                                        e.target.value as EventForm['status'],
                                    )
                                }
                            >
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Start date *</label>
                            <input
                                type="date"
                                className="input-field"
                                value={form.data.starts_on}
                                onChange={(e) =>
                                    form.setData('starts_on', e.target.value)
                                }
                                required
                            />
                            {form.errors.starts_on && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.starts_on}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="label">End date</label>
                            <input
                                type="date"
                                min={form.data.starts_on}
                                className="input-field"
                                value={form.data.ends_on}
                                onChange={(e) =>
                                    form.setData('ends_on', e.target.value)
                                }
                            />
                            {form.errors.ends_on && (
                                <p className="mt-1 text-xs text-red-600">
                                    {form.errors.ends_on}
                                </p>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="label">Affected area</label>
                        <select
                            className="input-field"
                            value={form.data.affected_area}
                            onChange={(e) =>
                                form.setData('affected_area', e.target.value)
                            }
                        >
                            <option value="">
                                Select a barangay (optional)
                            </option>
                            {form.data.affected_area &&
                                !locations.some(
                                    (location) =>
                                        location.name ===
                                        form.data.affected_area,
                                ) && (
                                    <option value={form.data.affected_area}>
                                        {form.data.affected_area}
                                    </option>
                                )}
                            {locations.map((location) => (
                                <option key={location.id} value={location.name}>
                                    {location.name}
                                </option>
                            ))}
                        </select>
                        {form.errors.affected_area && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.affected_area}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="label">Description</label>
                        <textarea
                            className="input-field min-h-20"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                        {form.errors.description && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.description}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
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
                            {form.processing ? 'Saving…' : 'Save event'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                onConfirm={deleteEvent}
                title="Delete disaster event?"
                message={
                    deleting
                        ? `Delete "${deleting.name}"? Events used by schedules cannot be deleted.`
                        : ''
                }
            />
        </AppLayout>
    );
}

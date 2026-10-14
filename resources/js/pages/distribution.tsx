import AppLayout from '@/layouts/app-layout';
import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import { Distribution, Location, ResourceItem } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock3,
    Download,
    History,
    Pencil,
    QrCode,
    Search,
    Trash2,
    Truck,
    Users,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface Family {
    id: number;
    family_id: string;
    family_name: string;
    head_name: string;
    phone?: string | null;
    household_member: number;
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

interface DistributionRow {
    family: Family;
    distribution: Distribution;
    reliefName: string;
    quantity: number;
    date: string;
    status: string;
}

interface ScheduleHistoryEntry {
    id: number;
    scheduled_at: string;
    resource_name: string | null;
    location_name: string | null;
    families: {
        id: number;
        status: string;
        quantity: number;
        additional_quantity: number | null;
        family_code: string;
        family_name: string;
        head_name: string;
        household_member: number;
        purok_name: string | null;
        resource_name: string | null;
        resource_unit: string | null;
        additional_resource_name: string | null;
        additional_resource_unit: string | null;
        scanned_by: string | null;
    }[];
}

interface FormData {
    family_id: number | string;
    resource_id: number | string;
    quantity: number | string;
    additional_resource_id: number | string;
    additional_quantity: number | string;
    location_id: number | string;
    distribution_date: string;
    status: string;
    notes: string;
}

const emptyForm: FormData = {
    family_id: '',
    resource_id: '',
    quantity: 1,
    additional_resource_id: '',
    additional_quantity: 0,
    location_id: '',
    distribution_date: '',
    status: 'pending',
    notes: '',
};

export default function DistributionPage({
    distributions,
    resources,
    locations,
    filters,
    staff = [],
    families = [],
    currentDate,
    scheduledAt,
    defaultSetResource,
    userRole,
    scheduleHistory = [],
    puroks = [],
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
    currentDate: string;
    scheduledAt: string;
    defaultSetResource?: ResourceItem | null;
    userRole: string;
    scheduleHistory: ScheduleHistoryEntry[];
    puroks: { id: number; name: string }[];
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedStaffId, setSelectedStaffId] = useState('');

    // History dropdown — which past schedule is being viewed
    const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
    // History purok filter — which purok to show inside the selected schedule
    const [selectedHistoryPurok, setSelectedHistoryPurok] = useState<string>('');

    const [scheduleValue, setScheduleValue] = useState(
        scheduledAt || currentDate,
    );

    // Selected relief resource for the new distribution schedule
    const [scheduleResourceId, setScheduleResourceId] = useState('');
    // Selected location for the new distribution schedule
    const [scheduleLocationId, setScheduleLocationId] = useState('');

    const saveSchedule = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!scheduleResourceId || !scheduleValue) {
            return;
        }

        router.put(
            '/distribution-schedule',
            {
                scheduled_at: scheduleValue,
                resource_id: Number(scheduleResourceId),
                location_id: scheduleLocationId ? Number(scheduleLocationId) : null,
            },
            {
                preserveScroll: true,
            },
        );
    };

    // ============================================================
    // CRUD STATE
    // ============================================================

    const [editingFamily, setEditingFamily] = useState<Family | null>(null);

    const [editingDistribution, setEditingDistribution] =
        useState<Distribution | null>(null);

    const [deleting, setDeleting] = useState<Distribution | null>(null);

    // ============================================================
    // QR STATE
    // ============================================================

    const [qrDistribution, setQrDistribution] = useState<Distribution | null>(
        null,
    );

    const qrRef = useRef<HTMLDivElement>(null);

    const form = useForm<FormData>(emptyForm);

    // ============================================================
    // BUILD DISTRIBUTION ROWS
    // ============================================================

    const distributionRows = useMemo<DistributionRow[]>(() => {
        const latestDistributionByFamily = new Map<number, Distribution>();

        distributions.forEach((distribution) => {
            if (
                distribution.family_id === null ||
                distribution.family_id === undefined
            ) {
                return;
            }

            // Make sure the family ID is always treated as a number.
            const familyId = Number(distribution.family_id);

            if (!Number.isFinite(familyId)) {
                return;
            }

            const existing = latestDistributionByFamily.get(familyId);

            if (
                !existing ||
                new Date(distribution.distribution_date).getTime() >
                    new Date(existing.distribution_date).getTime()
            ) {
                latestDistributionByFamily.set(familyId, distribution);
            }
        });

        const rows: DistributionRow[] = [];

        families.forEach((family) => {
            const distribution = latestDistributionByFamily.get(family.id);

            // Every registered family must appear, including a family without
            // an existing distribution row (for example, during a first load).
            // The backend creates the persisted pending row when the page loads.
            if (!distribution) {
                return;
            }

            rows.push({
                family,
                distribution,
                // Display a relief only if that resource is in the current
                // Resources list. This prevents stale distribution rows from
                // showing deleted or unavailable resources.

                reliefName:
                    distribution.resource?.name ??
                    resources.find(
                        (resource) =>
                            Number(resource.id) ===
                            Number(distribution.resource_id),
                    )?.name ??
                    'None',

                quantity: Math.max(
                    1,
                    Math.ceil(
                        Math.max(1, Number(family.household_member || 1)) / 3,
                    ),
                ),
                date: distribution.distribution_date,
                status: distribution.status,
            });
        });

        return rows;
    }, [families, distributions, resources]);

    // ============================================================
    // STAFF / PUROK FILTER
    // ============================================================

    const filteredByStaff = useMemo(() => {
        if (!selectedStaffId) {
            return distributionRows;
        }

        const selectedStaff = staff.find(
            (member) => String(member.id) === selectedStaffId,
        );

        if (!selectedStaff?.purok_id) {
            return [];
        }

        return distributionRows.filter(
            (row) =>
                Number(row.family.purok_id) === Number(selectedStaff.purok_id),
        );
    }, [distributionRows, selectedStaffId, staff]);

    // ============================================================
    // SEARCH
    // ============================================================

    const filteredRows = useMemo(() => {
        const value = search.trim().toLowerCase();

        if (!value) {
            return filteredByStaff;
        }

        return filteredByStaff.filter((row) => {
            const family = row.family;

            return (
                family.family_id.toLowerCase().includes(value) ||
                family.family_name.toLowerCase().includes(value) ||
                family.head_name.toLowerCase().includes(value) ||
                family.purok?.name?.toLowerCase().includes(value)
            );
        });
    }, [search, filteredByStaff]);

    // ============================================================
    // STATUS
    // ============================================================

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'completed':
                return 'badge-green';

            case 'pending':
                return 'badge-slate';

            case 'in_transit':
                return 'badge-amber';

            case 'cancelled':
                return 'badge-red';

            default:
                return 'badge-slate';
        }
    };

    // ============================================================
    // DATE
    // ============================================================

    const formatDate = (date: string) => {
        if (!date) {
            return currentDate;
        }

        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // ============================================================
    // STATISTICS
    // ============================================================

    const totalFamilies = filteredRows.length;

    const completedFamilies = filteredRows.filter(
        (row) => row.status === 'completed',
    ).length;

    const pendingFamilies = filteredRows.filter(
        (row) => row.status === 'pending',
    ).length;

    // ============================================================
    // EDIT EXISTING DISTRIBUTION
    // ============================================================

    const openEditDistribution = (
        distribution: Distribution,
        family: Family,
    ) => {
        setEditingFamily(family);
        setEditingDistribution(distribution);

        form.setData({
            family_id: distribution.family_id,

            resource_id: distribution.resource_id,

            quantity: distribution.quantity ?? 1,

            additional_resource_id: distribution.additional_resource_id ?? '',

            additional_quantity: distribution.additional_quantity ?? 0,

            location_id: distribution.location_id ?? '',

            distribution_date: scheduledAt || currentDate,

            status: distribution.status ?? 'pending',

            notes: distribution.notes ?? '',
        });
    };

    // ============================================================
    // SUBMIT
    // ============================================================

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!editingDistribution) {
            console.error('No distribution selected for editing.');
            return;
        }

        const payload = {
            family_id: Number(form.data.family_id),

            resource_id: Number(form.data.resource_id),

            quantity: Number(form.data.quantity),

            additional_resource_id:
                form.data.additional_resource_id !== '' &&
                form.data.additional_resource_id !== null
                    ? Number(form.data.additional_resource_id)
                    : null,

            additional_quantity:
                form.data.additional_resource_id !== '' &&
                form.data.additional_resource_id !== null
                    ? Number(form.data.additional_quantity || 1)
                    : null,

            location_id:
                form.data.location_id !== '' && form.data.location_id !== null
                    ? Number(form.data.location_id)
                    : null,

            distribution_date: scheduledAt || currentDate,

            status: form.data.status,

            notes: form.data.notes || null,
        };

        console.log('UPDATING DISTRIBUTION:', editingDistribution.id);

        console.log('PAYLOAD:', payload);

        form.transform(() => payload);

        form.put(`/distribution/${editingDistribution.id}`, {
            preserveScroll: true,

            onStart: () => {
                console.log('UPDATE REQUEST STARTED');
            },

            onSuccess: () => {
                console.log('DISTRIBUTION UPDATED SUCCESSFULLY');

                setEditingFamily(null);
                setEditingDistribution(null);

                form.reset();
                form.clearErrors();
            },

            onError: (errors) => {
                console.error('UPDATE ERROR:', errors);
            },

            onFinish: () => {
                console.log('UPDATE REQUEST FINISHED');
            },
        });
    };

    // ============================================================
    // DELETE DISTRIBUTION
    // ============================================================

    const confirmDelete = () => {
        if (!deleting) {
            return;
        }

        router.delete(`/distribution/${deleting.id}`, {
            preserveScroll: true,

            onSuccess: () => {
                setDeleting(null);
            },
        });
    };

    // ============================================================
    // CLOSE QR
    // ============================================================

    const closeQr = () => {
        setQrDistribution(null);
    };

    // ============================================================
    // DOWNLOAD QR
    // ============================================================

    const downloadQr = () => {
        if (!qrRef.current) {
            return;
        }

        const canvas = qrRef.current.querySelector('canvas');

        if (!canvas) {
            return;
        }

        const link = document.createElement('a');

        link.download = `distribution-${qrDistribution?.qr_code ?? 'qr'}.png`;

        link.href = canvas.toDataURL('image/png');

        link.click();
    };

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <AppLayout
            title="Distribution"
            subtitle="Manage the current relief distribution"
        >
            <Head title="Distribution" />

            {/* ── DISTRIBUTION HISTORY DROPDOWN ── */}
            <div className="card mb-5">
                <div className="flex items-center gap-2 mb-3">
                    <History size={17} className="text-slate-500" />
                    <h2 className="font-semibold text-slate-800">Distribution History</h2>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                    Select a past distribution schedule to see which families received relief and their status.
                </p>
                <select
                    className="input-field w-full"
                    value={selectedScheduleId ?? ''}
                    onChange={(e) => {
                        setSelectedScheduleId(e.target.value ? Number(e.target.value) : null);
                        setSelectedHistoryPurok('');
                    }}
                >
                    <option value="">— Select a distribution schedule —</option>
                    {scheduleHistory.map((s) => (
                        <option key={s.id} value={s.id}>
                            {new Date(s.scheduled_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                            })}
                            {s.resource_name ? ` — ${s.resource_name}` : ''}
                            {s.location_name ? ` @ ${s.location_name}` : ''}
                        </option>
                    ))}
                </select>

                {/* HISTORY TABLE */}
                {selectedScheduleId !== null && (() => {
                    const schedule = scheduleHistory.find((s) => s.id === selectedScheduleId);
                    if (!schedule) return null;

                    // Apply purok filter (admin can choose; staff always sees only their own)
                    const visibleFamilies = selectedHistoryPurok
                        ? schedule.families.filter((f) => f.purok_name === selectedHistoryPurok)
                        : schedule.families;

                    const completedCount = visibleFamilies.filter((f) => f.status === 'completed').length;
                    const pendingCount   = visibleFamilies.filter((f) => f.status === 'pending').length;
                    const cancelledCount = visibleFamilies.filter((f) => f.status === 'cancelled').length;

                    return (
                        <div className="mt-4">
                            {/* Schedule meta — header row with purok dropdown on the right */}
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
                                {/* Left: stat chips */}
                                <div className="flex flex-wrap gap-4">
                                    {/* Date & Time */}
                                    <div>
                                        <span className="text-xs font-medium uppercase text-slate-400">Date &amp; Time</span>
                                        <p className="font-medium text-slate-800">
                                            {new Date(schedule.scheduled_at).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>

                                    {/* Location — always shown beside date */}
                                    <div>
                                        <span className="text-xs font-medium uppercase text-slate-400">Location</span>
                                        <p className="font-medium text-slate-800">
                                            {schedule.location_name ?? <span className="font-normal text-slate-400">—</span>}
                                        </p>
                                    </div>

                                    {schedule.resource_name && (
                                        <div>
                                            <span className="text-xs font-medium uppercase text-slate-400">Relief</span>
                                            <p className="font-medium text-slate-800">{schedule.resource_name}</p>
                                        </div>
                                    )}

                                    {/* Counts (reflect the filtered set) */}
                                    <div>
                                        <span className="text-xs font-medium uppercase text-slate-400">Families</span>
                                        <p className="font-medium text-slate-800">{visibleFamilies.length}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium uppercase text-slate-400">Completed</span>
                                        <p className="font-medium text-green-700">{completedCount}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium uppercase text-slate-400">Pending</span>
                                        <p className="font-medium text-amber-600">{pendingCount}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium uppercase text-slate-400">Cancelled</span>
                                        <p className="font-medium text-red-600">{cancelledCount}</p>
                                    </div>
                                </div>

                                {/* Right: Purok filter dropdown (admin sees all puroks; staff has only theirs) */}
                                {userRole === 'admin' && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-medium uppercase text-slate-400">Filter by Purok</span>
                                        <select
                                            className="input-field min-w-[180px]"
                                            value={selectedHistoryPurok}
                                            onChange={(e) => setSelectedHistoryPurok(e.target.value)}
                                        >
                                            <option value="">All Puroks</option>
                                            {puroks.map((p) => (
                                                <option key={p.id} value={p.name}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {visibleFamilies.length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-400">
                                    No families found{selectedHistoryPurok ? ` in ${selectedHistoryPurok}` : ''} for this schedule.
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-100">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                                                <th className="px-4 py-2">Family</th>
                                                <th className="px-4 py-2">Purok</th>
                                                <th className="px-4 py-2">Family Head</th>
                                                <th className="px-4 py-2">Members</th>
                                                <th className="px-4 py-2">Relief</th>
                                                <th className="px-4 py-2">Scanned By</th>
                                                <th className="px-4 py-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleFamilies.map((f) => (
                                                <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50">
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-medium text-slate-800">{f.family_name}</p>
                                                        <p className="text-xs text-slate-400">{f.family_code}</p>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-600">
                                                        {f.purok_name ?? <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-600">{f.head_name}</td>
                                                    <td className="px-4 py-2.5 text-slate-600">{f.household_member}</td>

                                                    {/* RELIEF */}
                                                    <td className="px-4 py-2.5 text-slate-600">
                                                        {f.resource_name ? (
                                                            <div>
                                                                <p>
                                                                    {f.quantity}&nbsp;
                                                                    <span className="text-xs text-slate-400">{f.resource_unit}</span>
                                                                    &nbsp;{f.resource_name}
                                                                </p>
                                                                {f.additional_resource_name && (
                                                                    <p className="text-xs text-purple-600">
                                                                        +{f.additional_quantity ?? 0}&nbsp;
                                                                        <span className="text-slate-400">{f.additional_resource_unit}</span>
                                                                        &nbsp;{f.additional_resource_name}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>

                                                    {/* SCANNED BY */}
                                                    <td className="px-4 py-2.5 text-slate-600">
                                                        {f.scanned_by ?? <span className="text-slate-300">—</span>}
                                                    </td>

                                                    <td className="px-4 py-2.5">
                                                        <span className={`badge ${getStatusClass(f.status)} capitalize`}>
                                                            {f.status.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* ── SUMMARY — visible to both roles ── */}
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">                <div className="card flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Users size={21} />
                    </div>

                    <div>
                        <p className="text-xs text-slate-400">Families</p>

                        <p className="text-xl font-semibold text-slate-800">
                            {totalFamilies}
                        </p>
                    </div>
                </div>

                <div className="card flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <Clock3 size={21} />
                    </div>

                    <div>
                        <p className="text-xs text-slate-400">Pending</p>

                        <p className="text-xl font-semibold text-slate-800">
                            {pendingFamilies}
                        </p>
                    </div>
                </div>

                <div className="card flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
                        <CheckCircle2 size={21} />
                    </div>

                    <div>
                        <p className="text-xs text-slate-400">Completed</p>

                        <p className="text-xl font-semibold text-slate-800">
                            {completedFamilies}
                        </p>
                    </div>
                </div>
            </div>

            {/* FILTERS — search visible to both; staff dropdown admin-only */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search
                        size={17}
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                    />

                    <input
                        type="text"
                        className="input-field pl-9"
                        placeholder="Search family, head, Family ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {userRole === 'admin' && (
                    <select
                        className="input-field sm:w-56"
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                    >
                        <option value="">All Staff / Puroks</option>

                        {staff.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                                {member.purok_id
                                    ? ` — Purok ${member.purok_id}`
                                    : ''}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* SCHEDULE FORM — admin only */}
            {userRole === 'admin' && (
            <form
                onSubmit={saveSchedule}
                className="card mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            >
                <div>
                    <h2 className="font-semibold text-slate-800">
                        Distribution Schedule
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Set the date, location, and relief for all family distribution records.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:items-end">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Date and time
                        </label>
                        <input
                            type="datetime-local"
                            className="input-field"
                            value={scheduleValue}
                            onChange={(e) =>
                                setScheduleValue(e.target.value)
                            }
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Location
                        </label>
                        <select
                            className="input-field min-w-[170px]"
                            value={scheduleLocationId}
                            onChange={(e) =>
                                setScheduleLocationId(e.target.value)
                            }
                        >
                            <option value="">Select location</option>
                            {locations.map((location) => (
                                <option
                                    key={location.id}
                                    value={String(location.id)}
                                >
                                    {location.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Relief resource
                        </label>
                        <select
                            className="input-field"
                            value={scheduleResourceId}
                            onChange={(e) =>
                                setScheduleResourceId(e.target.value)
                            }
                            required
                        >
                            <option value="">Select relief resource</option>
                            {resources.map((resource) => (
                                <option
                                    key={resource.id}
                                    value={String(resource.id)}
                                >
                                    {resource.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={!scheduleResourceId}
                    >
                        Add Schedule
                    </button>
                </div>
            </form>
            )} {/* end admin-only schedule form */}

            {/* DISTRIBUTION TABLE — visible to both admin and staff */}
            <div className="card overflow-x-auto p-0">
                <div className="border-b border-slate-100 px-4 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold text-slate-800">
                                Current Relief Distribution
                            </h2>

                            <p className="text-xs text-slate-400">
                                {new Date(
                                    scheduledAt || currentDate,
                                ).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-slate-400" />
                                Pending
                            </span>

                            <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                Completed
                            </span>
                        </div>
                    </div>
                </div>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                            <th className="px-4 py-3">Family</th>

                            <th className="px-4 py-3">Family Head</th>

                            <th className="px-4 py-3">Purok</th>

                            <th className="px-4 py-3">Relief</th>

                            <th className="px-4 py-3">Qty</th>

                            <th className="px-4 py-3">Scanned By</th>

                            <th className="px-4 py-3">Status</th>

                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredRows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-12 text-center text-slate-400"
                                >
                                    No families found.
                                </td>
                            </tr>
                        )}

                        {filteredRows.map((row) => (
                            <tr
                                key={row.distribution.id}
                                className="border-b border-slate-50 hover:bg-slate-50"
                            >
                                {/* FAMILY */}

                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Truck size={17} />
                                        </div>

                                        <div>
                                            <p className="font-medium text-slate-800">
                                                {row.family.family_name}
                                            </p>

                                            <p className="text-xs text-slate-400">
                                                {row.family.family_id}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                {/* FAMILY HEAD */}

                                <td className="px-4 py-3">
                                    <p className="font-medium text-slate-700">
                                        {row.family.head_name}
                                    </p>

                                    <p className="text-xs text-slate-400">
                                        {row.family.household_member}{' '}
                                        {row.family.household_member === 1
                                            ? 'household_member'
                                            : 'household member'}
                                    </p>
                                </td>

                                {/* PUROK */}

                                <td className="px-4 py-3 text-slate-600">
                                    {row.family.purok?.name ??
                                        `Purok ${row.family.purok_id}`}
                                </td>

                                {/* RELIEF */}

                                <td className="px-4 py-3 text-slate-600">
                                    <p>{row.reliefName}</p>

                                    {row.distribution.additional_resource
                                        ?.name && (
                                        <p className="text-xs text-purple-600">
                                            +{' '}
                                            {
                                                row.distribution
                                                    .additional_resource.name
                                            }
                                        </p>
                                    )}
                                </td>

                                {/* Quantity */}
                                <td className="px-4 py-3 text-slate-600">
                                    <p>{row.quantity}</p>

                                    {row.distribution
                                        .additional_resource_id && (
                                        <p className="text-xs text-purple-600">
                                            +{' '}
                                            {row.distribution
                                                .additional_quantity ?? 0}
                                        </p>
                                    )}
                                </td>

                                {/* SCANNED BY */}

                                <td className="px-4 py-3 text-slate-500">
                                    {row.distribution.distributor?.name ?? <span className="text-slate-300">—</span>}
                                </td>

                                {/* STATUS */}

                                <td className="px-4 py-3">
                                    <span
                                        className={`badge ${getStatusClass(
                                            row.status,
                                        )} capitalize`}
                                    >
                                        {row.status.replace('_', ' ')}
                                    </span>
                                </td>

                                {/* ACTIONS */}

                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1.5">
                                        {/* QR */}
                                        
                                        <button
                                            type="button"
                                            className="rounded-lg p-1.5 text-purple-500 hover:bg-purple-50"
                                            onClick={() =>
                                                setQrDistribution(
                                                    row.distribution,
                                                )
                                            }
                                            title="View / Scan QR Code"
                                        >
                                            <QrCode size={15} />
                                        </button>

                                        {/* EDIT */}
                                        {userRole === 'admin' && (
                                            <button
                                                type="button"
                                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                                onClick={() =>
                                                    openEditDistribution(
                                                        row.distribution,
                                                        row.family,
                                                    )
                                                }
                                                title="Edit Distribution"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                        )}

                                        {/* DELETE */}
                                        {userRole === 'admin' && (
                                            <button
                                                type="button"
                                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                                onClick={() =>
                                                    setDeleting(
                                                        row.distribution,
                                                    )
                                                }
                                                title="Delete Distribution"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* EDIT DISTRIBUTION MODAL — admin only */}
            {userRole === 'admin' && (
            <>
                <Modal
                    open={!!editingFamily}
                    onClose={() => {
                        setEditingFamily(null);
                        setEditingDistribution(null);
                        form.reset();
                        form.clearErrors();
                    }}
                    title={
                        editingDistribution
                            ? 'Edit Family Distribution'
                            : 'Set Family Distribution'
                    }
                >
                    <form onSubmit={submit} className="p-6">
                        <p className="mt-1 text-sm text-slate-500">
                            Edit the distribution details for{' '}
                            {editingFamily?.family_name ?? 'family'}.
                        </p>

                        <div className="mt-5 space-y-4">
                            {/* FAMILY */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Family
                                </label>

                                <input
                                    type="text"
                                    className="input-field"
                                    value={editingFamily?.family_name ?? ''}
                                    disabled
                                />
                            </div>

                            {/* RELIEF */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Relief
                                </label>

                                <select
                                    className="input-field"
                                    value={form.data.resource_id}
                                    onChange={(e) =>
                                        form.setData(
                                            'resource_id',
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="">Select relief</option>

                                    {resources.map((resource) => (
                                        <option
                                            key={resource.id}
                                            value={resource.id}
                                        >
                                            {resource.name}
                                        </option>
                                    ))}
                                </select>

                                {form.errors.resource_id && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.errors.resource_id}
                                    </p>
                                )}
                            </div>

                            {/* ADDITIONAL RESOURCE */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Additional Resource
                                </label>

                                <select
                                    className="input-field"
                                    value={form.data.additional_resource_id}
                                    onChange={(e) =>
                                        form.setData(
                                            'additional_resource_id',
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="">None</option>

                                    {resources.map((resource) => (
                                        <option
                                            key={resource.id}
                                            value={resource.id}
                                            disabled={
                                                String(resource.id) ===
                                                String(
                                                    form.data.resource_id,
                                                )
                                            }
                                        >
                                            {resource.name}
                                        </option>
                                    ))}
                                </select>

                                {form.errors.additional_resource_id && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.errors.additional_resource_id}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Additional Quantity
                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    className="input-field"
                                    value={form.data.additional_quantity}
                                    disabled={
                                        !form.data.additional_resource_id
                                    }
                                    onChange={(e) =>
                                        form.setData(
                                            'additional_quantity',
                                            e.target.value,
                                        )
                                    }
                                />

                                {form.errors.additional_quantity && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.errors.additional_quantity}
                                    </p>
                                )}
                            </div>

                            {/* QUANTITY */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Quantity
                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    className="input-field"
                                    value={Math.max(
                                        1,
                                        Math.ceil(
                                            Math.max(
                                                1,
                                                Number(
                                                    editingFamily?.household_member ||
                                                        1,
                                                ),
                                            ) / 3,
                                        ),
                                    )}
                                    readOnly
                                    aria-readonly="true"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Automatically calculated from household
                                    members (1 unit for every 1–3 members,
                                    minimum 1).
                                </p>

                                {form.errors.quantity && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.errors.quantity}
                                    </p>
                                )}
                            </div>

                            {/* LOCATION */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Relief Location
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
                                        Select location
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

                            {/* DATE */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Distribution Date
                                </label>

                                <input
                                    type="datetime-local"
                                    className="input-field"
                                    value={form.data.distribution_date}
                                    onChange={(e) =>
                                        form.setData(
                                            'distribution_date',
                                            e.target.value,
                                        )
                                    }
                                />
                            </div>

                            {/* STATUS */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
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
                                    <option value="pending">Pending</option>

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

                            {/* NOTES */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Notes
                                </label>

                                <textarea
                                    className="input-field min-h-20"
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
                        </div>

                        {/* BUTTONS */}

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setEditingFamily(null);
                                    setEditingDistribution(null);
                                    form.reset();
                                    form.clearErrors();
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={form.processing}
                            >
                                {form.processing
                                    ? 'Saving...'
                                    : editingDistribution
                                      ? 'Save Changes'
                                      : 'Save'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* DELETE DISTRIBUTION */}

                <ConfirmDialog
                    open={!!deleting}
                    onClose={() => setDeleting(null)}
                    onConfirm={confirmDelete}
                    message={`Delete distribution to "${
                        deleting?.recipient_name ?? 'this family'
                    }"? Completed distributions will restore stock.`}
                />
            </>
            )} {/* end admin-only edit/delete */}

            {/* QR MODAL — available to both admin and staff */}

            <Modal
                open={!!qrDistribution}
                onClose={closeQr}
                title="Family QR Code"
            >
                <div className="p-6 text-center">
                    <p className="mt-1 text-sm text-slate-500">
                        Scan this QR code using the Staff Scanner app.
                    </p>

                    {qrDistribution?.qr_code ? (
                        <div
                            ref={qrRef}
                            className="mt-5 flex justify-center rounded-xl bg-white p-5"
                        >
                            <QRCodeCanvas
                                value={qrDistribution.qr_code}
                                size={220}
                                level="M"
                            />
                        </div>
                    ) : (
                        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-8 text-slate-400">
                            <QrCode size={48} strokeWidth={1} />
                            <p className="text-sm">QR code not available for this distribution.</p>
                        </div>
                    )}

                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-700">
                            {qrDistribution?.recipient_name}
                        </p>

                        <p className="text-xs text-slate-400">
                            {qrDistribution?.qr_code}
                        </p>
                    </div>

                    <div className="mt-5 flex justify-center gap-2">
                        <button
                            type="button"
                            className="btn-secondary flex items-center gap-2"
                            onClick={downloadQr}
                        >
                            <Download size={16} />
                            Download QR
                        </button>

                        <button
                            type="button"
                            className="btn-primary"
                            onClick={closeQr}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
}

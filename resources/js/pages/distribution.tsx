import AppLayout from '@/layouts/app-layout';
import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import { Distribution, DistributionItem, Location, ResourceItem, ResourceSet, StockWarning } from '@/types/models';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Ban,
    CalendarPlus,
    CheckCircle2,
    Clock3,
    Download,
    Pencil,
    QrCode,
    Search,
    Trash2,
    Truck,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface Family {
    id: number;
    family_id: string;
    head_name: string;
    phone?: string | null;
    household_member: number;
    purok_id: number;
    status?: string;
    location_id?: number | null;

    purok?: {
        id: number;
        name: string;
    } | null;
}

interface Staff {
    id: number;
    name: string;
    location_id?: number | null;
    purok_id?: number | null;
    purok?: { id: number; name: string; location_id?: number | null } | null;
}

interface DistributionRow {
    family: Family;
    distribution: Distribution;
    reliefName: string;
    quantity: number;
    date: string;
    status: string;
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
    reason: string;
    assignment_mode: 'set' | 'individual' | '';
    resource_set_id: number | string;
    items: { resource_id: number | string; quantity: number | string }[];
}

interface ScheduleSummary {
    id: number;
    scheduled_at: string;
    resource_name: string | null;
    location_name: string | null;
    location_id: number | null;
    family_location_ids?: number[];
    cancelled_at: string | null;
    active_count: number;
    completed_count: number;
    cancelled_count: number;
    disaster_event_id: number | null;
    disaster_event_name: string | null;
}

interface DisasterEventOption {
    id: number;
    name: string;
    type: string;
    affected_area: string | null;
    starts_on: string;
    status: 'active' | 'completed' | 'cancelled';
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
    reason: '',
    assignment_mode: '',
    resource_set_id: '',
    items: [],
};

function toDateTimeLocal(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value.slice(0, 16);
    }

    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
}

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
    allLocations = [],
    resourceSets = [],
    schedules = [],
    disasterEvents = [],
    scheduleFamilyNeeds = { all: { families: 0, quantity: 0 }, by_location: {} },
}: {
    distributions: Distribution[];
    resources: ResourceItem[];
    locations: Location[];
    filters: {
        search?: string;
        status?: string;
        location_id?: string;
    };
    staff: Staff[];
    families: Family[];
    currentDate: string;
    scheduledAt: string;
    scheduleFamilyNeeds: {
        all: { families: number; quantity: number };
        by_location: Record<string, { families: number; quantity: number }>;
    };
    defaultSetResource?: ResourceItem | null;
    userRole: string;    allLocations?: { id: number; name: string }[];
    resourceSets?: ResourceSet[];
    schedules?: ScheduleSummary[];
    disasterEvents?: DisasterEventOption[];
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [filterLocationId, setFilterLocationId] = useState(filters.location_id ?? '');
    const [activeStatusTab, setActiveStatusTab] = useState<'all' | 'pending' | 'completed' | 'excluded'>('all');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleFilterId, setScheduleFilterId] = useState("");
    const [scheduleDetails, setScheduleDetails] = useState<ScheduleSummary | null>(null);
    const [scheduleDistributionRows, setScheduleDistributionRows] = useState<Distribution[]>([]);
    const [scheduleDetailsLoading, setScheduleDetailsLoading] = useState(false);
    const [scheduleDetailsError, setScheduleDetailsError] = useState('');
    const scheduleDetailsRequest = useRef<AbortController | null>(null);
    const [editingScheduleDate, setEditingScheduleDate] = useState(false);
    const [scheduleDateValue, setScheduleDateValue] = useState('');
    const [scheduleDateError, setScheduleDateError] = useState('');
    const [scheduleEventId, setScheduleEventId] = useState('');
    const [newScheduleEventId, setNewScheduleEventId] = useState('');
    const [scheduleAction, setScheduleAction] = useState<{
        schedule: ScheduleSummary;
        action: 'cancel' | 'delete';
    } | null>(null);
    const [scheduleError, setScheduleError] = useState('');

    const filteredSchedules = useMemo(
        () => filterLocationId
            ? schedules.filter((schedule) =>
                String(schedule.location_id ?? '') === filterLocationId ||
                schedule.family_location_ids?.includes(Number(filterLocationId)),
            )
            : schedules,
        [filterLocationId, schedules],
    );
    const filteredStaff = useMemo(
        () => filterLocationId
            ? staff.filter((member) =>
                String(member.location_id ?? member.purok?.location_id ?? '') === filterLocationId,
            )
            : staff,
        [filterLocationId, staff],
    );
    const selectedSchedule = schedules.find(
        (schedule) => String(schedule.id) === scheduleFilterId,
    );

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 15;

    const [scheduleValue, setScheduleValue] = useState(
        scheduledAt && scheduledAt.slice(0, 10) >= currentDate.slice(0, 10)
            ? scheduledAt
            : currentDate,
    );
    const minScheduleDate = `${currentDate.slice(0, 10)}T00:00`;

    // Selected relief resource for the new distribution schedule
    const [scheduleResourceId, setScheduleResourceId] = useState('');
    // Selected location for the new distribution schedule
    const [scheduleLocationId, setScheduleLocationId] = useState('');
    // Assignment mode: 'individual' or 'set'
    const [scheduleMode, setScheduleMode] = useState<'individual' | 'set'>('individual');
    // Selected resource set for the schedule (when mode = 'set')
    const [scheduleResourceSetId, setScheduleResourceSetId] = useState('');

    // Resources filtered by the selected location in the schedule form
    const scheduleResources = useMemo(() => {
        if (!scheduleLocationId) return resources;
        return resources.filter((r) => String(r.location_id) === scheduleLocationId);
    }, [resources, scheduleLocationId]);

    // Resource sets filtered by the selected location
    const scheduleSets = useMemo(() => {
        if (!scheduleLocationId) return resourceSets;
        return resourceSets.filter((s) => String(s.location_id) === scheduleLocationId);
    }, [resourceSets, scheduleLocationId]);

    const selectedScheduleNeeds = scheduleLocationId
        ? scheduleFamilyNeeds.by_location[scheduleLocationId] ?? { families: 0, quantity: 0 }
        : scheduleFamilyNeeds.all;
    const selectedScheduleResource = scheduleResources.find(
        (resource) => String(resource.id) === scheduleResourceId,
    );
    const selectedScheduleSet = scheduleSets.find(
        (set) => String(set.id) === scheduleResourceSetId,
    );
    const scheduleHasCapacity = scheduleMode === 'individual'
        ? (selectedScheduleResource?.available_quantity ?? selectedScheduleResource?.quantity ?? 0)
            >= selectedScheduleNeeds.quantity
        : (selectedScheduleSet?.available_sets ?? selectedScheduleSet?.sets_remaining ?? 0)
            >= selectedScheduleNeeds.families;

    const saveSchedule = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!scheduleValue) return;

        if (scheduleValue.slice(0, 10) < minScheduleDate.slice(0, 10)) {
            setScheduleError('Schedules cannot be set before today.');
            return;
        }

        if (scheduleMode === 'individual' && !scheduleResourceId) return;
        if (scheduleMode === 'set' && !scheduleResourceSetId) return;
        setScheduleError('');

        // For set mode, pick the first resource from the set as the required resource_id
        const payload: Record<string, string | number | null> = {
            scheduled_at: scheduleValue,
            disaster_event_id: newScheduleEventId ? Number(newScheduleEventId) : null,
            location_id: scheduleLocationId ? Number(scheduleLocationId) : null,
        };

        if (scheduleMode === 'set') {
            payload.assignment_mode = 'set';
            payload.resource_set_id = Number(scheduleResourceSetId);
            // resource_id is required by the backend — use the first item's resource
            const selectedSet = resourceSets.find((s) => String(s.id) === scheduleResourceSetId);
            const firstResourceId = selectedSet?.items?.[0]?.resource_id;
            payload.resource_id = firstResourceId ?? Number(scheduleResourceId);
        } else {
            payload.assignment_mode = 'individual';
            payload.resource_id = Number(scheduleResourceId);
        }

        router.put('/distribution-schedule', payload, {
            preserveScroll: true,
            onSuccess: () => setShowScheduleModal(false),
            onError: (errors) => setScheduleError(Object.values(errors)[0] ?? 'Unable to save this schedule.'),
        });
    };

    const confirmScheduleAction = () => {
        if (!scheduleAction) return;
        const { schedule, action } = scheduleAction;
        const options = {
            preserveScroll: true,
            onError: (errors: Record<string, string>) => setScheduleError(Object.values(errors)[0] ?? 'Unable to update this schedule.'),
            onSuccess: () => setScheduleError(''),
            onFinish: () => setScheduleAction(null),
        };

        if (action === 'cancel') {
            router.post(`/distribution-schedule/${schedule.id}/cancel`, {}, options);
        } else {
            router.delete(`/distribution-schedule/${schedule.id}`, options);
        }
    };

    // ============================================================
    // CRUD STATE
    // ============================================================

    const [editingFamily, setEditingFamily] = useState<Family | null>(null);

    const [editingDistribution, setEditingDistribution] =
        useState<Distribution | null>(null);

    const [deleting, setDeleting] = useState<Distribution | null>(null);

    // ============================================================
    // EXCLUSION STATE
    // ============================================================

    const [excludingDistribution, setExcludingDistribution] = useState<Distribution | null>(null);
    const [excludeReason, setExcludeReason] = useState('');
    const [excludeError, setExcludeError] = useState('');

    // ============================================================
    // QR STATE
    // ============================================================

    const [qrDistribution, setQrDistribution] = useState<Distribution | null>(
        null,
    );

    const qrRef = useRef<HTMLDivElement>(null);

    const form = useForm<FormData>(emptyForm);

    const [stockWarnings, setStockWarnings] = useState<StockWarning[]>([]);
    const [stockCheckLoading, setStockCheckLoading] = useState(false);
    const [stockOk, setStockOk] = useState(false);

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

            if (
                scheduleFilterId &&
                String(distribution.schedule_id ?? '') !== scheduleFilterId
            ) {
                return;
            }

            const existing = latestDistributionByFamily.get(familyId);

            if (
                !existing ||
                new Date(distribution.distribution_date).getTime() >
                    new Date(existing.distribution_date).getTime() ||
                (new Date(distribution.distribution_date).getTime() ===
                    new Date(existing.distribution_date).getTime() &&
                    distribution.id > existing.id)
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
                    distribution.resource_set?.name ??
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
    }, [families, distributions, resources, scheduleFilterId]);

    // ============================================================
    // BARANGAY FILTER — now handled server-side via Inertia visit
    // ============================================================

    const handleLocationChange = (locationId: string) => {
        setFilterLocationId(locationId);
        setScheduleFilterId('');
        setSelectedStaffId('');
        router.visit('/distribution', {
            data: {
                search: search || undefined,
                location_id: locationId || undefined,
            },
            preserveState: true,
            replace: true,
        });
    };

    const closeScheduleDetails = () => {
        scheduleDetailsRequest.current?.abort();
        scheduleDetailsRequest.current = null;
        setScheduleDetails(null);
        setScheduleDetailsLoading(false);
    };

    const openScheduleDetails = async (schedule: ScheduleSummary) => {
        scheduleDetailsRequest.current?.abort();
        const controller = new AbortController();
        scheduleDetailsRequest.current = controller;
        setShowScheduleModal(false);
        setScheduleFilterId(String(schedule.id));
        setScheduleDetails(schedule);
        setScheduleDistributionRows([]);
        setScheduleDetailsError('');
        setScheduleDetailsLoading(true);
        setEditingScheduleDate(false);
        setScheduleDateValue(toDateTimeLocal(schedule.scheduled_at));
        setScheduleEventId(schedule.disaster_event_id ? String(schedule.disaster_event_id) : '');
        setScheduleDateError('');

        try {
            const response = await fetch(`/distribution-schedule/${schedule.id}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                signal: controller.signal,
            });

            const result = await response.json() as {
                distributions?: Distribution[];
                message?: string;
            };

            if (!response.ok) {
                throw new Error(result.message ?? 'Unable to load this schedule.');
            }

            if (scheduleDetailsRequest.current === controller) {
                setScheduleDistributionRows(result.distributions ?? []);
            }
        } catch (error) {
            if (!controller.signal.aborted && scheduleDetailsRequest.current === controller) {
                console.error('Failed to load distribution schedule details.', error);
                setScheduleDetailsError(error instanceof Error ? error.message : 'Unable to load this schedule.');
            }
        } finally {
            if (scheduleDetailsRequest.current === controller) {
                setScheduleDetailsLoading(false);
            }
        }
    };

    const saveScheduleDate = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!scheduleDetails || !scheduleDateValue) {
            return;
        }

        if (scheduleDateValue.slice(0, 10) < minScheduleDate.slice(0, 10)) {
            setScheduleDateError('Schedules cannot be set before today.');
            return;
        }

        setScheduleDateError('');
        router.put(`/distribution-schedule/${scheduleDetails.id}`, {
            scheduled_at: scheduleDateValue,
            disaster_event_id: scheduleEventId ? Number(scheduleEventId) : null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setScheduleDetails((schedule) => schedule
                    ? {
                        ...schedule,
                        scheduled_at: scheduleDateValue.replace('T', ' '),
                        disaster_event_id: scheduleEventId ? Number(scheduleEventId) : null,
                        disaster_event_name: disasterEvents.find((event) => String(event.id) === scheduleEventId)?.name ?? null,
                    }
                    : schedule);
                setEditingScheduleDate(false);
            },
            onError: (errors) => setScheduleDateError(Object.values(errors)[0] ?? 'Unable to update this schedule.'),
        });
    };

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
                family.head_name.toLowerCase().includes(value) ||
                family.purok?.name?.toLowerCase().includes(value)
            );
        });
    }, [search, filteredByStaff]);

    const tabFilteredRows = useMemo(() => {
        switch (activeStatusTab) {
            case 'pending':
                return filteredRows.filter(
                    (row) => row.distribution.status === 'pending' && !row.distribution.excluded
                );
            case 'completed':
                return filteredRows.filter((row) => row.distribution.status === 'completed');
            case 'excluded':
                return filteredRows.filter((row) => row.distribution.excluded === true);
            default:
                return filteredRows;
        }
    }, [filteredRows, activeStatusTab]);

    // Filter by selected schedule
    const scheduleFilteredRows = useMemo(() => {
        if (!scheduleFilterId) return tabFilteredRows;
        return tabFilteredRows.filter((row) =>
            String(row.distribution.schedule_id ?? "") === scheduleFilterId
        );
    }, [tabFilteredRows, scheduleFilterId]);

    // ============================================================
    // PAGINATION
    // ============================================================
    const totalPages = Math.max(1, Math.ceil(scheduleFilteredRows.length / rowsPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedRows = scheduleFilteredRows.slice(
        (safePage - 1) * rowsPerPage,
        safePage * rowsPerPage,
    );

    // Reset to page 1 when filters or tab change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, activeStatusTab, selectedStaffId, filterLocationId, scheduleFilterId]);

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

    const renderStatusBadge = (distribution: Distribution) => {
        if (distribution.excluded) {
            return (
                <div>
                    <span className="badge-red">Excluded</span>
                    {distribution.exclusion_reason && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]"
                           title={distribution.exclusion_reason}>
                            {distribution.exclusion_reason}
                        </p>
                    )}
                </div>
            );
        }
        return <span className={getStatusClass(distribution.status)}>{distribution.status}</span>;
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

            distribution_date: toDateTimeLocal(distribution.distribution_date),

            status: distribution.status ?? 'pending',

            notes: distribution.notes ?? '',

            reason: (distribution as Distribution & { reason?: string }).reason ?? '',


            assignment_mode: (distribution.assignment_mode as 'set' | 'individual' | '') ?? '',

            resource_set_id: distribution.resource_set_id ?? '',

            items: distribution.items?.map((i: DistributionItem) => ({
                resource_id: i.resource_id,
                quantity: i.quantity,
            })) ?? [],
        });

        setStockWarnings([]);
        setStockOk(false);

        if (distribution.assignment_mode === 'set' && distribution.resource_set_id) {
            runStockCheck('set', distribution.resource_set_id, undefined, distribution.location_id ?? undefined, distribution.id);
        } else if (distribution.assignment_mode === 'individual' && distribution.items?.length) {
            runStockCheck('individual', undefined, distribution.items.map((i: DistributionItem) => ({
                resource_id: i.resource_id, quantity: i.quantity,
            })), distribution.location_id ?? undefined, distribution.id);
        }
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

            distribution_date: form.data.distribution_date,

            status: form.data.status,

            notes: form.data.notes || null,

            reason: form.data.reason || null,


            assignment_mode: form.data.assignment_mode || null,

            resource_set_id: form.data.assignment_mode === 'set' && form.data.resource_set_id
                ? Number(form.data.resource_set_id)
                : null,

            items: form.data.assignment_mode === 'individual'
                ? form.data.items.map((i) => ({
                      resource_id: Number(i.resource_id),
                      quantity: Number(i.quantity),
                  }))
                : [],
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
    // EXCLUSION HANDLERS
    // ============================================================

    const openExcludeModal = (distribution: Distribution) => {
        setExcludingDistribution(distribution);
        setExcludeReason('');
        setExcludeError('');
    };

    const handleExcludeConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!excludingDistribution) return;

        router.post(
            `/distribution/${excludingDistribution.id}/exclude`,
            { reason: excludeReason || null },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setExcludingDistribution(null);
                    setExcludeReason('');
                    setExcludeError('');
                },
                onError: (errors) => {
                    setExcludeError(errors.exclude ?? 'An error occurred.');
                },
            }
        );
    };

    const handleInclude = (distribution: Distribution) => {
        router.post(
            `/distribution/${distribution.id}/include`,
            {},
            {
                preserveScroll: true,
                onError: (errors) => {
                    console.error('Include error:', errors);
                },
            }
        );
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
    // STOCK CHECK
    // ============================================================

    const runStockCheck = async (
        mode: 'set' | 'individual',
        resourceSetId?: number | string,
        items?: { resource_id: number | string; quantity: number | string }[],
        locationId?: number | string,
        distributionId?: number,
    ) => {
        setStockCheckLoading(true);
        setStockWarnings([]);
        setStockOk(false);

        try {
            const body: Record<string, unknown> = { assignment_mode: mode };
            if (mode === 'set') body.resource_set_id = resourceSetId;
            if (mode === 'individual') body.items = items;
            if (locationId) body.location_id = locationId;
            if (distributionId) body.distribution_id = distributionId;

            const csrfMeta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
            const response = await fetch('/distribution/check-stock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfMeta?.content ?? '',
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                const json = await response.json() as { warnings: StockWarning[] };
                setStockWarnings(json.warnings);
                setStockOk(json.warnings.length === 0);
            }
        } catch {
            // fail silently — stock check is informational only
        } finally {
            setStockCheckLoading(false);
        }
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


            {/* ── SCHEDULE BUTTON — admin only ── */}
            {userRole === 'admin' && (
                <div className="mb-4 flex justify-end">
                    <button
                        type="button"
                        className="btn-primary flex items-center gap-2"
                        onClick={() => {
                            setNewScheduleEventId('');
                            setScheduleError('');
                            setShowScheduleModal(true);
                        }}
                    >
                        <CalendarPlus size={16} />
                        New Schedule
                    </button>
                </div>
            )}

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

                {userRole === 'admin' && allLocations.length > 0 && (
                    <select
                        className="input-field sm:w-44"
                        value={filterLocationId}
                        onChange={(e) => handleLocationChange(e.target.value)}
                    >
                        <option value="">All Barangays</option>
                        {allLocations.map((l) => (
                            <option key={l.id} value={String(l.id)}>{l.name}</option>
                        ))}
                    </select>
                )}

                {userRole === 'admin' && (
                    <select
                        className="input-field sm:w-56"
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                    >
                        <option value="">All Staff / Puroks</option>

                        {filteredStaff.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                                {member.purok_id
                                    ? ` — ${member.purok?.name ?? ('Purok ' + member.purok_id)}`
                                    : ''}
                            </option>
                        ))}
                    </select>
                )}

                {/* SCHEDULE FILTER */}
                {userRole === 'admin' && filteredSchedules.length > 0 && (
                    <select
                        className="input-field sm:w-64"
                        value={scheduleFilterId}
                        onChange={(e) => setScheduleFilterId(e.target.value)}
                    >
                        <option value="">All Schedules</option>
                        {filteredSchedules.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                                #{s.id} — {new Date(s.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {s.resource_name ? ` · ${s.resource_name}` : ''}
                                {s.location_name ? ` · ${s.location_name}` : ''}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* STATUS FILTER TABS */}
            <div className="flex flex-wrap gap-1 mt-3 mb-2">
              {(['all', 'pending', 'completed', 'excluded'] as const).map((tab) => {
                const counts = {
                  all:       filteredRows.length,
                  pending:   filteredRows.filter(r => r.distribution.status === 'pending' && !r.distribution.excluded).length,
                  completed: filteredRows.filter(r => r.distribution.status === 'completed').length,
                  excluded:  filteredRows.filter(r => r.distribution.excluded === true).length,
                };
                const label = { all: 'All', pending: 'Pending', completed: 'Completed', excluded: 'Excluded' };
                const isActive = activeStatusTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveStatusTab(tab)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label[tab]} <span className="ml-1 opacity-75">{counts[tab]}</span>
                  </button>
                );
              })}
            </div>

            {/* SCHEDULE MODAL — admin only */}
            {userRole === 'admin' && (
            <Modal
                open={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                title="New Distribution Schedule"
            >
                <form onSubmit={saveSchedule} className="space-y-4">
                    {scheduleError && (
                        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                            {scheduleError}
                        </p>
                    )}
                    <p className="text-xs text-slate-500">
                        Set the date, location, and relief for active families at the selected location, or across all locations.
                    </p>
                    {selectedScheduleNeeds.families === 0 && (
                        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                            No active families are available for this location.
                        </p>
                    )}
                    <div>
                        <label className="label">Date and time</label>
                        <input
                            type="datetime-local"
                            className="input-field"
                            value={scheduleValue}
                            min={minScheduleDate}
                            onChange={(e) => setScheduleValue(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Disaster event</label>
                        <select
                            className="input-field"
                            value={newScheduleEventId}
                            onChange={(e) => setNewScheduleEventId(e.target.value)}
                        >
                            <option value="">No event association</option>
                            {disasterEvents
                                .filter((event) => event.status === 'active')
                                .map((event) => (
                                    <option key={event.id} value={String(event.id)}>
                                        {event.name} ({event.type})
                                    </option>
                                ))}
                        </select>
                        {disasterEvents.length === 0 && (
                            <p className="mt-1 text-xs text-slate-500">
                                <Link href="/disasters" className="text-blue-600 hover:underline">Create a disaster event</Link> to link this schedule.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="label">Location</label>
                        <select
                            className="input-field"
                            value={scheduleLocationId}
                            onChange={(e) => {
                                setScheduleLocationId(e.target.value);
                                setScheduleResourceId('');
                                setScheduleResourceSetId('');
                            }}
                        >
                            <option value="">All locations</option>
                            {locations.map((location) => (
                                <option key={location.id} value={String(location.id)}>
                                    {location.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Assignment mode toggle */}
                    <div>
                        <label className="label">Assignment type</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                    scheduleMode === 'individual'
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                                onClick={() => { setScheduleMode('individual'); setScheduleResourceSetId(''); }}
                            >
                                Individual Resource
                            </button>
                            <button
                                type="button"
                                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                    scheduleMode === 'set'
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                                onClick={() => { setScheduleMode('set'); setScheduleResourceId(''); }}
                            >
                                Resource Set
                            </button>
                        </div>
                    </div>

                    {/* Individual resource dropdown */}
                    {scheduleMode === 'individual' && (
                        <div>
                            <label className="label">Relief resource</label>
                            <select
                                className="input-field"
                                value={scheduleResourceId}
                                onChange={(e) => setScheduleResourceId(e.target.value)}
                                required
                            >
                                <option value="">Select relief resource</option>
                                {scheduleResources.map((resource) => (
                                    <option
                                        key={resource.id}
                                        value={String(resource.id)}
                                        disabled={(resource.available_quantity ?? resource.quantity) < selectedScheduleNeeds.quantity}
                                    >
                                        {resource.name} ({resource.available_quantity ?? resource.quantity} {resource.unit} available)
                                        {scheduleLocationId ? '' : resource.location ? ` — ${resource.location.name}` : ''}
                                    </option>
                                ))}
                            </select>
                            {scheduleResources.length === 0 && (
                                <p className="mt-1 text-xs text-amber-600">
                                    No resources found{scheduleLocationId ? ' at this location' : ''}.
                                </p>
                            )}
                            {selectedScheduleNeeds.families > 0 && (
                                <p className="mt-1 text-xs text-slate-500">
                                    {selectedScheduleNeeds.quantity} {scheduleResources.find((resource) => String(resource.id) === scheduleResourceId)?.unit ?? 'units'} required for {selectedScheduleNeeds.families} active families. Reserved stock is unavailable to other schedules.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Resource set dropdown */}
                    {scheduleMode === 'set' && (
                        <div>
                            <label className="label">Resource set</label>
                            <select
                                className="input-field"
                                value={scheduleResourceSetId}
                                onChange={(e) => setScheduleResourceSetId(e.target.value)}
                                required
                            >
                                <option value="">Select resource set</option>
                                {scheduleSets.map((set) => (
                                    <option
                                        key={set.id}
                                        value={String(set.id)}
                                        disabled={(set.available_sets ?? set.sets_remaining ?? 0) < selectedScheduleNeeds.families}
                                    >
                                        {set.name} ({set.items?.length ?? 0} items, {set.available_sets ?? set.sets_remaining ?? 0} available)
                                        {scheduleLocationId ? '' : set.location ? ` — ${set.location.name}` : ''}
                                    </option>
                                ))}
                            </select>
                            {scheduleSets.length === 0 && (
                                <p className="mt-1 text-xs text-amber-600">
                                    No resource sets found{scheduleLocationId ? ' at this location' : ''}.
                                </p>
                            )}
                            {selectedScheduleNeeds.families > 0 && (
                                <p className="mt-1 text-xs text-slate-500">
                                    {selectedScheduleNeeds.families} active families need one set each. Reserved sets are unavailable to other schedules.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setShowScheduleModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={
                                !scheduleValue ||
                                selectedScheduleNeeds.families === 0 ||
                                !scheduleHasCapacity ||
                                (scheduleMode === 'individual' && !scheduleResourceId) ||
                                (scheduleMode === 'set' && !scheduleResourceSetId)
                            }
                        >
                            Schedule Distribution
                        </button>
                    </div>
                </form>

                <div className="mt-6 border-t border-slate-200 pt-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">Existing schedules</h3>
                    {filteredSchedules.length === 0 ? (
                        <p className="text-sm text-slate-500">No schedules have been created.</p>
                    ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {filteredSchedules.map((schedule) => (
                                <button
                                    type="button"
                                    key={schedule.id}
                                    className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/40"
                                    onClick={() => openScheduleDetails(schedule)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-slate-800">
                                            {new Date(schedule.scheduled_at).toLocaleString()}
                                            {schedule.cancelled_at && (
                                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Cancelled</span>
                                            )}
                                        </p>
                                        <p className="truncate text-xs text-slate-500">
                                            {schedule.resource_name ?? 'Resource'}{schedule.location_name ? ` · ${schedule.location_name}` : ' · All locations'}
                                            {schedule.disaster_event_name ? ` · ${schedule.disaster_event_name}` : ''}
                                            {' · '}{schedule.active_count} active, {schedule.completed_count} completed, {schedule.cancelled_count} cancelled
                                        </p>
                                    </div>
                                    <span className="text-xs font-medium text-blue-600">View details</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
            )} {/* end admin-only schedule modal */}

            {userRole === 'admin' && scheduleDetails && (
                <Modal
                    open
                    onClose={closeScheduleDetails}
                    title={`Schedule #${scheduleDetails.id} details`}
                    wide
                >
                    <div className="mb-5 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
                        <p><span className="font-medium text-slate-500">Date:</span> {new Date(scheduleDetails.scheduled_at).toLocaleString()}</p>
                        <p><span className="font-medium text-slate-500">Barangay:</span> {scheduleDetails.location_name ?? 'All locations'}</p>
                        <p><span className="font-medium text-slate-500">Relief:</span> {scheduleDetails.resource_name ?? 'Resource'}</p>
                        <p><span className="font-medium text-slate-500">Disaster event:</span> {scheduleDetails.disaster_event_name ?? 'None'}</p>
                        <p><span className="font-medium text-slate-500">Status:</span> {scheduleDetails.cancelled_at ? 'Cancelled' : 'Active'}</p>
                        <p><span className="font-medium text-slate-500">Active:</span> {scheduleDetails.active_count}</p>
                        <p><span className="font-medium text-slate-500">Completed:</span> {scheduleDetails.completed_count}</p>
                        <p><span className="font-medium text-slate-500">Cancelled distributions:</span> {scheduleDetails.cancelled_count}</p>
                    </div>

                    {editingScheduleDate ? (
                        <form onSubmit={saveScheduleDate} className="mb-5 flex flex-wrap items-end gap-3">
                            <label className="flex-1">
                                <span className="label">Schedule date and time</span>
                                <input
                                    type="datetime-local"
                                    className="input-field"
                                    value={scheduleDateValue}
                                    min={minScheduleDate}
                                    onChange={(event) => setScheduleDateValue(event.target.value)}
                                    required
                                />
                            </label>
                            <label className="flex-1">
                                <span className="label">Disaster event</span>
                                <select
                                    className="input-field"
                                    value={scheduleEventId}
                                    onChange={(event) => setScheduleEventId(event.target.value)}
                                >
                                    <option value="">No event association</option>
                                    {disasterEvents.map((event) => (
                                        <option key={event.id} value={String(event.id)}>
                                            {event.name} ({event.type}{event.status !== 'active' ? ` · ${event.status}` : ''})
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button type="submit" className="btn-primary">Save date</button>
                            <button type="button" className="btn-secondary" onClick={() => setEditingScheduleDate(false)}>Cancel</button>
                            {scheduleDateError && <p className="w-full text-sm text-red-600">{scheduleDateError}</p>}
                        </form>
                    ) : (
                        <div className="mb-5 flex justify-end">
                            <button
                                type="button"
                                className="btn-secondary inline-flex items-center gap-2"
                                onClick={() => setEditingScheduleDate(true)}
                            >
                                <Pencil size={15} /> Edit schedule
                            </button>
                        </div>
                    )}

                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Family distributions</h3>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        {scheduleDetailsLoading && (
                            <p className="p-4 text-sm text-slate-500">Loading schedule details…</p>
                        )}
                        {scheduleDetailsError && (
                            <p className="p-4 text-sm text-red-600">{scheduleDetailsError}</p>
                        )}
                        {!scheduleDetailsLoading && !scheduleDetailsError && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-3 py-2">Family</th>
                                    <th className="px-3 py-2">Purok</th>
                                    <th className="px-3 py-2">Relief</th>
                                    <th className="px-3 py-2">Quantity</th>
                                    <th className="px-3 py-2">Receiver</th>
                                    <th className="px-3 py-2">Scanned by</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Notes</th>
                                    <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scheduleDistributionRows.length === 0 ? (
                                    <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">No family distributions are linked to this schedule.</td></tr>
                                ) : scheduleDistributionRows
                                    .map((distribution) => {
                                        const family = families.find((item) => item.id === distribution.family_id) ??
                                            (distribution.family
                                                ? { ...distribution.family, status: 'inactive' }
                                                : undefined);
                                        return (
                                            <tr key={distribution.id} className="border-t border-slate-100">
                                                <td className="px-3 py-2">{family?.head_name ?? distribution.recipient_name}</td>
                                                <td className="px-3 py-2">{family?.purok?.name ?? '—'}</td>
                                                <td className="px-3 py-2">
                                                    {distribution.resource_set?.name ?? distribution.resource?.name ?? scheduleDetails.resource_name ?? '—'}
                                                    {distribution.additional_resource?.name && (
                                                        <span className="block text-xs text-purple-600">
                                                            + {distribution.additional_resource.name} ({distribution.additional_quantity ?? 0})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">{distribution.quantity}</td>
                                                <td className="px-3 py-2">{distribution.receiver || '—'}</td>
                                                <td className="px-3 py-2">{distribution.scanned_by || '—'}</td>
                                                <td className="px-3 py-2 capitalize">{distribution.excluded ? 'Excluded' : distribution.status.replace('_', ' ')}</td>
                                                <td className="px-3 py-2">{distribution.notes || '—'}</td>
                                                <td className="px-3 py-2 text-right">
                                                    {family && (
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                                                            onClick={() => {
                                                                closeScheduleDetails();
                                                                openEditDistribution(distribution, family);
                                                            }}
                                                        >
                                                            <Pencil size={13} /> Edit distribution
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                        )}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        {scheduleDetails.active_count > 0 && !scheduleDetails.cancelled_at && (
                            <button type="button" className="btn-secondary text-amber-700" onClick={() => {
                                setScheduleAction({ schedule: scheduleDetails, action: 'cancel' });
                                closeScheduleDetails();
                            }}>
                                <Ban size={14} className="mr-1 inline" /> Cancel schedule
                            </button>
                        )}
                        {scheduleDetails.completed_count === 0 && (
                            <button type="button" className="btn-secondary text-red-600" onClick={() => {
                                setScheduleAction({ schedule: scheduleDetails, action: 'delete' });
                                closeScheduleDetails();
                            }}>
                                <Trash2 size={14} className="mr-1 inline" /> Delete schedule
                            </button>
                        )}
                    </div>
                </Modal>
            )}

            <ConfirmDialog
                open={!!scheduleAction}
                onClose={() => setScheduleAction(null)}
                onConfirm={confirmScheduleAction}
                title={scheduleAction?.action === 'cancel' ? 'Cancel schedule?' : 'Delete schedule?'}
                confirmLabel={scheduleAction?.action === 'cancel' ? 'Cancel schedule' : 'Delete schedule'}
                message={scheduleAction?.action === 'cancel'
                    ? 'All pending and in-transit distributions in this schedule will be cancelled. Completed distributions are kept, and reserved resources will be released.'
                    : 'This permanently deletes the schedule and its distributions. Schedules with completed distributions cannot be deleted.'}
            />

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
                                    selectedSchedule?.scheduled_at || scheduledAt || currentDate,
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
                            <th className="px-3 py-3 w-10 text-center">#</th>
                            <th className="px-4 py-3">Family</th>

                            <th className="px-4 py-3">Family Head</th>

                            <th className="px-4 py-3">Purok</th>

                            <th className="px-4 py-3">Relief</th>

                            <th className="px-4 py-3">Qty</th>

                            <th className="px-4 py-3">Status</th>

                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {paginatedRows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-12 text-center text-slate-400"
                                >
                                    No families found.
                                </td>
                            </tr>
                        )}

                        {paginatedRows.map((row, idx) => (
                            <tr
                                key={row.distribution.id}
                                className="border-b border-slate-50 hover:bg-slate-50"
                            >
                                {/* ROW NUMBER */}
                                <td className="px-3 py-3 text-center text-xs text-slate-400">
                                    {(safePage - 1) * rowsPerPage + idx + 1}
                                </td>

                                {/* FAMILY */}

                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Truck size={17} />
                                        </div>

                                        <div>
                                            <p className="font-medium text-slate-800">
                                                {row.family.family_id}
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

                                {/* STATUS */}

                                <td className="px-4 py-3">
                                    {renderStatusBadge(row.distribution)}
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

                                        {/* EXCLUDE — only for pending + non-excluded rows, admin only */}
                                        {userRole === 'admin' && row.distribution.status === 'pending' && !row.distribution.excluded && (
                                            <button
                                                type="button"
                                                onClick={() => openExcludeModal(row.distribution)}
                                                className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                                            >
                                                Exclude
                                            </button>
                                        )}

                                        {/* INCLUDE — only for excluded rows, admin only */}
                                        {userRole === 'admin' && row.distribution.excluded && (
                                            <button
                                                type="button"
                                                onClick={() => handleInclude(row.distribution)}
                                                className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                                            >
                                                Include
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* PAGINATION CONTROLS */}
                {scheduleFilteredRows.length > rowsPerPage && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
                        <p className="text-xs text-slate-500">
                            Showing <span className="font-medium">{(safePage - 1) * rowsPerPage + 1}</span>
                            {' '}–{' '}
                            <span className="font-medium">{Math.min(safePage * rowsPerPage, scheduleFilteredRows.length)}</span>
                            {' '}of{' '}
                            <span className="font-medium">{tabFilteredRows.length}</span> families
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                            >
                                ← Prev
                            </button>
                            <span className="px-2 text-xs text-slate-500">
                                Page <span className="font-medium">{safePage}</span> of {totalPages}
                            </span>
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
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
                        setStockWarnings([]);
                        setStockOk(false);
                        setStockCheckLoading(false);
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
                            {editingFamily?.head_name ?? 'family'}.
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
                                    value={editingFamily?.head_name ?? ''}
                                    disabled
                                />
                            </div>

                            {/* ASSIGNMENT MODE */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Resource Assignment
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="assignment_mode"
                                            value="set"
                                            checked={form.data.assignment_mode === 'set'}
                                            onChange={() => {
                                                form.setData('assignment_mode', 'set');
                                                form.setData('items', []);
                                            }}
                                            className="h-4 w-4 text-blue-600"
                                        />
                                        <span className="text-sm text-slate-700">Assign a Set</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="assignment_mode"
                                            value="individual"
                                            checked={form.data.assignment_mode === 'individual'}
                                            onChange={() => {
                                                form.setData('assignment_mode', 'individual');
                                                form.setData('resource_set_id', '');
                                            }}
                                            className="h-4 w-4 text-blue-600"
                                        />
                                        <span className="text-sm text-slate-700">Assign Individual Items</span>
                                    </label>
                                </div>
                            </div>

                            {/* SET DROPDOWN — shown when mode = 'set' */}
                            {form.data.assignment_mode === 'set' && (
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">
                                        Resource Set
                                    </label>
                                    <select
                                        className="input-field"
                                        value={form.data.resource_set_id}
                                        onChange={(e) => {
                                            form.setData('resource_set_id', e.target.value);

                                            if (e.target.value) {
                                                runStockCheck('set', e.target.value, undefined, form.data.location_id || undefined, editingDistribution?.id);
                                            }
                                        }}
                                    >
                                        <option value="">— Select a set —</option>
                                        {resourceSets.map((set) => (
                                            <option
                                                key={set.id}
                                                value={set.id}
                                                disabled={(set.available_sets ?? set.sets_remaining ?? 0) < 1
                                                    && String(form.data.resource_set_id) !== String(set.id)}
                                            >
                                                {set.name} — {set.available_sets ?? set.sets_remaining ?? 0} available
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.resource_set_id && (
                                        <p className="mt-1 text-xs text-red-500">{form.errors.resource_set_id}</p>
                                    )}
                                    {/* Preview selected set items */}
                                    {form.data.resource_set_id && (() => {
                                        const selectedSet = resourceSets.find((s) => String(s.id) === String(form.data.resource_set_id));

                                        if (!selectedSet?.items?.length) {
                                            return null;
                                        }

                                        return (
                                            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <p className="mb-1.5 text-xs font-medium text-slate-500 uppercase">Set Contents</p>
                                                {selectedSet.items.map((item) => (
                                                    <p key={item.id} className="text-sm text-slate-700">
                                                        {item.resource?.name ?? `Resource #${item.resource_id}`}
                                                        <span className="ml-1 text-xs text-slate-400">— {item.quantity} {item.resource?.unit ?? ''}/family</span>
                                                    </p>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* INDIVIDUAL CHECKLIST — shown when mode = 'individual' */}
                            {form.data.assignment_mode === 'individual' && (
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">
                                        Individual Items
                                    </label>
                                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                                        {resources.map((r) => {
                                            const checked = form.data.items.some((i) => Number(i.resource_id) === r.id);
                                            const qty = form.data.items.find((i) => Number(i.resource_id) === r.id)?.quantity ?? 1;
                                            const currentItemReservation = editingDistribution?.items?.find((i) => i.resource_id === r.id)?.quantity ?? 0;
                                            const available = (r.available_quantity ?? r.quantity) + currentItemReservation;

                                            return (
                                                <div key={r.id} className={`flex items-center gap-3 px-3 py-2 border-b border-slate-50 last:border-0 ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={!checked && available < 1}
                                                        onChange={() => {
                                                            let newItems;

                                                            if (checked) {
                                                                newItems = form.data.items.filter((i) => Number(i.resource_id) !== r.id);
                                                            } else {
                                                                newItems = [...form.data.items, { resource_id: r.id, quantity: 1 }];
                                                            }

                                                            form.setData('items', newItems);

                                                            if (newItems.length > 0) {
                                                                runStockCheck('individual', undefined, newItems, form.data.location_id || undefined, editingDistribution?.id);
                                                            }
                                                        }}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                                    />
                                                    <span className="flex-1 text-sm text-slate-700">{r.name} <span className="text-xs text-slate-400">({available} {r.unit} available)</span></span>
                                                    {checked && (
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={available}
                                                            value={qty}
                                                            onChange={(e) => {
                                                                const newItems = form.data.items.map((i) =>
                                                                    Number(i.resource_id) === r.id ? { ...i, quantity: Math.min(Math.max(1, Number(e.target.value)), available) } : i
                                                                );
                                                                form.setData('items', newItems);
                                                                runStockCheck('individual', undefined, newItems, form.data.location_id || undefined, editingDistribution?.id);
                                                            }}
                                                            className="input-field w-20 py-1 text-sm"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {form.errors.items && (
                                        <p className="mt-1 text-xs text-red-500">{form.errors.items}</p>
                                    )}
                                </div>
                            )}

                            {/* STOCK CHECK BANNER */}
                            {form.data.assignment_mode && (
                                <div>
                                    {stockCheckLoading && (
                                        <p className="text-sm text-slate-400">Checking stock…</p>
                                    )}
                                    {!stockCheckLoading && stockWarnings.length > 0 && (
                                        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                                            <p className="text-sm font-semibold text-amber-800 mb-1.5">Not enough unreserved stock for this distribution
                                            </p>
                                            <ul className="text-sm text-amber-700 space-y-1">
                                                {stockWarnings.map((w) => (
                                                    <li key={w.resource_id}>
                                                        <strong>{w.resource_name}</strong>: {w.available} {w.unit} available,{' '}
                                                        {w.required} required (shortfall: {w.shortfall} {w.unit})
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-xs text-amber-600 mt-2">Saving is blocked when the selected distribution would exceed unreserved stock.</p>
                                        </div>
                                    )}
                                    {!stockCheckLoading && stockOk && (
                                        <p className="text-sm font-medium text-green-600">✓ Stock OK</p>
                                    )}
                                </div>
                            )}

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
                                            disabled={(resource.available_quantity ?? resource.quantity) < 1
                                                && String(form.data.resource_id) !== String(resource.id)}
                                        >
                                            {resource.name} — {resource.available_quantity ?? resource.quantity} available
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
                                                ((resource.available_quantity ?? resource.quantity) < 1
                                                    && String(form.data.additional_resource_id) !== String(resource.id)) ||
                                                String(resource.id) ===
                                                String(
                                                    form.data.resource_id,
                                                )
                                            }
                                        >
                                            {resource.name} — {resource.available_quantity ?? resource.quantity} available
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

                            {/* REASON */}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Reason
                                </label>

                                <textarea
                                    className="input-field min-h-[80px]"
                                    value={form.data.reason}
                                    onChange={(e) =>
                                        form.setData('reason', e.target.value)
                                    }
                                    placeholder="Reason for this distribution…"
                                />
                                {form.errors.reason && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.errors.reason}
                                    </p>
                                )}
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
                                    setStockWarnings([]);
                                    setStockOk(false);
                                    setStockCheckLoading(false);
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

                {/* EXCLUSION MODAL */}
                {excludingDistribution && (
                    <Modal open onClose={() => { setExcludingDistribution(null); setExcludeReason(''); setExcludeError(''); }} title="Exclude Family">
                        <form onSubmit={handleExcludeConfirm} className="p-4">
                            <h2 className="text-lg font-semibold mb-2">Exclude Family</h2>
                            <p className="text-sm text-gray-600 mb-3">
                                Optionally enter a reason for excluding{' '}
                                <strong>{excludingDistribution.family?.head_name}</strong>.
                            </p>
                            <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                            <textarea
                                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                                rows={3}
                                value={excludeReason}
                                onChange={(e) => setExcludeReason(e.target.value)}
                                placeholder="Enter reason..."
                                maxLength={500}
                            />
                            {excludeError && <p className="text-red-600 text-xs mt-1">{excludeError}</p>}
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    type="button"
                                    onClick={() => { setExcludingDistribution(null); setExcludeReason(''); setExcludeError(''); }}
                                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                                    Confirm Exclusion
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}
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

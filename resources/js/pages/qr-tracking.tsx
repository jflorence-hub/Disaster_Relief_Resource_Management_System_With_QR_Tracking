import CameraScanner from '@/components/camera-scanner';
import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { FamilyOption, Location, QrScan } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import {
    Camera, CalendarDays, ScanLine, Trash2,
    ChevronLeft, ChevronRight, Download,
} from 'lucide-react';
import { FormEventHandler, useCallback, useEffect, useMemo, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleFamily {
    id: number;
    status: string;
    excluded: boolean;
    exclusion_reason: string | null;
    quantity: number;
    family_code: string;
    head_name: string;
    location_id: number | null;
    purok_name: string | null;
    resource_name: string | null;
    resource_unit: string | null;
    scanned_by: string | null;
    receiver: string | null;
    scan_time: string | null;
}

interface ScheduleEntry {
    id: number;
    scheduled_at: string;
    resource_name: string | null;
    location_name: string | null;
    families: ScheduleFamily[];
}

interface FormData {
    qr_code: string;
    family_id: string;
    location_id: string;
    scan_type: string;
    quantity_change: number | string;
    scan_date: string;
    scan_time: string;
    receiver: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr()  { return new Date().toISOString().split('T')[0]; }
function nowTimeStr(){ return new Date().toTimeString().slice(0, 5); }

const emptyForm = (): FormData => ({
    qr_code: '', family_id: '', location_id: '', scan_type: 'released',
    quantity_change: 1, scan_date: todayStr(), scan_time: nowTimeStr(), receiver: '',
});

const statusBadge: Record<string, string> = {
    completed: 'badge-green', pending: 'badge-slate',
    cancelled: 'badge-red',  excluded: 'bg-red-100 text-red-600',
};

function toYMD(dateStr: string) {
    return dateStr.substring(0, 10);
}

function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

// ── Calendar dot helper ───────────────────────────────────────────────────────

function dayStatus(families: ScheduleFamily[]): 'none' | 'pending' | 'completed' | 'excluded' | 'mixed' {
    if (!families.length) return 'none';
    const hasExcluded  = families.some(f => f.excluded);
    const hasPending   = families.some(f => f.status === 'pending' && !f.excluded);
    const hasCompleted = families.some(f => f.status === 'completed');
    if (hasExcluded && hasPending) return 'mixed';
    if (hasPending)   return 'pending';
    if (hasExcluded)  return 'excluded';
    if (hasCompleted) return 'completed';
    return 'none';
}

const dotColor: Record<string, string> = {
    completed: 'bg-green-500', pending: 'bg-amber-400',
    excluded: 'bg-red-500', mixed: 'bg-amber-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function QrTracking({
    scans, families, locations, userRole,
    scheduleHistory = [], allLocations = [],
}: {
    scans: QrScan[];
    families: FamilyOption[];
    locations: Location[];
    userRole: string;
    scheduleHistory: ScheduleEntry[];
    allLocations: { id: number; name: string }[];
}) {
    // ── tabs ──────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'history' | 'scan'>('history');

    // ── calendar state ────────────────────────────────────────────────────────
    const today = new Date();
    const [calYear,  setCalYear]  = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
    const [selectedDay, setSelectedDay] = useState<string | null>(null);  // YYYY-MM-DD
    const [filterLocation, setFilterLocation] = useState<string>('');
    const [historySearch, setHistorySearch] = useState('');

    // ── scan form state ───────────────────────────────────────────────────────
    const [showScan, setShowScan]   = useState(false);
    const [deleting, setDeleting]   = useState<QrScan | null>(null);
    const [cameraOn, setCameraOn]   = useState(false);
    const [familyHead, setFamilyHead] = useState('');
    const [purokName,  setPurokName]  = useState('');
    const [reliefName, setReliefName] = useState('');
    const [familyMembers, setFamilyMembers] = useState<Array<{ id: number; number: number; name: string }>>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const form = useForm<FormData>(emptyForm());

    // ── auto-refresh ──────────────────────────────────────────────────────────
    useEffect(() => {
        const id = setInterval(() => {
            if (!showScan && !deleting) router.reload({ only: ['scans', 'scheduleHistory'] });
        }, 15000);
        return () => clearInterval(id);
    }, [showScan, deleting]);

    // ── calendar data ─────────────────────────────────────────────────────────
    // Build a map: YYYY-MM-DD -> ScheduleFamily[]
    const dayMap = useMemo(() => {
        const map: Record<string, ScheduleFamily[]> = {};
        scheduleHistory.forEach((s) => {
            const day = toYMD(s.scheduled_at);
            if (!map[day]) map[day] = [];
            let fams = s.families;
            if (filterLocation) fams = fams.filter(f => String(f.location_id) === filterLocation);
            map[day].push(...fams);
        });
        return map;
    }, [scheduleHistory, filterLocation]);

    // Filtered schedules for the selected day
    const selectedDaySchedules = useMemo(() => {
        if (!selectedDay) return [];
        return scheduleHistory
            .filter(s => toYMD(s.scheduled_at) === selectedDay)
            .map(s => ({
                ...s,
                families: filterLocation
                    ? s.families.filter(f => String(f.location_id) === filterLocation)
                    : s.families,
            }))
            .filter(s => s.families.length > 0);
    }, [selectedDay, scheduleHistory, filterLocation]);

    // Search across whole month
    const searchResults = useMemo(() => {
        if (!historySearch.trim()) return null;
        const q = historySearch.toLowerCase();
        return scheduleHistory.flatMap(s =>
            s.families
                .filter(f =>
                    f.head_name.toLowerCase().includes(q) ||
                    (s.location_name ?? '').toLowerCase().includes(q) ||
                    (f.purok_name ?? '').toLowerCase().includes(q)
                )
                .map(f => ({ ...f, scheduled_at: s.scheduled_at, location_name: s.location_name, resource_name: s.resource_name }))
        );
    }, [historySearch, scheduleHistory]);

    // ── calendar rendering ────────────────────────────────────────────────────
    const daysCount = daysInMonth(calYear, calMonth);
    const firstDay  = firstDayOfMonth(calYear, calMonth);
    const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const prevMonth = () => {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
        setSelectedDay(null);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
        setSelectedDay(null);
    };

    // ── export CSV ────────────────────────────────────────────────────────────
    const exportCsv = () => {
        const rows: string[][] = [['Date', 'Location', 'Barangay', 'Family Head', 'Purok', 'Resource', 'Qty', 'Status', 'Scanned By', 'Received By', 'Scan Time']];
        const prefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
        scheduleHistory.forEach(s => {
            if (!toYMD(s.scheduled_at).startsWith(prefix)) return;
            s.families.forEach(f => {
                rows.push([
                    toYMD(s.scheduled_at), s.location_name ?? '', '', f.head_name,
                    f.purok_name ?? '', f.resource_name ?? '', String(f.quantity),
                    f.excluded ? 'excluded' : f.status,
                    f.scanned_by ?? '', f.receiver ?? '', f.scan_time ?? '',
                ]);
            });
        });
        const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `distribution-${prefix}.csv`;
        a.click();
    };

    // ── scan form helpers ─────────────────────────────────────────────────────
    const openScan = () => {
        form.setData(emptyForm());
        setFamilyHead(''); setPurokName(''); setReliefName('');
        setFamilyMembers([]); setCameraOn(false); setShowScan(true);
    };

    const selectFamily = (familyId: string) => {
        const fam = families.find(f => String(f.id) === familyId);
        form.setData('family_id', familyId);
        form.setData('receiver', '');
        setFamilyHead(fam?.head_name ?? '');
        setPurokName(fam?.purok ?? '');
        setReliefName(
            fam?.latest_distribution?.resource_set?.name ??
                fam?.latest_distribution?.resource?.name ??
                '',
        );
        setFamilyMembers([]);
        if (familyId) {
            setLoadingMembers(true);
            fetch(`/families/${familyId}/members`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                .then(r => r.json())
                .then(data => setFamilyMembers(data.members ?? []))
                        .catch((error) => {
                            console.error('Failed to load household members for QR scan form.', error);
                        })
                .finally(() => setLoadingMembers(false));
        }
    };

    const handleDecoded = useCallback((value: string) => {
        setCameraOn(false);
        form.setData('qr_code', value.trim());
        const match = families.find(f => f.family_id === value.trim());
        if (match) selectFamily(String(match.id));
    }, [families]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        const qty = Number(form.data.quantity_change);
        if (!Number.isInteger(qty) || qty < 1) {
            form.setError('quantity_change', 'Quantity must be a positive whole number.');
            return;
        }
        form.post('/qr-tracking', {
            onSuccess: () => { setShowScan(false); form.reset(); setFamilyHead(''); setPurokName(''); setReliefName(''); },
        });
    };

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/qr-tracking/${deleting.id}`, { onFinish: () => setDeleting(null) });
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <AppLayout title="QR Tracking" subtitle="Distribution history and scan log">
            <Head title="QR Tracking" />

            {/* TABS */}
            <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
                <button type="button"
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'history' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <CalendarDays size={15} /> History
                </button>
                <button type="button"
                    onClick={() => setActiveTab('scan')}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'scan' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <ScanLine size={15} /> Log a Scan
                </button>
            </div>

            {/* ══ HISTORY TAB ══ */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Controls row */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Month navigator */}
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <button type="button" onClick={prevMonth} className="p-1 hover:text-blue-600"><ChevronLeft size={16} /></button>
                            <span className="min-w-[140px] text-center text-sm font-semibold text-slate-700">{monthLabel}</span>
                            <button type="button" onClick={nextMonth} className="p-1 hover:text-blue-600"><ChevronRight size={16} /></button>
                        </div>
                        {/* Location filter */}
                        {userRole === 'admin' && allLocations.length > 0 && (
                            <select className="input-field sm:w-44 py-1.5 text-sm"
                                value={filterLocation}
                                onChange={e => { setFilterLocation(e.target.value); setSelectedDay(null); }}>
                                <option value="">All Barangays</option>
                                {allLocations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                            </select>
                        )}
                        {/* Search */}
                        <input type="text" className="input-field sm:w-56 py-1.5 text-sm" placeholder="Search family or barangay…"
                            value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                        {/* Export */}
                        <button type="button" onClick={exportCsv}
                            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                            <Download size={14} /> Export CSV
                        </button>
                    </div>

                    {/* Search results overlay */}
                    {searchResults !== null ? (
                        <div className="card p-0 overflow-hidden">
                            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
                                Search results — {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''}
                            </div>
                            {searchResults.length === 0 ? (
                                <p className="px-4 py-8 text-center text-sm text-slate-400">No matches found.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <DistributionTable rows={searchResults.map(f => ({ ...f, location_name: (f as any).location_name }))} userRole={userRole} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Calendar grid */}
                            <div className="card p-4">
                                <div className="grid grid-cols-7 text-center mb-2">
                                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                                        <div key={d} className="text-xs font-semibold text-slate-400 py-1">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {/* Empty cells for first-day offset */}
                                    {Array.from({ length: firstDay }).map((_, i) => (
                                        <div key={`empty-${i}`} />
                                    ))}
                                    {/* Day cells */}
                                    {Array.from({ length: daysCount }).map((_, i) => {
                                        const dayNum = i + 1;
                                        const ymd = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                        const fams = dayMap[ymd] ?? [];
                                        const status = dayStatus(fams);
                                        const isToday = ymd === todayStr();
                                        const isSelected = ymd === selectedDay;

                                        // Carry-over check: pending families from a past date
                                        const hasCarryover = status !== 'none' && ymd < todayStr() && fams.some(f => f.status === 'pending' && !f.excluded);

                                        return (
                                            <button key={ymd} type="button"
                                                onClick={() => setSelectedDay(isSelected ? null : ymd)}
                                                className={`relative flex flex-col items-center rounded-lg p-1.5 text-center transition-colors
                                                    ${isSelected ? 'bg-blue-600 text-white' : isToday ? 'border-2 border-blue-400' : 'hover:bg-slate-50'}
                                                    ${status === 'none' ? 'opacity-40' : ''}
                                                `}
                                            >
                                                <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-700'}`}>{dayNum}</span>
                                                {status !== 'none' && (
                                                    <div className="flex gap-0.5 mt-0.5">
                                                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor[status]}`} />
                                                        {hasCarryover && !isSelected && (
                                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" title="Carry-over pending families" />
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Expanded day records */}
                            {selectedDay && (
                                <div className="card p-0 overflow-hidden">
                                    <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2.5">
                                        <span className="font-semibold text-slate-800 text-sm">
                                            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                        <span className="ml-auto text-xs text-slate-400">
                                            {(dayMap[selectedDay] ?? []).length} familie{(dayMap[selectedDay] ?? []).length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {selectedDaySchedules.length === 0 ? (
                                        <p className="px-4 py-8 text-center text-sm text-slate-400">No distributions on this day.</p>
                                    ) : (
                                        selectedDaySchedules.map((s, idx) => (
                                            <div key={s.id} className={idx > 0 ? 'border-t border-slate-100' : ''}>
                                                {/* Schedule sub-header */}
                                                <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                                                    {selectedDaySchedules.length > 1 && (
                                                        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">Round {idx + 1}</span>
                                                    )}
                                                    {s.location_name && <span>📍 {s.location_name}</span>}
                                                    {s.resource_name  && <span>📦 {s.resource_name}</span>}
                                                    <span className="ml-auto">
                                                        {s.families.filter(f => f.status === 'completed').length}/{s.families.length} completed
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <DistributionTable rows={s.families} userRole={userRole} />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ══ LOG A SCAN TAB ══ */}
            {activeTab === 'scan' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button className="btn-primary flex items-center gap-2" onClick={openScan}>
                            <ScanLine size={16} /> Record Scan
                        </button>
                    </div>

                    {/* Recent scans grouped by date */}
                    <div className="card p-0 overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                            <span className="font-semibold text-slate-800 text-sm">Scan Log</span>
                            <span className="ml-auto text-xs text-slate-400">{scans.length} records</span>
                        </div>
                        {scans.length === 0 ? (
                            <p className="px-4 py-10 text-center text-sm text-slate-400">No scan records yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                            <th className="px-4 py-2">Family Head</th>
                                            <th className="px-4 py-2">Purok</th>
                                            <th className="px-4 py-2">Relief</th>
                                            <th className="px-4 py-2">Qty</th>
                                            <th className="px-4 py-2">Received By</th>
                                            <th className="px-4 py-2">Scanned By</th>
                                            <th className="px-4 py-2">Status</th>
                                            <th className="px-4 py-2">Date / Time</th>
                                            <th className="px-4 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scans.map(s => {
                                            const timeStr = s.scan_time ?? (s.scanned_at ? new Date(s.scanned_at as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');
                                            const dateStr = s.scan_date ?? (s.scanned_at ? new Date(s.scanned_at as string).toLocaleDateString('en-US') : '');
                                            return (
                                                <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50">
                                                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.family?.head_name ?? '—'}</td>
                                                    <td className="px-4 py-2.5 text-slate-500">{(s.family as any)?.purok ?? '—'}</td>
                                                    <td className="px-4 py-2.5 text-slate-500">{s.resource_label ?? s.resource?.name ?? '—'}</td>
                                                    <td className="px-4 py-2.5 text-slate-600">{s.quantity_change > 0 ? `+${s.quantity_change}` : s.quantity_change}</td>
                                                    <td className="px-4 py-2.5 text-slate-500">{s.receiver ?? '—'}</td>
                                                    <td className="px-4 py-2.5 text-slate-500">{s.scanner?.name ?? '—'}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`badge ${s.scan_type === 'released' ? 'badge-green' : s.scan_type === 'returned' ? 'badge-amber' : 'badge-blue'} capitalize`}>
                                                            {s.scan_type.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-400 text-xs">{dateStr} {timeStr}</td>
                                                    <td className="px-4 py-2.5">
                                                        {userRole === 'admin' && (
                                                            <button className="rounded-lg p-1 text-red-400 hover:bg-red-50" onClick={() => setDeleting(s)}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* RECORD SCAN MODAL */}
            <Modal open={showScan} onClose={() => setShowScan(false)} title="Record QR Scan" wide>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="label mb-0">Scan with camera</label>
                        <button type="button" className="btn-outline flex items-center gap-2 text-xs" onClick={() => setCameraOn(v => !v)}>
                            <Camera size={14} />{cameraOn ? 'Stop camera' : 'Start camera'}
                        </button>
                    </div>
                    <CameraScanner active={cameraOn} onDecoded={handleDecoded} />
                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="label">Family</label>
                                <select className="input-field" value={form.data.family_id} onChange={e => selectFamily(e.target.value)}>
                                    <option value="">Choose a family…</option>
                                    {families.map(f => <option key={f.id} value={f.id}>{f.head_name} — {f.family_id}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Family Head</label>
                                <input type="text" className="input-field bg-slate-50" value={familyHead} readOnly placeholder="Auto-filled" />
                            </div>
                            <div>
                                <label className="label">Purok</label>
                                <input type="text" className="input-field bg-slate-50" value={purokName} readOnly placeholder="Auto-filled" />
                            </div>
                            <div>
                                <label className="label">Relief / Resource</label>
                                <input type="text" className="input-field bg-slate-50" value={reliefName} readOnly placeholder="—" />
                            </div>
                            <div>
                                <label className="label">Quantity</label>
                                <input type="number" min="1" step="1" className="input-field" value={form.data.quantity_change} onChange={e => form.setData('quantity_change', e.target.value)} />
                                {form.errors.quantity_change && <p className="mt-1 text-xs text-red-600">{form.errors.quantity_change}</p>}
                            </div>
                            <div>
                                <label className="label">Scan Status</label>
                                <select className="input-field" value={form.data.scan_type} onChange={e => form.setData('scan_type', e.target.value)}>
                                    <option value="released">Released</option>
                                    <option value="returned">Returned</option>
                                    <option value="verified">Verified</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Location</label>
                                <select className="input-field" value={form.data.location_id} onChange={e => form.setData('location_id', e.target.value)}>
                                    <option value="">Select location…</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Date</label>
                                <input type="date" className="input-field" value={form.data.scan_date} onChange={e => form.setData('scan_date', e.target.value)} />
                            </div>
                            <div>
                                <label className="label">Time</label>
                                <input type="time" className="input-field" value={form.data.scan_time} onChange={e => form.setData('scan_time', e.target.value)} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="label">Received By</label>
                                {loadingMembers ? (
                                    <div className="input-field bg-slate-50 text-slate-400 text-sm">Loading members…</div>
                                ) : familyMembers.length > 0 ? (
                                    <select className="input-field" value={form.data.receiver} onChange={e => form.setData('receiver', e.target.value)}>
                                        <option value="">Select family member…</option>
                                        {familyMembers.map(m => <option key={m.id} value={m.name}>{m.number}. {m.name}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" className="input-field" placeholder="Name of person claiming relief" value={form.data.receiver} onChange={e => form.setData('receiver', e.target.value)} />
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" className="btn-secondary" onClick={() => setShowScan(false)}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {form.processing ? 'Recording…' : 'Record scan'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            {userRole === 'admin' && (
                <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} message="Delete this scan record?" />
            )}
        </AppLayout>
    );
}

// ── Shared table component ────────────────────────────────────────────────────

function DistributionTable({ rows, userRole }: {
    rows: (ScheduleFamily & { location_name?: string | null })[];
    userRole: string;
}) {
    const getStatus = (f: ScheduleFamily) => f.excluded ? 'excluded' : f.status;
    const today = new Date().toISOString().split('T')[0];

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">Family Head</th>
                    <th className="px-4 py-2">Purok</th>
                    <th className="px-4 py-2">Received By</th>
                    <th className="px-4 py-2">Relief</th>
                    <th className="px-4 py-2">Scanned By</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Time</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((f, i) => {
                    const st = getStatus(f);
                    return (
                        <tr key={f.id ?? i} className="border-t border-slate-50 hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{f.head_name}</td>
                            <td className="px-4 py-2.5 text-slate-500">{f.purok_name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-slate-500">{f.receiver ?? '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600">
                                {f.resource_name
                                    ? <>{f.quantity} <span className="text-xs text-slate-400">{f.resource_unit}</span> {f.resource_name}</>
                                    : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{f.scanned_by ?? '—'}</td>
                            <td className="px-4 py-2.5">
                                <span className={`badge ${statusBadge[st] ?? 'badge-slate'} capitalize`}>{st.replace('_', ' ')}</span>
                                {f.status === 'pending' && !f.excluded && (f as any).scheduled_at && toYMD((f as any).scheduled_at) < today && (
                                    <span className="ml-1 text-xs text-slate-400 italic">carry-over</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{f.scan_time ?? '—'}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
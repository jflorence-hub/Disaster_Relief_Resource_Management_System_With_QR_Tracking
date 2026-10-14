import CameraScanner from '@/components/camera-scanner';
import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { FamilyOption, Location, QrScan } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { Camera, ChevronDown, ChevronRight, History, ScanLine, Trash2 } from 'lucide-react';
import { FormEventHandler, useCallback, useEffect, useMemo, useState } from 'react';

const scanTypeBadge: Record<string, string> = {
    released: 'badge-green',
    returned: 'badge-amber',
    verified: 'badge-blue',
    // legacy values kept for backward-compat with old records
    check_in:  'badge-green',
    check_out: 'badge-amber',
    audit:     'badge-blue',
    transfer:  'badge-purple',
};

interface FormData {
    qr_code: string;
    family_id: string;
    location_id: string;
    scan_type: string;
    quantity_change: number | string;
    scan_date: string;
    scan_time: string;
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function nowTimeStr() {
    return new Date().toTimeString().slice(0, 5);
}

const emptyForm = (): FormData => ({
    qr_code: '',
    family_id: '',
    location_id: '',
    scan_type: 'released',
    quantity_change: 1,
    scan_date: todayStr(),
    scan_time: nowTimeStr(),
});

export default function QrTracking({
    scans,
    families,
    locations,
    userRole,
}: {
    scans: QrScan[];
    families: FamilyOption[];
    locations: Location[];
    userRole: string;
}) {
    const [showScan, setShowScan] = useState(false);
    const [deleting, setDeleting] = useState<QrScan | null>(null);
    const [cameraOn, setCameraOn] = useState(false);

    // Auto-filled display fields
    const [familyHead, setFamilyHead] = useState('');
    const [purokName, setPurokName]   = useState('');
    const [reliefName, setReliefName] = useState('');

    // History accordion — which date groups are open
    const [openDates, setOpenDates] = useState<Set<string>>(new Set());

    const form = useForm<FormData>(emptyForm());

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(() => {
            if (!showScan && !deleting) {
                router.reload({ only: ['scans', 'families'] });
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [showScan, deleting]);

    // Group scans by date for the history section
    const scansByDate = useMemo(() => {
        const groups: Record<string, QrScan[]> = {};
        scans.forEach((s) => {
            const dateStr = s.scan_date ?? (s.scanned_at ? new Date(s.scanned_at as string).toISOString().split('T')[0] : null);
            const day = dateStr
                ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'Unknown Date';
            if (!groups[day]) groups[day] = [];
            groups[day].push(s);
        });
        return groups;
    }, [scans]);

    const dateKeys = Object.keys(scansByDate);

    const toggleDate = (day: string) => {
        setOpenDates((prev) => {
            const next = new Set(prev);
            next.has(day) ? next.delete(day) : next.add(day);
            return next;
        });
    };

    const openScan = () => {
        form.setData(emptyForm());
        setFamilyHead('');
        setPurokName('');
        setReliefName('');
        setCameraOn(false);
        setShowScan(true);
    };

    const selectFamily = (familyId: string) => {
        const fam = families.find((f) => String(f.id) === familyId);
        form.setData('family_id', familyId);
        setFamilyHead(fam?.head_name ?? '');
        setPurokName(fam?.purok ?? '');
        setReliefName(fam?.latest_distribution?.resource?.name ?? '');
    };

    // When the camera decodes a QR, store it and try to match a family
    const handleDecoded = useCallback(
        (value: string) => {
            setCameraOn(false);
            form.setData('qr_code', value.trim());
            // Try to match against family_id string (DIST- prefix or family code)
            const match = families.find(
                (f) => f.family_id === value.trim(),
            );
            if (match) {
                selectFamily(String(match.id));
            }
        },
        [families],
    );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        const quantity = Number(form.data.quantity_change);
        if (!Number.isInteger(quantity) || quantity < 1) {
            form.setError('quantity_change', 'Quantity must be a positive whole number.');
            return;
        }
        form.post('/qr-tracking', {
            onSuccess: () => {
                setShowScan(false);
                form.reset();
                setFamilyHead('');
                setPurokName('');
                setReliefName('');
            },
        });
    };

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/qr-tracking/${deleting.id}`, { onFinish: () => setDeleting(null) });
    };

    return (
        <AppLayout title="QR Tracking" subtitle="Record family relief scans to keep a distribution audit trail">
            <Head title="QR Tracking" />

            {/* RECORD SCAN BUTTON */}
            <div className="mb-4 flex justify-end">
                <button className="btn-primary flex items-center gap-2" onClick={openScan}>
                    <ScanLine size={16} />
                    Record Scan
                </button>
            </div>

            {/* ── SCAN HISTORY GROUPED BY DATE ── */}
            <div className="card p-0 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                    <History size={16} className="text-slate-400" />
                    <h2 className="font-semibold text-slate-800 text-sm">QR Tracking History</h2>
                    <span className="ml-auto text-xs text-slate-400">{scans.length} records</span>
                </div>

                {dateKeys.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-slate-400">No scan records yet.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {dateKeys.map((day) => {
                            const isOpen   = openDates.has(day);
                            const dayScans = scansByDate[day];
                            return (
                                <div key={day}>
                                    {/* Date header — clickable */}
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                                        onClick={() => toggleDate(day)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {isOpen
                                                ? <ChevronDown size={15} className="text-slate-400" />
                                                : <ChevronRight size={15} className="text-slate-400" />
                                            }
                                            <span className="text-sm font-medium text-slate-700">{day}</span>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                            {dayScans.length} scan{dayScans.length !== 1 ? 's' : ''}
                                        </span>
                                    </button>

                                    {/* Expanded scan table */}
                                    {isOpen && (
                                        <div className="overflow-x-auto border-t border-slate-50">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                                        <th className="px-4 py-2">Family</th>
                                                        <th className="px-4 py-2">Family Head</th>
                                                        <th className="px-4 py-2">Purok</th>
                                                        <th className="px-4 py-2">Relief</th>
                                                        <th className="px-4 py-2">Qty</th>
                                                        <th className="px-4 py-2">Scan Status</th>
                                                        <th className="px-4 py-2">Scanned By</th>
                                                        <th className="px-4 py-2">Location</th>
                                                        <th className="px-4 py-2">Date</th>
                                                        <th className="px-4 py-2">Time</th>
                                                        <th className="px-4 py-2" />
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dayScans.map((s) => {
                                                        const timeStr = s.scan_time
                                                            ?? (s.scanned_at ? new Date(s.scanned_at as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—');
                                                        return (
                                                            <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50">
                                                                {/* FAMILY */}
                                                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                                                    {s.family?.family_name ?? (s.resource?.name ?? '—')}
                                                                </td>
                                                                {/* FAMILY HEAD */}
                                                                <td className="px-4 py-2.5 text-slate-500">
                                                                    {s.family?.head_name ?? '—'}
                                                                </td>
                                                                {/* PUROK */}
                                                                <td className="px-4 py-2.5 text-slate-500">
                                                                    {s.family?.purok ?? '—'}
                                                                </td>
                                                                {/* RELIEF */}
                                                                <td className="px-4 py-2.5 text-slate-500">
                                                                    {s.resource?.name ?? '—'}
                                                                </td>
                                                                {/* QTY */}
                                                                <td className="px-4 py-2.5 text-slate-600">
                                                                    {s.quantity_change > 0 ? `+${s.quantity_change}` : s.quantity_change}
                                                                </td>
                                                                {/* SCAN STATUS */}
                                                                <td className="px-4 py-2.5">
                                                                    <span className={`badge ${scanTypeBadge[s.scan_type] ?? 'badge-blue'} capitalize`}>
                                                                        {s.scan_type.replace(/_/g, ' ')}
                                                                    </span>
                                                                </td>
                                                                {/* SCANNED BY */}
                                                                <td className="px-4 py-2.5 text-slate-500">{s.scanner?.name ?? '—'}</td>
                                                                {/* LOCATION */}
                                                                <td className="px-4 py-2.5 text-slate-500">
                                                                    {s.location?.name ?? '—'}
                                                                </td>
                                                                {/* DATE */}
                                                                <td className="px-4 py-2.5 text-slate-400 text-xs">
                                                                    {s.scan_date ?? (s.scanned_at ? new Date(s.scanned_at as string).toLocaleDateString('en-US') : '—')}
                                                                </td>
                                                                {/* TIME */}
                                                                <td className="px-4 py-2.5 text-slate-400 text-xs">
                                                                    {timeStr}
                                                                </td>
                                                                {/* DELETE */}
                                                                <td className="px-4 py-2.5">
                                                                    {userRole === 'admin' && (
                                                                        <button
                                                                            className="rounded-lg p-1 text-red-400 hover:bg-red-50"
                                                                            onClick={() => setDeleting(s)}
                                                                        >
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
                            );
                        })}
                    </div>
                )}
            </div>

            {/* RECORD SCAN MODAL */}
            <Modal open={showScan} onClose={() => setShowScan(false)} title="Record QR Scan" wide>
                <div className="space-y-4">
                    {/* CAMERA */}
                    <div className="flex items-center justify-between">
                        <label className="label mb-0">Scan with camera</label>
                        <button type="button" className="btn-outline flex items-center gap-2 text-xs" onClick={() => setCameraOn((v) => !v)}>
                            <Camera size={14} />
                            {cameraOn ? 'Stop camera' : 'Start camera'}
                        </button>
                    </div>

                    <CameraScanner active={cameraOn} onDecoded={handleDecoded} />

                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                            {/* FAMILY */}
                            <div className="sm:col-span-2">
                                <label className="label">Family</label>
                                <select
                                    className="input-field"
                                    value={form.data.family_id}
                                    onChange={(e) => selectFamily(e.target.value)}
                                >
                                    <option value="">Choose a family…</option>
                                    {families.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.family_name} — {f.family_id}
                                        </option>
                                    ))}
                                </select>
                                {form.errors.family_id && <p className="mt-1 text-xs text-red-600">{form.errors.family_id}</p>}
                            </div>

                            {/* FAMILY HEAD (read-only) */}
                            <div>
                                <label className="label">Family Head</label>
                                <input
                                    type="text"
                                    className="input-field bg-slate-50"
                                    value={familyHead}
                                    readOnly
                                    placeholder="Auto-filled from selected family"
                                />
                            </div>

                            {/* PUROK (read-only) */}
                            <div>
                                <label className="label">Purok</label>
                                <input
                                    type="text"
                                    className="input-field bg-slate-50"
                                    value={purokName}
                                    readOnly
                                    placeholder="Auto-filled from selected family"
                                />
                            </div>

                            {/* RELIEF (informational) */}
                            <div>
                                <label className="label">Relief / Resource</label>
                                <input
                                    type="text"
                                    className="input-field bg-slate-50"
                                    value={reliefName}
                                    readOnly
                                    placeholder="—"
                                />
                                <p className="mt-1 text-xs text-slate-400">Auto-filled from family's latest distribution.</p>
                            </div>

                            {/* QUANTITY */}
                            <div>
                                <label className="label">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="input-field"
                                    value={form.data.quantity_change}
                                    onChange={(e) => form.setData('quantity_change', e.target.value)}
                                />
                                <p className="mt-1 text-xs text-slate-400">Enter a positive whole number.</p>
                                {form.errors.quantity_change && <p className="mt-1 text-xs text-red-600">{form.errors.quantity_change}</p>}
                            </div>

                            {/* SCAN STATUS TYPE */}
                            <div>
                                <label className="label">Scan Status</label>
                                <select
                                    className="input-field"
                                    value={form.data.scan_type}
                                    onChange={(e) => form.setData('scan_type', e.target.value)}
                                >
                                    <option value="released">Released</option>
                                    <option value="returned">Returned</option>
                                    <option value="verified">Verified</option>
                                </select>
                            </div>

                            {/* LOCATION */}
                            <div>
                                <label className="label">Location</label>
                                <select
                                    className="input-field"
                                    value={form.data.location_id}
                                    onChange={(e) => form.setData('location_id', e.target.value)}
                                >
                                    <option value="">Select location…</option>
                                    {locations.map((l) => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                                {form.errors.location_id && <p className="mt-1 text-xs text-red-600">{form.errors.location_id}</p>}
                            </div>

                            {/* DATE */}
                            <div>
                                <label className="label">Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={form.data.scan_date}
                                    onChange={(e) => form.setData('scan_date', e.target.value)}
                                />
                                {form.errors.scan_date && <p className="mt-1 text-xs text-red-600">{form.errors.scan_date}</p>}
                            </div>

                            {/* TIME */}
                            <div>
                                <label className="label">Time</label>
                                <input
                                    type="time"
                                    className="input-field"
                                    value={form.data.scan_time}
                                    onChange={(e) => form.setData('scan_time', e.target.value)}
                                />
                                {form.errors.scan_time && <p className="mt-1 text-xs text-red-600">{form.errors.scan_time}</p>}
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
                <ConfirmDialog
                    open={!!deleting}
                    onClose={() => setDeleting(null)}
                    onConfirm={confirmDelete}
                    message="Delete this scan record?"
                />
            )}
        </AppLayout>
    );
}

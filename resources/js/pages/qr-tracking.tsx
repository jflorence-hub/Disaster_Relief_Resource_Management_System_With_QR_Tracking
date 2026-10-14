import CameraScanner from '@/components/camera-scanner';
import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Location, QrScan, ResourceItem } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { Camera, ChevronDown, ChevronRight, History, QrCode, ScanLine, Trash2 } from 'lucide-react';
import { FormEventHandler, useCallback, useEffect, useMemo, useState } from 'react';

const scanTypeBadge: Record<string, string> = {
    check_in:  'badge-green',
    check_out: 'badge-amber',
    audit:     'badge-blue',
    transfer:  'badge-purple',
};

interface FormData {
    qr_code: string;
    location_id: string;
    to_location_id: string;
    scan_type: string;
    recipient_name: string;   // kept for backend compat
    quantity_change: number | string;
    notes: string;
}

const emptyForm: FormData = {
    qr_code: '',
    location_id: '',
    to_location_id: '',
    scan_type: 'check_in',
    recipient_name: '',
    quantity_change: '',
    notes: '',
};

export default function QrTracking({
    scans,
    resources,
    locations,
    userRole,
}: {
    scans: QrScan[];
    resources: ResourceItem[];
    locations: Location[];
    userRole: string;
}) {
    const [showScan, setShowScan]   = useState(false);
    const [deleting, setDeleting]   = useState<QrScan | null>(null);
    const [matched, setMatched]     = useState<ResourceItem | null | undefined>(undefined);
    const [cameraOn, setCameraOn]   = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);

    // History accordion — which date groups are open
    const [openDates, setOpenDates] = useState<Set<string>>(new Set());

    const form = useForm<FormData>(emptyForm);

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(() => {
            if (!showScan && !deleting) {
                router.reload({ only: ['scans', 'resources'] });
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [showScan, deleting]);

    // Group scans by date for the history section
    const scansByDate = useMemo(() => {
        const groups: Record<string, QrScan[]> = {};
        scans.forEach((s) => {
            const day = new Date(s.scanned_at as string).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
            });
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

    // Filtered purok handlers for the receiver dropdown — no longer used
    // (receiver is derived from the selected location's contact_person)
    const [selectedToLocation, setSelectedToLocation] = useState('');

    const openScan = () => {
        form.setData({ ...emptyForm });
        setMatched(undefined);
        setLookupError(null);
        setCameraOn(false);
        setSelectedToLocation('');
        setShowScan(true);
    };

    const selectResource = (resource: ResourceItem) => {
        setMatched(resource);
        setLookupError(null);
        form.setData('qr_code', resource.qr_code);
        form.setData('location_id', resource.location_id ? String(resource.location_id) : '');
        form.setData('to_location_id', '');
        form.setData('recipient_name', '');
        setSelectedToLocation('');
    };

    const handleDecoded = useCallback(
        (value: string) => {
            setCameraOn(false);
            const resource = resources.find((r) => r.qr_code === value.trim());
            if (resource) {
                selectResource(resource);
            } else {
                setMatched(null);
                setLookupError(`No resource found for QR code "${value}".`);
            }
        },
        [resources],
    );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!matched) { setLookupError('Please select or scan a resource.'); return; }
        const quantity = Number(form.data.quantity_change);
        if (!Number.isInteger(quantity) || quantity < 1) {
            form.setError('quantity_change', 'Quantity must be a positive whole number.');
            return;
        }
        if ((form.data.scan_type === 'check_in' || form.data.scan_type === 'transfer') && !form.data.to_location_id) {
            form.setError('to_location_id', 'Please select a destination location.');
            return;
        }
        if (form.data.scan_type === 'check_out' || form.data.scan_type === 'audit') {
            form.setData('to_location_id', '');
        }
        form.post('/qr-tracking', {
            onSuccess: () => { setShowScan(false); form.reset(); setMatched(undefined); setLookupError(null); setSelectedToLocation(''); },
        });
    };

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/qr-tracking/${deleting.id}`, { onFinish: () => setDeleting(null) });
    };

    return (
        <AppLayout title="QR Tracking" subtitle="Scan supplies in and out to keep an audit trail">
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
                            const isOpen = openDates.has(day);
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
                                                        <th className="px-4 py-2">Resource</th>
                                                        <th className="px-4 py-2">Type</th>
                                                        <th className="px-4 py-2">Qty</th>
                                                        <th className="px-4 py-2">From</th>
                                                        <th className="px-4 py-2">To</th>
                                                        <th className="px-4 py-2">Scanned By</th>
                                                        <th className="px-4 py-2">Receiver</th>
                                                        <th className="px-4 py-2">Time</th>
                                                        <th className="px-4 py-2" />
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dayScans.map((s) => (
                                                        <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50">
                                                            {/* RESOURCE */}
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                                                        <QrCode size={14} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-slate-800">{s.resource?.name}</p>
                                                                        <p className="text-xs text-slate-400">{s.resource?.qr_code}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {/* TYPE */}
                                                            <td className="px-4 py-2.5">
                                                                <span className={`badge ${scanTypeBadge[s.scan_type]} capitalize`}>
                                                                    {s.scan_type.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            {/* QTY */}
                                                            <td className="px-4 py-2.5 text-slate-600">
                                                                {s.quantity_change > 0 ? `+${s.quantity_change}` : s.quantity_change}
                                                            </td>
                                                            {/* FROM */}
                                                            <td className="px-4 py-2.5 text-slate-500">{s.from_location?.name ?? '—'}</td>
                                                            {/* TO */}
                                                            <td className="px-4 py-2.5 text-slate-500">{s.to_location?.name ?? '—'}</td>
                                                            {/* SCANNED BY */}
                                                            <td className="px-4 py-2.5 text-slate-500">{s.scanner?.name ?? '—'}</td>
                                                            {/* RECEIVER */}
                                                            <td className="px-4 py-2.5 text-slate-500">{s.recipient_name ?? '—'}</td>
                                                            {/* TIME */}
                                                            <td className="px-4 py-2.5 text-slate-400 text-xs">
                                                                {new Date(s.scanned_at as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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
                                                    ))}
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

                    {lookupError && <p className="text-xs text-red-600">{lookupError}</p>}

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                        <div className="relative flex justify-center">
                            <span className="bg-white px-2 text-xs text-slate-400">or choose manually</span>
                        </div>
                    </div>

                    {/* RESOURCE */}
                    <div>
                        <label className="label">Resource / QR code</label>
                        <select
                            className="input-field"
                            value={matched?.id ?? ''}
                            onChange={(e) => {
                                const resource = resources.find((r) => r.id === Number(e.target.value));
                                if (resource) selectResource(resource);
                            }}
                        >
                            <option value="">Choose a resource…</option>
                            {resources.map((r) => (
                                <option key={r.id} value={r.id}>{r.name} — {r.qr_code}</option>
                            ))}
                        </select>
                        {form.errors.qr_code && <p className="mt-1 text-xs text-red-600">{form.errors.qr_code}</p>}
                    </div>

                    {matched && (
                        <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                            <div><strong>Resource:</strong> {matched.name}</div>
                            <div><strong>Current stock:</strong> {matched.quantity} {matched.unit}</div>
                            <div><strong>Current location:</strong> {matched.location?.name ?? 'Unassigned'}</div>
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* SCAN TYPE */}
                            <div>
                                <label className="label">Scan type</label>
                                <select
                                    className="input-field"
                                    value={form.data.scan_type}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        form.setData('scan_type', type);
                                        if (type === 'check_out' || type === 'audit') {
                                            form.setData('to_location_id', '');
                                            setSelectedToLocation('');
                                        }
                                    }}
                                >
                                    <option value="check_in">Check In</option>
                                    <option value="check_out">Check Out</option>
                                    <option value="audit">Audit</option>
                                    <option value="transfer">Transfer</option>
                                </select>
                            </div>

                            {/* FROM */}
                            <div>
                                <label className="label">From / Current Location</label>
                                <input
                                    type="text"
                                    className="input-field bg-slate-50"
                                    value={matched?.location?.name ?? 'Unassigned'}
                                    readOnly
                                />
                                <p className="mt-1 text-xs text-slate-400">Automatically taken from the resource's current location.</p>
                            </div>

                            {/* TO LOCATION */}
                            {(form.data.scan_type === 'check_in' || form.data.scan_type === 'transfer') && (
                                <div>
                                    <label className="label">To / Destination Location</label>
                                    <select
                                        className="input-field"
                                        value={form.data.to_location_id}
                                        onChange={(e) => {
                                            const locId = e.target.value;
                                            form.setData('to_location_id', locId);
                                            setSelectedToLocation(locId);
                                            // Auto-set the receiver to the barangay captain of the selected location
                                            const loc = locations.find((l) => String(l.id) === locId);
                                            form.setData('recipient_name', loc?.contact_person ?? '');
                                        }}
                                    >
                                        <option value="">Select destination…</option>
                                        {locations.map((l) => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                    {form.errors.to_location_id && <p className="mt-1 text-xs text-red-600">{form.errors.to_location_id}</p>}
                                </div>
                            )}

                            {/* BRGY. HEAD / RECEIVER */}
                            <div>
                                <label className="label">
                                    Brgy. Head / Receiver
                                    {selectedToLocation && (
                                        <span className="ml-1 text-xs font-normal text-slate-400">
                                            — auto-filled from selected location
                                        </span>
                                    )}
                                </label>
                                <select
                                    className="input-field"
                                    value={form.data.recipient_name}
                                    onChange={(e) => form.setData('recipient_name', e.target.value)}
                                    disabled={!selectedToLocation}
                                >
                                    <option value="">
                                        {selectedToLocation ? '— Select receiver —' : '— Select a destination location first —'}
                                    </option>
                                    {selectedToLocation && (() => {
                                        const loc = locations.find((l) => String(l.id) === selectedToLocation);
                                        return loc?.contact_person ? (
                                            <option value={loc.contact_person}>
                                                {loc.contact_person} (Brgy. Captain — {loc.name})
                                            </option>
                                        ) : null;
                                    })()}
                                </select>
                                <p className="mt-1 text-xs text-slate-400">
                                    The barangay captain of the destination location, set automatically when you pick a location.
                                </p>
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

                            {/* NOTES */}
                            <div>
                                <label className="label">Notes</label>
                                <input
                                    className="input-field"
                                    value={form.data.notes}
                                    onChange={(e) => form.setData('notes', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" className="btn-secondary" onClick={() => setShowScan(false)}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={form.processing || !matched}>
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
                    message="Delete this scan record? This won't reverse any quantity change already applied."
                />
            )}
        </AppLayout>
    );
}

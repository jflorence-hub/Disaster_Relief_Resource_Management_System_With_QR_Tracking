import CameraScanner from '@/components/camera-scanner';
import ConfirmDialog from '@/components/confirm-dialog';
import Modal from '@/components/modal';
import AppLayout from '@/layouts/app-layout';
import { Location, QrScan, ResourceItem } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { Camera, QrCode, ScanLine, Trash2 } from 'lucide-react';
import { FormEventHandler, useCallback, useEffect, useState } from 'react';

const scanTypeBadge: Record<string, string> = {
    check_in: 'badge-green',
    check_out: 'badge-amber',
    audit: 'badge-blue',
    transfer: 'badge-purple',
};

interface FormData {
    qr_code: string;

    /*
     * Source/current location.
     *
     * This is displayed only.
     * The backend determines the real source.
     */
    location_id: string;

    /*
     * Destination location.
     *
     * Used only for Check In and Transfer.
     */
    to_location_id: string;

    scan_type: string;

    recipient_name: string;

    /*
     * User always enters a positive quantity.
     */
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
}: {
    scans: QrScan[];
    resources: ResourceItem[];
    locations: Location[];
}) {
    const [showScan, setShowScan] = useState(false);

    const [deleting, setDeleting] = useState<QrScan | null>(null);

    const [matched, setMatched] = useState<ResourceItem | null | undefined>(
        undefined,
    );

    const [cameraOn, setCameraOn] = useState(false);

    const [lookupError, setLookupError] = useState<string | null>(null);

    const form = useForm<FormData>(emptyForm);

    /*
     * Automatically refresh scan history.
     */
    useEffect(() => {
        const interval = setInterval(() => {
            if (!showScan && !deleting) {
                router.reload({
                    only: ['scans', 'resources'],
                });
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [showScan, deleting]);

    /*
     * Open scan modal.
     */
    const openScan = () => {
        form.setData({
            ...emptyForm,
        });

        setMatched(undefined);

        setLookupError(null);

        setCameraOn(false);

        setShowScan(true);
    };

    /*
     * Select resource.
     *
     * The current location comes directly
     * from the selected resource.
     */
    const selectResource = (resource: ResourceItem) => {
        setMatched(resource);

        setLookupError(null);

        form.setData('qr_code', resource.qr_code);

        form.setData(
            'location_id',
            resource.location_id ? String(resource.location_id) : '',
        );

        /*
         * Clear destination when selecting
         * a new resource.
         */
        form.setData('to_location_id', '');
    };

    /*
     * Camera QR decoder.
     */
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

    /*
     * Submit scan.
     */
    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        /*
         * Frontend validation.
         */
        if (!matched) {
            setLookupError('Please select or scan a resource.');

            return;
        }

        const quantity = Number(form.data.quantity_change);

        if (!Number.isInteger(quantity) || quantity < 1) {
            form.setError(
                'quantity_change',
                'Quantity must be a positive whole number.',
            );

            return;
        }

        /*
         * Check In and Transfer require
         * a destination.
         */
        if (
            (form.data.scan_type === 'check_in' ||
                form.data.scan_type === 'transfer') &&
            !form.data.to_location_id
        ) {
            form.setError(
                'to_location_id',
                'Please select a destination location.',
            );

            return;
        }

        /*
         * Check Out and Audit must not
         * have a destination.
         */
        if (
            form.data.scan_type === 'check_out' ||
            form.data.scan_type === 'audit'
        ) {
            form.setData('to_location_id', '');
        }

        form.post('/qr-tracking', {
            onSuccess: () => {
                setShowScan(false);

                form.reset();

                setMatched(undefined);

                setLookupError(null);
            },
        });
    };

    /*
     * Delete history record.
     */
    const confirmDelete = () => {
        if (!deleting) {
            return;
        }

        router.delete(`/qr-tracking/${deleting.id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    return (
        <AppLayout
            title="QR Tracking"
            subtitle="Scan supplies in and out to keep an audit trail"
        >
            <Head title="QR Tracking" />

            {/* =======================================================
                RECORD SCAN BUTTON
            ======================================================== */}
            <div className="mb-4 flex justify-end">
                <button
                    className="btn-primary flex items-center gap-2"
                    onClick={openScan}
                >
                    <ScanLine size={16} />
                    Record Scan
                </button>
            </div>

            {/* =======================================================
                SCAN HISTORY
            ======================================================== */}
            <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                            <th className="px-4 py-3">Resource</th>

                            <th className="px-4 py-3">Recipient</th>

                            <th className="px-4 py-3">Type</th>

                            <th className="px-4 py-3">Qty Change</th>

                            <th className="px-4 py-3">From</th>

                            <th className="px-4 py-3">To</th>

                            <th className="px-4 py-3">Scanned By</th>

                            <th className="px-4 py-3">When</th>

                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {/* Empty state */}
                        {scans.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    No scan records yet.
                                </td>
                            </tr>
                        )}

                        {/* Scan records */}
                        {scans.map((s) => (
                            <tr
                                key={s.id}
                                className="border-b border-slate-50 hover:bg-slate-50"
                            >
                                {/* RESOURCE */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <QrCode size={16} />
                                        </div>

                                        <div>
                                            <p className="font-medium text-slate-800">
                                                {s.resource?.name}
                                            </p>

                                            <p className="text-xs text-slate-400">
                                                {s.resource?.qr_code}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                {/* RECIPIENT */}
                                <td className="px-4 py-3 text-slate-600">
                                    {s.recipient_name ?? '—'}
                                </td>

                                {/* TYPE */}
                                <td className="px-4 py-3">
                                    <span
                                        className={`badge ${scanTypeBadge[s.scan_type]} capitalize`}
                                    >
                                        {s.scan_type.replace('_', ' ')}
                                    </span>
                                </td>

                                {/* QUANTITY */}
                                <td className="px-4 py-3 text-slate-600">
                                    {s.quantity_change > 0
                                        ? `+${s.quantity_change}`
                                        : s.quantity_change}
                                </td>

                                {/* FROM */}
                                <td className="px-4 py-3 text-slate-500">
                                    {s.from_location?.name ?? '—'}
                                </td>

                                {/* TO */}
                                <td className="px-4 py-3 text-slate-500">
                                    {s.to_location?.name ?? '—'}
                                </td>

                                {/* SCANNED BY */}
                                <td className="px-4 py-3 text-slate-500">
                                    {s.scanner?.name ?? 'Unknown'}
                                </td>

                                {/* DATE */}
                                <td className="px-4 py-3 text-slate-400">
                                    {new Date(s.scanned_at).toLocaleString()}
                                </td>

                                {/* ACTIONS */}
                                <td className="px-4 py-3">
                                    <div className="flex justify-end">
                                        <button
                                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                            onClick={() => setDeleting(s)}
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

            {/* =======================================================
                RECORD SCAN MODAL
            ======================================================== */}
            <Modal
                open={showScan}
                onClose={() => setShowScan(false)}
                title="Record QR Scan"
                wide
            >
                <div className="space-y-4">
                    {/* CAMERA */}
                    <div className="flex items-center justify-between">
                        <label className="label mb-0">Scan with camera</label>

                        <button
                            type="button"
                            className="btn-outline flex items-center gap-2 text-xs"
                            onClick={() => setCameraOn((v) => !v)}
                        >
                            <Camera size={14} />

                            {cameraOn ? 'Stop camera' : 'Start camera'}
                        </button>
                    </div>

                    <CameraScanner
                        active={cameraOn}
                        onDecoded={handleDecoded}
                    />

                    {/* LOOKUP ERROR */}
                    {lookupError && (
                        <p className="text-xs text-red-600">{lookupError}</p>
                    )}

                    {/* DIVIDER */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-100" />
                        </div>

                        <div className="relative flex justify-center">
                            <span className="bg-white px-2 text-xs text-slate-400">
                                or choose manually
                            </span>
                        </div>
                    </div>

                    {/* RESOURCE */}
                    <div>
                        <label className="label">Resource / QR code</label>

                        <select
                            className="input-field"
                            value={matched?.id ?? ''}
                            onChange={(e) => {
                                const resource = resources.find(
                                    (r) => r.id === Number(e.target.value),
                                );

                                if (resource) {
                                    selectResource(resource);
                                }
                            }}
                        >
                            <option value="">Choose a resource…</option>

                            {resources.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name} — {r.qr_code}
                                </option>
                            ))}
                        </select>

                        {form.errors.qr_code && (
                            <p className="mt-1 text-xs text-red-600">
                                {form.errors.qr_code}
                            </p>
                        )}
                    </div>

                    {/* SELECTED RESOURCE */}
                    {matched && (
                        <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                            <div>
                                <strong>Resource:</strong> {matched.name}
                            </div>

                            <div>
                                <strong>Current stock:</strong>{' '}
                                {matched.quantity} {matched.unit}
                            </div>

                            <div>
                                <strong>Current location:</strong>{' '}
                                {matched.location?.name ?? 'Unassigned'}
                            </div>
                        </div>
                    )}

                    {/* FORM */}
                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* =================================================
                                SCAN TYPE
                            ================================================== */}
                            <div>
                                <label className="label">Scan type</label>

                                <select
                                    className="input-field"
                                    value={form.data.scan_type}
                                    onChange={(e) => {
                                        const type = e.target.value;

                                        form.setData('scan_type', type);

                                        /*
                                         * Check Out
                                         * and Audit
                                         * don't use
                                         * destination.
                                         */
                                        if (
                                            type === 'check_out' ||
                                            type === 'audit'
                                        ) {
                                            form.setData('to_location_id', '');
                                        }
                                    }}
                                >
                                    <option value="check_in">Check In</option>

                                    <option value="check_out">Check Out</option>

                                    <option value="audit">Audit</option>

                                    <option value="transfer">Transfer</option>
                                </select>
                            </div>

                            {/* =================================================
                                CURRENT SOURCE
                            ================================================== */}
                            <div>
                                <label className="label">
                                    From / Current Location
                                </label>

                                <input
                                    type="text"
                                    className="input-field bg-slate-50"
                                    value={
                                        matched?.location?.name ?? 'Unassigned'
                                    }
                                    readOnly
                                />

                                <p className="mt-1 text-xs text-slate-400">
                                    This is automatically taken from the
                                    resource's current location.
                                </p>
                            </div>

                            {/* =================================================
                                DESTINATION
                            ================================================== */}
                            {(form.data.scan_type === 'check_in' ||
                                form.data.scan_type === 'transfer') && (
                                <div>
                                    <label className="label">
                                        To / Destination Location
                                    </label>

                                    <select
                                        className="input-field"
                                        value={form.data.to_location_id}
                                        onChange={(e) =>
                                            form.setData(
                                                'to_location_id',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select destination…
                                        </option>

                                        {locations.map((l) => (
                                            <option key={l.id} value={l.id}>
                                                {l.name}
                                            </option>
                                        ))}
                                    </select>

                                    {form.errors.to_location_id && (
                                        <p className="mt-1 text-xs text-red-600">
                                            {form.errors.to_location_id}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* =================================================
                                RECIPIENT
                            ================================================== */}
                            <div>
                                <label className="label">
                                    Recipient / family (optional)
                                </label>

                                <input
                                    className="input-field"
                                    placeholder="e.g. Familia Dela Cruz"
                                    value={form.data.recipient_name}
                                    onChange={(e) =>
                                        form.setData(
                                            'recipient_name',
                                            e.target.value,
                                        )
                                    }
                                />

                                <p className="mt-1 text-xs text-slate-400">
                                    Fill this in for Check Out scans so you can
                                    see who received the goods.
                                </p>
                            </div>

                            {/* =================================================
                                QUANTITY
                            ================================================== */}
                            <div>
                                <label className="label">Quantity</label>

                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="input-field"
                                    value={form.data.quantity_change}
                                    onChange={(e) =>
                                        form.setData(
                                            'quantity_change',
                                            e.target.value,
                                        )
                                    }
                                />

                                <p className="mt-1 text-xs text-slate-400">
                                    Enter a positive whole number. The system
                                    determines whether stock is added or
                                    removed.
                                </p>

                                {form.errors.quantity_change && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {form.errors.quantity_change}
                                    </p>
                                )}
                            </div>

                            {/* =================================================
                                NOTES
                            ================================================== */}
                            <div>
                                <label className="label">Notes</label>

                                <input
                                    className="input-field"
                                    value={form.data.notes}
                                    onChange={(e) =>
                                        form.setData('notes', e.target.value)
                                    }
                                />
                            </div>
                        </div>

                        {/* BUTTONS */}
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setShowScan(false)}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={form.processing || !matched}
                            >
                                {form.processing ? 'Recording…' : 'Record scan'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            {/* =======================================================
                DELETE CONFIRMATION
            ======================================================== */}
            <ConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                message="Delete this scan record? This won't reverse any quantity change already applied."
            />
        </AppLayout>
    );
}

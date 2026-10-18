import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import {
    Download,
    Upload,
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface PreviewRow {
    _row_number: number;
    _error: string | null;
    head_firstname: string;
    head_lastname: string;
    head_name: string;
    purok_name: string;
    member_names: string[];
    member_count: number;
    phone: string | null;
    email: string | null;
}

interface PreviewMeta {
    barangay_name: string;
    captain_name: string;
    captain_contact: string;
    captain_email: string;
    type?: string;
    address?: string;
    city?: string;
    capacity?: string;
    status?: string;
}

interface ImportError {
    row: number;
    reason: string;
}

interface CredentialDelivery {
    id: number;
    head_name: string;
    email: string;
    status:
        'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'superseded';
    attempts: number;
    last_error: string | null;
    sent_at: string | null;
}

type Stage = 'upload' | 'preview' | 'result';

function deliveryLabel(status: CredentialDelivery['status']) {
    if (status === 'sent') return 'Accepted by mail server';
    if (status === 'delivered') return 'Delivered';
    if (status === 'failed') return 'Failed';
    if (status === 'superseded') return 'PIN changed; email cancelled';
    if (status === 'sending') return 'Sending…';
    return 'Queued';
}

function deliveryColor(status: CredentialDelivery['status']) {
    if (status === 'sent' || status === 'delivered') return 'text-green-700';
    if (status === 'failed') return 'text-red-600';
    return 'text-amber-700';
}

export default function ImportFamilies({
    initialDeliveries = [],
}: {
    initialDeliveries?: CredentialDelivery[];
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [stage, setStage] = useState<Stage>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Preview state
    const [meta, setMeta] = useState<PreviewMeta | null>(null);
    const [rows, setRows] = useState<PreviewRow[]>([]);
    const [previewErrors, setPreviewErrors] = useState<ImportError[]>([]);
    const [locationExists, setLocationExists] = useState<boolean | null>(null);
    const [emailTransportConfigured, setEmailTransportConfigured] = useState<
        boolean | null
    >(null);

    // Result state
    const [resultImported, setResultImported] = useState(0);
    const [resultSkipped, setResultSkipped] = useState(0);
    const [resultErrors, setResultErrors] = useState<ImportError[]>([]);
    const [deliveries, setDeliveries] =
        useState<CredentialDelivery[]>(initialDeliveries);
    const [retryingId, setRetryingId] = useState<number | null>(null);
    const deliveryIds = deliveries.map((delivery) => delivery.id).join(',');
    const hasQueuedDeliveries = deliveries.some(
        (delivery) =>
            delivery.status === 'pending' || delivery.status === 'sending',
    );

    useEffect(() => {
        if (!hasQueuedDeliveries || !deliveryIds) return;
        let active = true;
        const refresh = async () => {
            try {
                const params = new URLSearchParams();
                deliveryIds
                    .split(',')
                    .forEach((id) => params.append('ids[]', id));
                const response = await fetch(
                    `/families/import/deliveries?${params}`,
                );
                if (!response.ok) return;
                const data = await response.json();
                if (active) setDeliveries(data.deliveries ?? []);
            } catch {
                // The result remains visible; a later poll can recover transient network errors.
            }
        };
        const timer = window.setInterval(refresh, 5000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [deliveryIds, hasQueuedDeliveries]);

    const retryDelivery = async (id: number) => {
        setRetryingId(id);
        setError(null);
        try {
            const response = await fetch(
                `/families/import/deliveries/${id}/retry`,
                {
                    method: 'POST',
                    headers: {
                        'X-CSRF-TOKEN':
                            (
                                document.querySelector(
                                    'meta[name=csrf-token]',
                                ) as HTMLMetaElement
                            )?.content ?? '',
                        Accept: 'application/json',
                    },
                },
            );
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message ?? 'Could not queue email retry.');
            setDeliveries((current) =>
                current.map((delivery) =>
                    delivery.id === id
                        ? { ...delivery, status: 'pending', last_error: null }
                        : delivery,
                ),
            );
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Could not queue email retry.',
            );
        } finally {
            setRetryingId(null);
        }
    };

    const handleFile = (f: File | null) => {
        setFile(f);
        setError(null);
    };

    const handlePreview = async () => {
        if (!file) {
            setError('Please select a file first.');
            return;
        }
        setBusy(true);
        setError(null);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch('/families/import/preview', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN':
                        (
                            document.querySelector(
                                'meta[name=csrf-token]',
                            ) as HTMLMetaElement
                        )?.content ?? '',
                },
                body: form,
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? 'Preview failed.');
                return;
            }
            setMeta(data.meta);
            setRows(data.rows);
            setPreviewErrors(data.errors ?? []);
            setLocationExists(data.locationExists ?? null);
            setEmailTransportConfigured(data.emailTransportConfigured ?? false);
            setStage('preview');
        } catch (e) {
            setError('Network error — check your connection.');
        } finally {
            setBusy(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setBusy(true);
        setError(null);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch('/families/import', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN':
                        (
                            document.querySelector(
                                'meta[name=csrf-token]',
                            ) as HTMLMetaElement
                        )?.content ?? '',
                },
                body: form,
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? 'Import failed.');
                return;
            }
            setResultImported(data.imported);
            setResultSkipped(data.skipped);
            setResultErrors(data.errors ?? []);
            setDeliveries(data.notifications ?? []);
            setStage('result');
        } catch (e) {
            setError('Network error — check your connection.');
        } finally {
            setBusy(false);
        }
    };

    const reset = () => {
        setStage('upload');
        setFile(null);
        setMeta(null);
        setRows([]);
        setPreviewErrors([]);
        setLocationExists(null);
        setError(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const validRows = rows.filter((r) => !r._error);
    const errorRows = rows.filter((r) => r._error);

    return (
        <AppLayout
            title="Import Families"
            subtitle="Bulk-import families from an Excel or CSV file"
        >
            <Head title="Import Families" />

            {/* Back button */}
            <button
                className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600"
                onClick={() => router.visit('/families')}
            >
                <ArrowLeft size={15} /> Back to Families
            </button>

            {/* ── Stage: Upload ─────────────────────────────────────────────── */}
            {stage === 'upload' && (
                <div className="space-y-5">
                    <div className="card max-w-xl p-6">
                        <h2 className="mb-1 text-base font-semibold text-slate-800">
                            Upload file
                        </h2>
                        <p className="mb-5 text-sm text-slate-500">
                            Accepted formats: <code>.xlsx</code>,{' '}
                            <code>.xls</code>, <code>.csv</code>. Max 10 MB.
                        </p>

                        {/* Download template */}
                        <a
                            href="/families/import/template"
                            className="btn-secondary mb-5 inline-flex items-center gap-2 text-sm"
                            download
                        >
                            <Download size={15} /> Download template
                        </a>

                        <div
                            className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center transition hover:border-blue-400 hover:bg-blue-50"
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                handleFile(e.dataTransfer.files[0] ?? null);
                            }}
                        >
                            <Upload size={32} className="mb-2 text-slate-400" />
                            <p className="text-sm font-medium text-slate-600">
                                {file
                                    ? file.name
                                    : 'Click to browse or drag & drop'}
                            </p>
                            {file && (
                                <p className="mt-1 text-xs text-slate-400">
                                    {(file.size / 1024).toFixed(1)} KB
                                </p>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) =>
                                handleFile(e.target.files?.[0] ?? null)
                            }
                        />

                        {error && (
                            <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                                {error}
                            </p>
                        )}

                        <button
                            className="btn-primary w-full"
                            onClick={handlePreview}
                            disabled={!file || busy}
                        >
                            {busy ? 'Parsing…' : 'Preview import'}
                        </button>
                    </div>
                    {deliveries.length > 0 && (
                        <div className="card overflow-hidden p-0">
                            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 uppercase">
                                Recent temporary PIN emails
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs text-slate-500 uppercase">
                                            <th className="px-4 py-2">
                                                Family
                                            </th>
                                            <th className="px-4 py-2">Email</th>
                                            <th className="px-4 py-2">
                                                Status
                                            </th>
                                            <th className="px-4 py-2">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deliveries.map((delivery) => (
                                            <tr
                                                key={delivery.id}
                                                className="border-b last:border-0"
                                            >
                                                <td className="px-4 py-2 font-medium">
                                                    {delivery.head_name}
                                                </td>
                                                <td className="px-4 py-2 text-slate-600">
                                                    {delivery.email}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span
                                                        className={deliveryColor(
                                                            delivery.status,
                                                        )}
                                                    >
                                                        {deliveryLabel(
                                                            delivery.status,
                                                        )}
                                                    </span>
                                                    {delivery.status ===
                                                        'failed' &&
                                                        delivery.last_error && (
                                                            <p className="mt-1 text-xs text-red-600">
                                                                {
                                                                    delivery.last_error
                                                                }
                                                            </p>
                                                        )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {delivery.status ===
                                                        'failed' && (
                                                        <button
                                                            className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50"
                                                            onClick={() =>
                                                                retryDelivery(
                                                                    delivery.id,
                                                                )
                                                            }
                                                            disabled={
                                                                retryingId ===
                                                                delivery.id
                                                            }
                                                        >
                                                            {retryingId ===
                                                            delivery.id
                                                                ? 'Queueing…'
                                                                : 'Retry'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Stage: Preview ────────────────────────────────────────────── */}
            {stage === 'preview' && meta && (
                <div className="space-y-5">
                    {/* Barangay info card */}
                    <div className="card p-4">
                        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Barangay from file
                        </p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                            <span className="text-slate-500">
                                Barangay Name
                            </span>{' '}
                            <span className="font-medium">
                                {meta.barangay_name || '—'}
                            </span>
                            <span className="text-slate-500">Captain Name</span>{' '}
                            <span>{meta.captain_name || '—'}</span>
                            <span className="text-slate-500">Contact</span>{' '}
                            <span>{meta.captain_contact || '—'}</span>
                            <span className="text-slate-500">Email</span>{' '}
                            <span>{meta.captain_email || '—'}</span>
                            <span className="text-slate-500">Type</span>{' '}
                            <span>{meta.type || 'distribution_center'}</span>
                            <span className="text-slate-500">Address</span>{' '}
                            <span>{meta.address || '—'}</span>
                            <span className="text-slate-500">City</span>{' '}
                            <span>{meta.city || '—'}</span>
                            <span className="text-slate-500">
                                Capacity
                            </span>{' '}
                            <span>{meta.capacity || '0'}</span>
                            <span className="text-slate-500">Status</span>{' '}
                            <span>{meta.status || 'active'}</span>
                        </div>
                        {!meta.barangay_name && (
                            <p className="mt-2 rounded bg-red-50 px-3 py-1.5 text-xs text-red-600">
                                ⚠ Barangay Name is missing from row 1 — import
                                will fail.
                            </p>
                        )}
                        {meta.barangay_name && locationExists === true && (
                            <p className="mt-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                                ℹ Barangay already exists — captain info will be
                                updated from this file.
                            </p>
                        )}
                        {meta.barangay_name && locationExists === false && (
                            <p className="mt-2 rounded bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                                ✓ New barangay — will be created with the
                                details above.
                            </p>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-sm">
                        <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700">
                            {validRows.length} ready to import
                        </span>
                        {errorRows.length > 0 && (
                            <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-600">
                                {errorRows.length} rows with errors (will be
                                skipped)
                            </span>
                        )}
                    </div>
                    {emailTransportConfigured === false && (
                        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Email is not configured for delivery. The accounts
                            can still be imported, but their temporary PIN
                            emails will fail until a real mail transport is
                            configured. Review the email setup instructions in
                            the project README.
                        </p>
                    )}

                    {/* Preview table */}
                    <div className="card overflow-x-auto p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase">
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">Head Name</th>
                                    <th className="px-3 py-2">Purok</th>
                                    <th className="px-3 py-2">Members</th>
                                    <th className="px-3 py-2">Phone</th>
                                    <th className="px-3 py-2">Email</th>
                                    <th className="px-3 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r._row_number}
                                        className={`border-b ${r._error ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                                    >
                                        <td className="px-3 py-2 text-slate-400">
                                            {r._row_number}
                                        </td>
                                        <td className="px-3 py-2 font-medium">
                                            {r.head_name || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">
                                            {r.purok_name || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">
                                            {r.member_names.length > 0 ? (
                                                r.member_names.join(', ')
                                            ) : (
                                                <span className="text-slate-300">
                                                    none
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">
                                            {r.phone ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">
                                            {r.email ?? '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                            {r._error ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                                    <AlertCircle size={12} />
                                                    {r._error}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                                    <CheckCircle2 size={12} />
                                                    OK
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {error && (
                        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <button className="btn-secondary" onClick={reset}>
                            Back
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleImport}
                            disabled={busy || validRows.length === 0}
                        >
                            {busy
                                ? 'Importing…'
                                : `Confirm — import ${validRows.length} families`}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Stage: Result ─────────────────────────────────────────────── */}
            {stage === 'result' && (
                <div className="max-w-3xl space-y-5">
                    <div className="card p-6 text-center">
                        <CheckCircle2
                            size={40}
                            className="mx-auto mb-3 text-green-500"
                        />
                        <p className="text-lg font-bold text-slate-800">
                            Import complete
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            Email status shows whether the mail server accepted
                            the message, not whether it reached the recipient’s
                            inbox.
                        </p>
                        <div className="mt-4 flex justify-center gap-8 text-sm">
                            <div>
                                <p className="text-2xl font-bold text-green-600">
                                    {resultImported}
                                </p>
                                <p className="text-slate-500">Imported</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-400">
                                    {resultSkipped}
                                </p>
                                <p className="text-slate-500">Skipped</p>
                            </div>
                        </div>
                    </div>

                    {deliveries.length > 0 && (
                        <div className="card overflow-hidden p-0">
                            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 uppercase">
                                Temporary PIN emails
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs text-slate-500 uppercase">
                                            <th className="px-4 py-2">
                                                Family
                                            </th>
                                            <th className="px-4 py-2">Email</th>
                                            <th className="px-4 py-2">
                                                Status
                                            </th>
                                            <th className="px-4 py-2">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deliveries.map((delivery) => (
                                            <tr
                                                key={delivery.id}
                                                className="border-b last:border-0"
                                            >
                                                <td className="px-4 py-2 font-medium">
                                                    {delivery.head_name}
                                                </td>
                                                <td className="px-4 py-2 text-slate-600">
                                                    {delivery.email}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span
                                                        className={deliveryColor(
                                                            delivery.status,
                                                        )}
                                                    >
                                                        {deliveryLabel(
                                                            delivery.status,
                                                        )}
                                                    </span>
                                                    {delivery.status ===
                                                        'failed' &&
                                                        delivery.last_error && (
                                                            <p className="mt-1 text-xs text-red-600">
                                                                {
                                                                    delivery.last_error
                                                                }
                                                            </p>
                                                        )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {delivery.status ===
                                                        'failed' && (
                                                        <button
                                                            className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50"
                                                            onClick={() =>
                                                                retryDelivery(
                                                                    delivery.id,
                                                                )
                                                            }
                                                            disabled={
                                                                retryingId ===
                                                                delivery.id
                                                            }
                                                        >
                                                            {retryingId ===
                                                            delivery.id
                                                                ? 'Queueing…'
                                                                : 'Retry'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {error && (
                        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                            {error}
                        </p>
                    )}

                    {resultErrors.length > 0 && (
                        <div className="card overflow-hidden p-0">
                            <div className="border-b bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 uppercase">
                                Errors
                            </div>
                            <ul className="divide-y text-sm">
                                {resultErrors.map((e, i) => (
                                    <li
                                        key={i}
                                        className="flex gap-3 px-4 py-2"
                                    >
                                        <span className="w-16 shrink-0 text-slate-400">
                                            Row {e.row}
                                        </span>
                                        <span className="text-red-600">
                                            {e.reason}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button className="btn-secondary" onClick={reset}>
                            Import another file
                        </button>
                        <button
                            className="btn-primary"
                            onClick={() => router.visit('/families')}
                        >
                            Go to Families
                        </button>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

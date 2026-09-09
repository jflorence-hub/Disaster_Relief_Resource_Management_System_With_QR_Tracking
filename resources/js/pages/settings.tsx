import AppLayout from '@/layouts/app-layout';
import { AuthUser } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { Database, Download, Trash2, Upload } from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';

interface Backup {
    name: string;
    size: number;
    created_at: number;
}

export default function Settings({
    user,
    settings,
    backups,
}: {
    user: AuthUser;
    settings: Record<string, string | null>;
    backups: Backup[];
}) {
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const profileForm = useForm({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
    });

    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const systemForm = useForm({
        app_name: settings.app_name ?? '',
        organization_contact_email: settings.organization_contact_email ?? '',
        organization_phone: settings.organization_phone ?? '',
        low_stock_default_threshold: settings.low_stock_default_threshold ?? '20',
    });

    const submitProfile: FormEventHandler = (e) => {
        e.preventDefault();
        profileForm.patch('/settings/profile');
    };

    const submitPassword: FormEventHandler = (e) => {
        e.preventDefault();
        passwordForm.put('/settings/password', { onSuccess: () => passwordForm.reset() });
    };

    const submitSystem: FormEventHandler = (e) => {
        e.preventDefault();
        systemForm.put('/settings/system');
    };

    const createBackup = () => {
        router.post('/settings/backup');
    };

    const deleteBackup = (name: string) => {
        router.delete(`/settings/backup/${name}`);
    };

    const submitRestore = () => {
        if (!restoreFile) return;
        const formData = new FormData();
        formData.append('backup_file', restoreFile);
        router.post('/settings/restore', formData, {
            onFinish: () => {
                setRestoreFile(null);
                setConfirmRestore(false);
                if (fileInput.current) fileInput.current.value = '';
            },
        });
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <AppLayout title="Settings" subtitle="Manage your account and system configuration">
            <Head title="Settings" />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="card">
                    <h2 className="mb-4 font-semibold text-slate-800">Profile Information</h2>
                    <form onSubmit={submitProfile} className="space-y-4">
                        <div>
                            <label className="label">Full name</label>
                            <input
                                className="input-field"
                                value={profileForm.data.name}
                                onChange={(e) => profileForm.setData('name', e.target.value)}
                            />
                            {profileForm.errors.name && (
                                <p className="mt-1 text-xs text-red-600">{profileForm.errors.name}</p>
                            )}
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={profileForm.data.email}
                                onChange={(e) => profileForm.setData('email', e.target.value)}
                            />
                            {profileForm.errors.email && (
                                <p className="mt-1 text-xs text-red-600">{profileForm.errors.email}</p>
                            )}
                        </div>
                        <div>
                            <label className="label">Phone</label>
                            <input
                                className="input-field"
                                value={profileForm.data.phone}
                                onChange={(e) => profileForm.setData('phone', e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={profileForm.processing}>
                            {profileForm.processing ? 'Saving…' : 'Save changes'}
                        </button>
                        {profileForm.recentlySuccessful && <span className="ml-3 text-sm text-emerald-600">Saved.</span>}
                    </form>
                </div>

                <div className="card">
                    <h2 className="mb-4 font-semibold text-slate-800">Change Password</h2>
                    <form onSubmit={submitPassword} className="space-y-4">
                        <div>
                            <label className="label">Current password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwordForm.data.current_password}
                                onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                            />
                            {passwordForm.errors.current_password && (
                                <p className="mt-1 text-xs text-red-600">{passwordForm.errors.current_password}</p>
                            )}
                        </div>
                        <div>
                            <label className="label">New password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwordForm.data.password}
                                onChange={(e) => passwordForm.setData('password', e.target.value)}
                            />
                            {passwordForm.errors.password && (
                                <p className="mt-1 text-xs text-red-600">{passwordForm.errors.password}</p>
                            )}
                        </div>
                        <div>
                            <label className="label">Confirm new password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwordForm.data.password_confirmation}
                                onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={passwordForm.processing}>
                            {passwordForm.processing ? 'Updating…' : 'Update password'}
                        </button>
                        {passwordForm.recentlySuccessful && (
                            <span className="ml-3 text-sm text-emerald-600">Updated.</span>
                        )}
                    </form>
                </div>

                <div className="card">
                    <h2 className="mb-4 font-semibold text-slate-800">System Settings</h2>
                    <form onSubmit={submitSystem} className="space-y-4">
                        <div>
                            <label className="label">Application name</label>
                            <input
                                className="input-field"
                                value={systemForm.data.app_name}
                                onChange={(e) => systemForm.setData('app_name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Organization contact email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={systemForm.data.organization_contact_email}
                                onChange={(e) => systemForm.setData('organization_contact_email', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Organization phone</label>
                            <input
                                className="input-field"
                                value={systemForm.data.organization_phone}
                                onChange={(e) => systemForm.setData('organization_phone', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Default low-stock threshold</label>
                            <input
                                type="number"
                                min={0}
                                className="input-field"
                                value={systemForm.data.low_stock_default_threshold}
                                onChange={(e) => systemForm.setData('low_stock_default_threshold', e.target.value)}
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                Used as the suggested default when adding new resources.
                            </p>
                        </div>
                        <button type="submit" className="btn-primary" disabled={systemForm.processing}>
                            {systemForm.processing ? 'Saving…' : 'Save system settings'}
                        </button>
                        {systemForm.recentlySuccessful && (
                            <span className="ml-3 text-sm text-emerald-600">Saved.</span>
                        )}
                    </form>
                </div>

                <div className="card">
                    <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                        <Database size={18} /> Backup & Restore Data
                    </h2>
                    <p className="mb-4 text-xs text-slate-500">
                        Backups include all locations, resources, distributions, QR scans, and user accounts.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        <button className="btn-primary flex items-center gap-2" onClick={createBackup}>
                            <Database size={16} /> Create Backup
                        </button>
                        <button
                            className="btn-outline flex items-center gap-2"
                            onClick={() => fileInput.current?.click()}
                        >
                            <Upload size={16} /> Choose Restore File
                        </button>
                        <input
                            ref={fileInput}
                            type="file"
                            accept=".zip"
                            className="hidden"
                            onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                        />
                    </div>

                    {restoreFile && (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            <span>Selected: {restoreFile.name}</span>
                            <button className="btn-danger text-xs" onClick={() => setConfirmRestore(true)}>
                                Restore now
                            </button>
                        </div>
                    )}

                    <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                        {backups.length === 0 && (
                            <p className="py-4 text-center text-sm text-slate-400">No backups created yet.</p>
                        )}
                        {backups.map((b) => (
                            <div key={b.name} className="flex items-center justify-between py-2.5 text-sm">
                                <div>
                                    <p className="font-medium text-slate-700">{b.name}</p>
                                    <p className="text-xs text-slate-400">
                                        {formatSize(b.size)} · {new Date(b.created_at * 1000).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-1.5">
                                    <a
                                        href={`/settings/backup/${b.name}/download`}
                                        className="rounded-lg p-1.5 text-blue-500 hover:bg-blue-50"
                                    >
                                        <Download size={15} />
                                    </a>
                                    <button
                                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                        onClick={() => deleteBackup(b.name)}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {confirmRestore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <h2 className="text-base font-semibold text-slate-800">Restore from backup?</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            This will replace all current locations, resources, distributions, QR scans, and user
                            accounts with the data in "{restoreFile?.name}". This cannot be undone.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button className="btn-secondary" onClick={() => setConfirmRestore(false)}>
                                Cancel
                            </button>
                            <button className="btn-danger" onClick={submitRestore}>
                                Yes, restore data
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

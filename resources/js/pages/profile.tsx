import AppLayout from '@/layouts/app-layout';
import type { AuthUser } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { AlertTriangle, Camera, KeyRound, User } from 'lucide-react';
import { useRef, useState } from 'react';

interface ProfileUser extends AuthUser {
    avatar?: string | null;
    avatar_url?: string | null;
    location?: { id: number; name: string } | null;
    purok?: { id: number; name: string } | null;
    staff_id?: string | null;
    must_change_password?: boolean;
}

interface FormData {
    name: string;
    email: string;
    phone: string;
}

interface PasswordFormData {
    current_password: string;
    password: string;
    password_confirmation: string;
}

export default function Profile({ user }: { user: ProfileUser }) {
    const [avatarPreview, setAvatarPreview] = useState<string | null>(
        user.avatar_url ?? (user.avatar ? `/storage/${user.avatar}` : null),
    );
    const fileRef = useRef<HTMLInputElement>(null);

    const form = useForm<FormData>({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
    });

    const passwordForm = useForm<PasswordFormData>({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        form.post('/profile', { preserveScroll: true });
    };

    const submitPassword = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        passwordForm.post('/profile/password', {
            preserveScroll: true,
            onSuccess: () => passwordForm.reset(),
        });
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
        reader.readAsDataURL(file);

        router.post(
            '/profile/avatar',
            { avatar: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: () =>
                    setAvatarPreview(user.avatar_url ?? (user.avatar ? `/storage/${user.avatar}` : null)),
            },
        );
    };

    const initials = user.name
        ? user.name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? '')
              .join('')
        : '?';

    return (
        <AppLayout title="Profile" subtitle="Your account information">
            <Head title="Profile" />

            <div className="mx-auto max-w-2xl space-y-6">
                {/* TEMP PASSWORD BANNER */}
                {user.must_change_password && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        <p className="text-sm text-amber-800">
                            You are using a temporary password. Please change it below before continuing.
                        </p>
                    </div>
                )}

                {/* AVATAR + IDENTITY CARD */}
                <div className="card flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold text-blue-700 ring-4 ring-blue-50">
                            {avatarPreview ? (
                                <img
                                    src={avatarPreview}
                                    alt="Profile avatar"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                initials
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow hover:bg-blue-700"
                            title="Change avatar"
                        >
                            <Camera size={13} />
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarChange}
                        />
                    </div>

                    {/* Identity */}
                    <div className="flex-1 text-center sm:text-left">
                        <h2 className="text-xl font-semibold text-slate-800">{user.name}</h2>
                        <p className="text-sm text-slate-500">{user.email}</p>

                        <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium capitalize text-blue-700">
                                {user.role}
                            </span>
                            <span
                                className={`rounded-full px-3 py-0.5 text-xs font-medium capitalize ${
                                    user.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : user.status === 'on_leave'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-red-100 text-red-700'
                                }`}
                            >
                                {user.status?.replace('_', ' ') ?? 'Active'}
                            </span>
                        </div>

                        {/* Staff-specific info */}
                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            {user.staff_id && (
                                <>
                                    <dt className="text-slate-400">Staff ID</dt>
                                    <dd className="font-medium text-slate-700">{user.staff_id}</dd>
                                </>
                            )}
                            {user.location && (
                                <>
                                    <dt className="text-slate-400">Barangay</dt>
                                    <dd className="font-medium text-slate-700">{user.location.name}</dd>
                                </>
                            )}
                            {user.purok && (
                                <>
                                    <dt className="text-slate-400">Purok</dt>
                                    <dd className="font-medium text-slate-700">{user.purok.name}</dd>
                                </>
                            )}
                            {user.phone && (
                                <>
                                    <dt className="text-slate-400">Phone</dt>
                                    <dd className="font-medium text-slate-700">{user.phone}</dd>
                                </>
                            )}
                        </dl>
                    </div>
                </div>

                {/* EDIT FORM */}
                <div className="card">
                    <div className="mb-4 flex items-center gap-2">
                        <User size={18} className="text-slate-500" />
                        <h2 className="font-semibold text-slate-800">Edit Profile</h2>
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="label">Full Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                required
                            />
                            {form.errors.name && (
                                <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={form.data.email}
                                onChange={(e) => form.setData('email', e.target.value)}
                                required
                            />
                            {form.errors.email && (
                                <p className="mt-1 text-xs text-red-600">{form.errors.email}</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Phone Number</label>
                            <input
                                type="tel"
                                className="input-field"
                                placeholder="09XXXXXXXXX"
                                maxLength={11}
                                value={form.data.phone}
                                onChange={(e) => form.setData('phone', e.target.value)}
                            />
                            <p className="mt-1 text-xs text-slate-400">Must start with 09 and be 11 digits.</p>
                            {form.errors.phone && (
                                <p className="mt-1 text-xs text-red-600">{form.errors.phone}</p>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {form.processing ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* CHANGE PASSWORD */}
                <div className="card">
                    <div className="mb-4 flex items-center gap-2">
                        <KeyRound size={18} className="text-slate-500" />
                        <h2 className="font-semibold text-slate-800">Change Password</h2>
                    </div>

                    <form onSubmit={submitPassword} className="space-y-4">
                        <div>
                            <label className="label">Current Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwordForm.data.current_password}
                                onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            {passwordForm.errors.current_password && (
                                <p className="mt-1 text-xs text-red-600">
                                    {passwordForm.errors.current_password}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="label">New Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwordForm.data.password}
                                onChange={(e) => passwordForm.setData('password', e.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                required
                            />
                            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
                            {passwordForm.errors.password && (
                                <p className="mt-1 text-xs text-red-600">{passwordForm.errors.password}</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Confirm New Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwordForm.data.password_confirmation}
                                onChange={(e) =>
                                    passwordForm.setData('password_confirmation', e.target.value)
                                }
                                autoComplete="new-password"
                                required
                            />
                            {passwordForm.errors.password_confirmation && (
                                <p className="mt-1 text-xs text-red-600">
                                    {passwordForm.errors.password_confirmation}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={passwordForm.processing}
                            >
                                {passwordForm.processing ? 'Changing…' : 'Change Password'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

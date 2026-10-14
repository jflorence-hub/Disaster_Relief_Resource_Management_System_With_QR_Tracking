import AppLayout from '@/layouts/app-layout';
import type { AuthUser } from '@/types/models';
import { Head, router, useForm } from '@inertiajs/react';
import { Camera, User } from 'lucide-react';
import { useRef, useState } from 'react';

interface ProfileUser extends AuthUser {
    avatar?: string | null;
    location?: { id: number; name: string } | null;
    purok?: { id: number; name: string } | null;
    staff_id?: string | null;
}

interface FormData {
    name: string;
    email: string;
    phone: string;
}

export default function Profile({ user }: { user: ProfileUser }) {
    const [avatarPreview, setAvatarPreview] = useState<string | null>(
        user.avatar ? `/storage/${user.avatar}` : null,
    );
    const fileRef = useRef<HTMLInputElement>(null);

    const form = useForm<FormData>({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
    });

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        form.post('/profile', {
            preserveScroll: true,
        });
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Local preview
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
        reader.readAsDataURL(file);

        // Upload immediately
        router.post(
            '/profile/avatar',
            { avatar: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: () => setAvatarPreview(user.avatar ? `/storage/${user.avatar}` : null),
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
                        {/* NAME */}
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

                        {/* EMAIL */}
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

                        {/* PHONE */}
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
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={form.processing}
                            >
                                {form.processing ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

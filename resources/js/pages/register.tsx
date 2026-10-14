import { Head, Link, router, useForm } from '@inertiajs/react';
import { LifeBuoy } from 'lucide-react';
import { FormEventHandler } from 'react';

export default function Register({ puroks }: { puroks: { id: number; name: string; code: string }[] }) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        phone: '',
        purok_id: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/register', {
            onError: () => {},
            onSuccess: () => router.visit('/login'),
        });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <Head title="Request Staff Access" />
            <div className="w-full max-w-md">
                <div className="mb-6 flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <LifeBuoy size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">Request Staff Access</h1>
                    <p className="mt-1 text-sm text-slate-500">Your request will be reviewed by an admin before activation.</p>
                </div>

                <div className="card">
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="label">Full name</label>
                            <input
                                className="input-field"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                autoFocus
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="label">Phone (optional)</label>
                            <input
                                className="input-field"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Assigned Purok</label>
                            <select
                                className="input-field"
                                value={data.purok_id}
                                onChange={(e) => setData('purok_id', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select a purok</option>
                                {puroks.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            {errors.purok_id && <p className="mt-1 text-xs text-red-600">{errors.purok_id}</p>}
                        </div>
                        <button type="submit" className="btn-primary w-full" disabled={processing}>
                            {processing ? 'Submitting…' : 'Submit Request'}
                        </button>
                    </form>
                    <p className="mt-4 text-center text-sm text-slate-500">
                        Already have an account?{' '}
                        <Link href="/login" className="font-medium text-blue-600 hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>

                <p className="mt-6 text-center text-xs text-slate-400">
                    New accounts require admin approval before login is possible.
                </p>
            </div>
        </div>
    );
}

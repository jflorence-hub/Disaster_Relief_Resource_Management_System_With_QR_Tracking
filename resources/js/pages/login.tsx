import { Head, Link, useForm } from '@inertiajs/react';
import { LifeBuoy } from 'lucide-react';
import { FormEventHandler } from 'react';

export default function Login({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <Head title="Log in" />
            <div className="w-full max-w-md">
                <div className="mb-6 flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <LifeBuoy size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">Disaster Relief Resource Management</h1>
                    <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
                </div>

                <div className="card">
                    {status && (
                        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</div>
                    )}
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                autoFocus
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                            />
                            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                            />
                            Remember me
                        </label>
                        <button type="submit" className="btn-primary w-full" disabled={processing}>
                            {processing ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                    <p className="mt-4 text-center text-sm text-slate-500">
                        Don't have an account?{' '}
                        <Link href="/register" className="font-medium text-blue-600 hover:underline">
                            Register
                        </Link>
                    </p>
                </div>

                <p className="mt-6 text-center text-xs text-slate-400">
                    Demo admin login: admin@disasterrelief.test / password
                </p>
            </div>
        </div>
    );
}

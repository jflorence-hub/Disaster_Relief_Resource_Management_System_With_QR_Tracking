import { Head, Link, useForm } from '@inertiajs/react';
import { LifeBuoy } from 'lucide-react';
import { FormEventHandler } from 'react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/register', {
            onError: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <Head title="Register" />
            <div className="w-full max-w-md">
                <div className="mb-6 flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <LifeBuoy size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">Create an account</h1>
                    <p className="mt-1 text-sm text-slate-500">Join the relief coordination team</p>
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
                            <label className="label">Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                            />
                            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                        </div>
                        <div>
                            <label className="label">Confirm password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-primary w-full" disabled={processing}>
                            {processing ? 'Creating account…' : 'Create account'}
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
                    New accounts are created with Staff-level access.
                </p>
            </div>
        </div>
    );
}

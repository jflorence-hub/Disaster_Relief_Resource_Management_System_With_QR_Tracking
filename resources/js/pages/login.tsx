import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowRight,
    ClipboardList,
    LifeBuoy,
    LockKeyhole,
    ShieldCheck,
} from 'lucide-react';
import type { FormEventHandler } from 'react';

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
        <div className="min-h-screen bg-slate-50">
            <Head title="Administrator Sign In" />

            <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
                <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl shadow-blue-950/5 lg:min-h-[680px] lg:grid-cols-2">
                    <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-8 text-white sm:p-12">
                        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full border border-white/10" />
                        <div className="absolute -right-12 -bottom-32 h-96 w-96 rounded-full border border-white/10" />

                        <div className="relative">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                                    <LifeBuoy size={23} />
                                </div>
                                <div>
                                    <p className="font-semibold tracking-wide">
                                        Disaster Relief
                                    </p>
                                    <p className="text-xs text-blue-100">
                                        Resource Management System
                                    </p>
                                </div>
                            </div>

                            <div className="mt-20 max-w-lg">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-blue-100 ring-1 ring-white/15">
                                    <ShieldCheck size={14} />
                                    ADMINISTRATOR PORTAL
                                </span>
                                <h1 className="mt-6 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
                                    Relief operations, under control.
                                </h1>
                                <p className="mt-5 max-w-md text-base leading-7 text-blue-100">
                                    Manage resources, coordinate distribution
                                    schedules, and keep support moving to the
                                    communities that need it.
                                </p>
                            </div>
                        </div>

                        <div className="relative mt-16 grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                <ClipboardList
                                    size={19}
                                    className="shrink-0 text-blue-200"
                                />
                                <span className="text-sm text-blue-50">
                                    Inventory &amp; distributions
                                </span>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                <ShieldCheck
                                    size={19}
                                    className="shrink-0 text-blue-200"
                                />
                                <span className="text-sm text-blue-50">
                                    Secure admin access
                                </span>
                            </div>
                        </div>
                    </section>

                    <section className="flex items-center justify-center p-6 sm:p-12">
                        <div className="w-full max-w-md">
                            <div className="mb-8">
                                <p className="text-sm font-semibold text-blue-700">
                                    Welcome back
                                </p>
                                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                                    Sign in to your account
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Use your administrator credentials to
                                    continue to the web dashboard.
                                </p>
                            </div>

                            {status && (
                                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    {status}
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-5">
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="mb-1.5 block text-sm font-medium text-slate-700"
                                    >
                                        Email address
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="username"
                                        className="input-field"
                                        placeholder="admin@example.com"
                                        value={data.email}
                                        onChange={(e) =>
                                            setData('email', e.target.value)
                                        }
                                        autoFocus
                                        required
                                    />
                                    {errors.email && (
                                        <p className="mt-1.5 text-sm text-red-600">
                                            {errors.email}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label
                                        htmlFor="password"
                                        className="mb-1.5 block text-sm font-medium text-slate-700"
                                    >
                                        Password
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        autoComplete="current-password"
                                        className="input-field"
                                        placeholder="Enter your password"
                                        value={data.password}
                                        onChange={(e) =>
                                            setData('password', e.target.value)
                                        }
                                        required
                                    />
                                    {errors.password && (
                                        <p className="mt-1.5 text-sm text-red-600">
                                            {errors.password}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                                            checked={data.remember}
                                            onChange={(e) =>
                                                setData(
                                                    'remember',
                                                    e.target.checked,
                                                )
                                            }
                                        />
                                        Remember me
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>

                                <div className="flex justify-center">
                                    <button
                                        type="submit"
                                        className="btn-primary flex w-full max-w-[280px] items-center justify-center gap-2 py-2.5"
                                        disabled={processing}
                                    >
                                        {processing ? (
                                            'Signing in…'
                                        ) : (
                                            <>
                                                Sign in
                                                <ArrowRight size={17} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-8 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                                <LockKeyhole
                                    size={17}
                                    className="mt-0.5 shrink-0 text-slate-400"
                                />
                                <p className="text-xs leading-5 text-slate-500">
                                    This web portal is for administrators. Staff
                                    should use the staff mobile app.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

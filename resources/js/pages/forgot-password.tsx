import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

export default function ForgotPassword() {
    const page = usePage<{
        flash?: { status?: string };
        errors: Record<string, string>;
    }>();

    const [step, setStep] = useState(1);

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        otp: '',
        password: '',
        password_confirmation: '',
    });

    const send: FormEventHandler = (e) => {
        e.preventDefault();

        post('/forgot-password/send-otp', {
            onSuccess: () => setStep(2),
        });
    };

    const verify: FormEventHandler = (e) => {
        e.preventDefault();

        post('/forgot-password/verify-otp', {
            onSuccess: () => setStep(3),
        });
    };

    const reset: FormEventHandler = (e) => {
        e.preventDefault();
        post('/forgot-password/reset');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <Head title="Recover password" />

            <div className="card w-full max-w-md">
                <h1 className="text-xl font-bold text-slate-800">
                    Recover your password
                </h1>

                <p className="mb-5 mt-1 text-sm text-slate-500">
                    Verify your email before creating a new password.
                </p>

                {page.props.flash?.status && (
                    <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                        {page.props.flash.status}
                    </p>
                )}

                {step === 1 && (
                    <form onSubmit={send} className="space-y-4">
                        <label className="label">Gmail address</label>

                        <input
                            className="input-field"
                            type="email"
                            required
                            value={data.email}
                            onChange={(e) =>
                                setData('email', e.target.value)
                            }
                            placeholder="you@gmail.com"
                        />

                        {errors.email && (
                            <p className="text-xs text-red-600">
                                {errors.email}
                            </p>
                        )}

                        <button
                            className="btn-primary w-full"
                            disabled={processing}
                        >
                            {processing ? 'Sending…' : 'Send OTP'}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={verify} className="space-y-4">
                        <label className="label">6-digit OTP</label>

                        <input
                            className="input-field"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            value={data.otp}
                            onChange={(e) =>
                                setData('otp', e.target.value)
                            }
                            placeholder="Enter OTP"
                        />

                        {errors.otp && (
                            <p className="text-xs text-red-600">
                                {errors.otp}
                            </p>
                        )}

                        <button
                            className="btn-primary w-full"
                            disabled={processing}
                        >
                            {processing ? 'Verifying…' : 'Verify OTP'}
                        </button>

                        <button
                            type="button"
                            className="w-full text-sm text-blue-600"
                            onClick={() => post('/forgot-password/send-otp')}
                        >
                            Resend OTP
                        </button>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={reset} className="space-y-4">
                        <label className="label">New password</label>

                        <input
                            className="input-field"
                            type="password"
                            minLength={8}
                            required
                            value={data.password}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                        />

                        {errors.password && (
                            <p className="text-xs text-red-600">
                                {errors.password}
                            </p>
                        )}

                        <label className="label">
                            Re-enter new password
                        </label>

                        <input
                            className="input-field"
                            type="password"
                            required
                            value={data.password_confirmation}
                            onChange={(e) =>
                                setData(
                                    'password_confirmation',
                                    e.target.value
                                )
                            }
                        />

                        <button
                            className="btn-primary w-full"
                            disabled={processing}
                        >
                            {processing
                                ? 'Updating…'
                                : 'Confirm new password'}
                        </button>
                    </form>
                )}

                <p className="mt-5 text-center text-sm text-slate-500">
                    <Link
                        href="/login"
                        className="font-medium text-blue-600 hover:underline"
                    >
                        Back to login
                    </Link>
                </p>
            </div>
        </div>
    );
}
import { Head, Link } from '@inertiajs/react';
import { LifeBuoy, Package, QrCode, Truck } from 'lucide-react';

export default function Welcome() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            <Head title="Welcome" />
            <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <LifeBuoy size={20} />
                    </div>
                    <span className="text-lg font-bold text-slate-800">Disaster Relief</span>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/register" className="btn-outline">
                        Register
                    </Link>
                    <Link href="/login" className="btn-primary">
                        Sign in
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-6 py-20 text-center">
                <h1 className="text-4xl font-bold text-slate-800 sm:text-5xl">
                    Coordinate relief efforts, resources, and distribution — in one place
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
                    Track inventory across warehouses, scan QR-tagged supplies in the field, and
                    manage distribution to affected communities in real time.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link href="/register" className="btn-outline bg-white px-6 py-3 text-base">
                        Create an account
                    </Link>
                    <Link href="/login" className="btn-primary px-6 py-3 text-base">
                        Sign in
                    </Link>
                </div>
                <p className="mt-3 text-sm text-slate-400">
                    Or ask an administrator to add you via Team Management.
                </p>

                <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
                    <div className="card">
                        <Package className="mb-3 text-blue-600" size={28} />
                        <h3 className="font-semibold text-slate-800">Resource Inventory</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Track quantities, categories, and stock levels across every location.
                        </p>
                    </div>
                    <div className="card">
                        <QrCode className="mb-3 text-blue-600" size={28} />
                        <h3 className="font-semibold text-slate-800">QR Tracking</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Scan supplies with your camera to keep an accurate audit trail.
                        </p>
                    </div>
                    <div className="card">
                        <Truck className="mb-3 text-blue-600" size={28} />
                        <h3 className="font-semibold text-slate-800">Distribution</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Log deliveries to recipients and monitor beneficiaries served.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

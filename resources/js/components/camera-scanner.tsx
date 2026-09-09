import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const ELEMENT_ID = 'qr-camera-scanner';

export default function CameraScanner({
    active,
    onDecoded,
}: {
    active: boolean;
    onDecoded: (value: string) => void;
}) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        if (!active) return;

        let cancelled = false;
        setStarting(true);
        setError(null);

        const scanner = new Html5Qrcode(ELEMENT_ID);
        scannerRef.current = scanner;

        scanner
            .start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decodedText) => {
                    onDecoded(decodedText);
                },
                () => {
                    // ignore per-frame decode failures
                },
            )
            .then(() => {
                if (!cancelled) setStarting(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setError('Could not access the camera. Check browser permissions and try again.');
                    setStarting(false);
                }
            });

        return () => {
            cancelled = true;
            const current = scannerRef.current;
            if (current) {
                current
                    .stop()
                    .then(() => current.clear())
                    .catch(() => {});
            }
        };
    }, [active, onDecoded]);

    if (!active) return null;

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
            <div id={ELEMENT_ID} className="mx-auto max-w-sm" />
            {starting && <p className="p-4 text-center text-sm text-slate-300">Starting camera…</p>}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 p-4 text-sm text-red-600">
                    <CameraOff size={16} /> {error}
                </div>
            )}
        </div>
    );
}

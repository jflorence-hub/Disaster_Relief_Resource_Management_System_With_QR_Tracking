import Modal from '@/components/modal';

export default function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message,
    processing = false,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    processing?: boolean;
}) {
    return (
        <Modal open={open} onClose={onClose} title={title}>
            <p className="text-sm text-slate-600">{message}</p>
            <div className="mt-5 flex justify-end gap-2">
                <button className="btn-secondary" onClick={onClose} disabled={processing}>
                    Cancel
                </button>
                <button className="btn-danger" onClick={onConfirm} disabled={processing}>
                    {processing ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </Modal>
    );
}

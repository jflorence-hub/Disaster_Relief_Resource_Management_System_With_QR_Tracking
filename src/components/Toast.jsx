import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white shadow-lg ${bgColor}`}>
      {message}
    </div>
  );
}
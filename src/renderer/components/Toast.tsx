import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type ToastType } from '../stores/toastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-400" />,
  error: <AlertCircle className="w-5 h-5 text-red-400" />,
  info: <Info className="w-5 h-5 text-blue-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-green-900/90 border-green-700',
  error: 'bg-red-900/90 border-red-700',
  info: 'bg-blue-900/90 border-blue-700',
  warning: 'bg-yellow-900/90 border-yellow-700',
};

interface ToastItemProps {
  id: string;
  type: ToastType;
  message: string;
  onClose: () => void;
}

function ToastItem({ id, type, message, onClose }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  };

  return (
    <div
      key={id}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm
        ${bgMap[type]}
        ${isExiting ? 'animate-slide-out' : 'animate-slide-in'}
      `}
    >
      {iconMap[type]}
      <span className="flex-1 text-sm text-white">{message}</span>
      <button
        onClick={handleClose}
        className="p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4 text-white/70" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

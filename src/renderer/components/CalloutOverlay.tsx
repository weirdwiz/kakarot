import React, { useEffect, useState } from 'react';
import type { Callout } from '../../shared/types';
import { Lightbulb, X } from 'lucide-react';

export default function CalloutOverlay() {
  const [callout, setCallout] = useState<Callout | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = window.kakarot.callout.onShow((newCallout) => {
      setCallout(newCallout);
      setIsVisible(true);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = async () => {
    if (callout) {
      await window.kakarot.callout.dismiss(callout.id);
    }
    setIsVisible(false);
    setCallout(null);
  };

  if (!isVisible || !callout) {
    return null;
  }

  return (
    <div className="p-2">
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-primary-600/20 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-gray-300">Question Detected</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          {/* Question */}
          <p className="text-xs text-gray-400 mb-1">Question:</p>
          <p className="text-sm text-white mb-3 line-clamp-2">{callout.question}</p>

          {/* Suggested response */}
          <p className="text-xs text-gray-400 mb-1">Suggested Response:</p>
          <p className="text-sm text-green-300 leading-relaxed line-clamp-3">
            {callout.suggestedResponse}
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-900/50 border-t border-gray-700">
          <button
            onClick={handleDismiss}
            className="w-full text-xs text-gray-400 hover:text-white transition-colors"
          >
            Click to dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

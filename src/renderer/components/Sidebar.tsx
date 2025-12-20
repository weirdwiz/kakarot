import React from 'react';
import { useAppStore } from '../stores/appStore';
import { Mic, History, Settings } from 'lucide-react';

export default function Sidebar() {
  const { view, setView, recordingState } = useAppStore();

  const navItems = [
    { id: 'recording' as const, label: 'Record', icon: Mic },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 drag-region">
      <div className="mb-8 no-drag">
        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center font-bold text-lg text-white">
          K
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-2 no-drag">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              view === item.id
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {recordingState === 'recording' && (
        <div className="mt-auto no-drag">
          <div className="w-3 h-3 rounded-full bg-red-500 recording-indicator" />
        </div>
      )}
    </aside>
  );
}

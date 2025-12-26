import React from 'react';
import { useAppStore } from '../stores/appStore';
import { Mic, History, Settings } from 'lucide-react';

export default function Sidebar() {
  const { view, setView, recordingState } = useAppStore();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const navItems = [
    { id: 'recording' as const, label: 'Record', icon: Mic },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-16 bg-slate-50 dark:bg-[#050505] border-r border-slate-200 dark:border-purple-900/30 flex flex-col items-center pt-[48px] pb-4 drag-region">
      <nav className="flex-1 flex flex-col gap-2 no-drag">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              view === item.id
                ? 'bg-emerald-mist text-onyx shadow-soft-card dark:bg-[#7C3AED] dark:text-white'
                : 'text-slate-500 hover:text-slate-900 hover:bg-sky-glow/20 dark:text-slate-300 dark:hover:bg-white/10'
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

      {/* User Avatar at Bottom */}
      <div className="mt-auto no-drag pt-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="relative w-12 h-12 rounded-full bg-slate-300 dark:bg-[#7C3AED] flex items-center justify-center font-bold text-lg text-slate-600 dark:text-white hover:opacity-90 active:opacity-75 transition"
          title="User Settings"
        >
          K
          {showUserMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap z-50">
              <button className="block w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                Account Settings
              </button>
              <button className="block w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                Profile
              </button>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Mic, History, Settings, Users } from 'lucide-react';

export default function Sidebar() {
  const { view, setView, recordingState } = useAppStore();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [userProfile, setUserProfile] = React.useState<{ name?: string; photo?: string } | null>(null);
  const [imageLoadError, setImageLoadError] = React.useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    window.kakarot.settings.get().then((settings) => {
      if (settings.userProfile) {
        setUserProfile(settings.userProfile);
        setImageLoadError(false); // Reset error state when profile changes
      }
    });
  }, []);

  // Calculate menu position to keep it within viewport
  useEffect(() => {
    if (!showUserMenu || !menuRef.current || !buttonRef.current) return;

    const button = buttonRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    
    // Default: above the button, centered
    let top = -menu.height - 12; // 12px gap above
    let left = -menu.width / 2 + button.width / 2;

    // Check if menu would go off-screen
    const windowWidth = window.innerWidth;
    const sidebarRight = button.right;

    // If menu goes off bottom, flip above
    if (button.top + top < 16) {
      top = button.height + 12; // Move below instead
    }

    // If menu goes off right, shift left
    const menuRight = sidebarRight + left + menu.width;
    if (menuRight > windowWidth - 16) {
      left = -menu.width + 16;
    }

    // If menu goes off left, shift right
    const menuLeft = sidebarRight + left;
    if (menuLeft < 16) {
      left = 16 - sidebarRight;
    }

    setMenuPosition({ top, left });
  }, [showUserMenu]);

  const navItems = [
    { id: 'recording' as const, label: 'Record', icon: Mic },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'people' as const, label: 'People', icon: Users },
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
          ref={buttonRef}
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="relative w-12 h-12 rounded-full bg-slate-300 dark:bg-[#7C3AED] flex items-center justify-center font-bold text-lg text-slate-600 dark:text-white hover:opacity-90 active:opacity-75 transition overflow-hidden"
          title="User Settings"
        >
          {userProfile?.photo && !imageLoadError ? (
            <img 
              src={userProfile.photo} 
              alt="User" 
              className="w-full h-full object-cover" 
              onError={() => setImageLoadError(true)}
            />
          ) : (
            <span>{userProfile?.name?.[0]?.toUpperCase() || 'K'}</span>
          )}
        </button>
        {showUserMenu && (
          <div
            ref={menuRef}
            className="fixed py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap z-50"
            style={{
              transform: `translate(calc(${menuPosition.left}px - 100%), ${menuPosition.top}px)`,
              left: buttonRef.current?.getBoundingClientRect().right,
              top: buttonRef.current?.getBoundingClientRect().top,
            }}
            onClick={() => setShowUserMenu(false)}
          >
            <button className="block w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              Account Settings
            </button>
            <button className="block w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              Profile
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

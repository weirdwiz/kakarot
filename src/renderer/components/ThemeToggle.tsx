import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('kakarot-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('kakarot-theme', theme);
  }, [theme]);

  const toggle = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative inline-flex items-center px-1 py-1 rounded-full border border-white/10 bg-white/50 dark:bg-graphite/80 dark:border-white/10 backdrop-blur-md shadow-soft-card transition"
    >
      <span
        className={`absolute inset-1 rounded-full bg-white/80 dark:bg-onyx/90 shadow-soft-card transition-transform duration-200 ${
          isDark ? 'translate-x-[52%]' : 'translate-x-0'
        }`}
        aria-hidden
      />
      <div className="relative z-10 flex items-center gap-2 px-3 text-sm font-semibold">
        <Sun className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-amber-400'}`} />
        <span className="text-slate-700 dark:text-slate-200">{isDark ? 'Dark' : 'Light'}</span>
        <Moon className={`w-4 h-4 ${isDark ? 'text-emerald-mist' : 'text-slate-400'}`} />
      </div>
    </button>
  );
}

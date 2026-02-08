import { useState, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { History, Users, Settings } from 'lucide-react';
import logoImage from '../assets/logo transparent copy.png';
import FeedbackPopover from './FeedbackPopover';
import FeedbackModal from './FeedbackModal';

export default function Sidebar() {
  const { view, setView, recordingState, settings } = useAppStore();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'message' | 'feedback'>('feedback');
  const logoRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'people' as const, label: 'People', icon: Users },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const showIndicator = settings?.showLiveMeetingIndicator ?? true;

  return (
    <aside className="w-20 bg-[#050505] border-r-2 border-[#4ea8dd]/30 flex flex-col items-center pt-[48px] pb-4 drag-region">
      <nav className="flex-1 flex flex-col gap-2 no-drag">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              view === item.id
                ? 'bg-[#4ea8dd] text-white'
                : 'text-slate-300 hover:bg-white/10'
            }`}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {recordingState === 'recording' && showIndicator && (
        <div className="mt-auto no-drag">
          <div className="w-3 h-3 rounded-full bg-red-500 recording-indicator" />
        </div>
      )}

      {/* Logo at Bottom */}
      <div className="mt-auto no-drag pt-2 border-t border-[#4ea8dd]/20">
        <div
          ref={logoRef}
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className="flex flex-col items-center gap-0 cursor-pointer hover:opacity-80 transition"
        >
          <div className="w-40 h-40 -mb-14">
            <img
              src={logoImage}
              alt="Treeto"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-[10px] font-medium tracking-wide uppercase text-slate-300">Treeto.</span>
        </div>
      </div>

      {/* Feedback Popover */}
      <FeedbackPopover
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
        anchorEl={logoRef.current}
        onSelectMessage={() => {
          setModalMode('message');
          setIsModalOpen(true);
        }}
        onSelectFeedback={() => {
          setModalMode('feedback');
          setIsModalOpen(true);
        }}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
      />
    </aside>
  );
}

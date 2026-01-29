import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AppSettings } from '@shared/types';
import { Plus, X, Settings, Sparkles, Check, Users, Rocket, Code, FileText, Target, Calendar } from 'lucide-react';

// Standard meeting types with descriptions
const STANDARD_MEETING_TYPES = [
  {
    id: '1-on-1',
    title: '1:1 Meeting',
    description: 'One-on-one discussions with team members or stakeholders',
    icon: Users,
    prompt: 'Prepare for a focused one-on-one meeting with clear objectives and talking points.'
  },
  {
    id: 'kick-off',
    title: 'Kick-Off',
    description: 'Project or initiative launch meetings',
    icon: Rocket,
    prompt: 'Set the stage for a new project with goals, timelines, and team alignment.'
  },
  {
    id: 'technical-sync',
    title: 'Technical Sync',
    description: 'Deep technical discussions and architecture reviews',
    icon: Code,
    prompt: 'Facilitate technical discussions with clear context and decision points.'
  },
  {
    id: 'status-update',
    title: 'Status Update',
    description: 'Progress reviews and checkpoint meetings',
    icon: FileText,
    prompt: 'Share project progress, blockers, and next steps effectively.'
  },
  {
    id: 'planning',
    title: 'Planning Session',
    description: 'Strategic planning and roadmap discussions',
    icon: Target,
    prompt: 'Organize strategic planning with clear priorities and action items.'
  },
  {
    id: 'retrospective',
    title: 'Retrospective',
    description: 'Reflect on what went well and what to improve',
    icon: Calendar,
    prompt: 'Facilitate constructive reflection on team processes and outcomes.'
  }
];

type TabType = 'standard' | 'custom';

export default function InteractView() {
  const { settings, setSettings } = useAppStore();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('standard');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  // New item inputs
  const [newMeetingType, setNewMeetingType] = useState('');

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!localSettings) return;

    setIsSaving(true);
    setSaveMessage('');

    try {
      await window.kakarot.settings.update(localSettings);
      setSettings(localSettings);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const addMeetingType = () => {
    if (!localSettings || !newMeetingType.trim()) return;

    const currentTypes = localSettings.customMeetingTypes || [];
    if (currentTypes.includes(newMeetingType.trim())) return;

    setLocalSettings({
      ...localSettings,
      customMeetingTypes: [...currentTypes, newMeetingType.trim()]
    });
    setNewMeetingType('');
  };

  const removeMeetingType = (type: string) => {
    if (!localSettings) return;

    setLocalSettings({
      ...localSettings,
      customMeetingTypes: (localSettings.customMeetingTypes || []).filter(t => t !== type)
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  if (!localSettings) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin">
          <Sparkles className="w-8 h-8 text-purple-500" />
        </div>
      </div>
    );
  }

  const meetingTypes = localSettings.customMeetingTypes || [];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#0C0C0F] via-[#0D0D0F] to-[#0C0C14]">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#7C3AED]/20">
            <Settings className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Interact Settings</h1>
            <p className="text-sm text-slate-400">Customize your meeting preparation experience</p>
          </div>
        </div>
        
        {/* Save Button in Header */}
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes('successfully') ? 'text-green-400' : 'text-red-400'}`}>
              {saveMessage}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin">
                  <Sparkles className="w-4 h-4" />
                </div>
                Saving...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('standard')}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'standard'
                ? 'bg-[#1A1A1A] border-2 border-white/20 text-white'
                : 'bg-[#1A1A1A] border-2 border-white/5 text-slate-400 hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              {activeTab === 'standard' && <Check className="w-4 h-4" />}
              Standard Meeting Types
            </div>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'custom'
                ? 'bg-[#1A1A1A] border-2 border-white/20 text-white'
                : 'bg-[#1A1A1A] border-2 border-white/5 text-slate-400 hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              {activeTab === 'custom' && <Check className="w-4 h-4" />}
              Your Custom Meeting Types
            </div>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 px-8 pb-8 overflow-y-auto">
        {activeTab === 'standard' ? (
          // Standard Meeting Types Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STANDARD_MEETING_TYPES.map((type) => {
              const IconComponent = type.icon;
              return (
                <div
                  key={type.id}
                  className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all"
                >
                  {/* Icon */}
                  <div className="mb-4 p-3 bg-[#7C3AED]/10 rounded-xl w-fit">
                    <IconComponent className="w-6 h-6 text-[#7C3AED]" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-white font-semibold mb-2">{type.title}</h3>
                  
                  {/* Description */}
                  <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                    {type.description}
                  </p>
                  
                  {/* View Prompt Button */}
                  <button
                    onClick={() => setSelectedPrompt(selectedPrompt === type.prompt ? null : type.prompt)}
                    className="w-full px-4 py-2 border-2 border-[#7C3AED] text-[#7C3AED] rounded-lg hover:bg-[#7C3AED]/10 transition-colors text-sm font-medium"
                  >
                    {selectedPrompt === type.prompt ? 'Hide Prompt' : 'View Prompt'}
                  </button>
                  
                  {/* Prompt Display */}
                  {selectedPrompt === type.prompt && (
                    <div className="mt-3 p-3 bg-[#0D0D0D] border border-white/5 rounded-lg">
                      <p className="text-slate-300 text-xs leading-relaxed">
                        {type.prompt}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Custom Meeting Types Section
          <div>
            {meetingTypes.length === 0 ? (
              // Empty State
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-4 p-4 bg-[#1A1A1A] rounded-2xl">
                  <FileText className="w-12 h-12 text-slate-600" />
                </div>
                <p className="text-slate-400 mb-6">No custom meeting types yet</p>
                <button
                  onClick={() => {
                    // Focus on input when create is clicked
                    const input = document.getElementById('custom-type-input');
                    if (input) input.focus();
                  }}
                  className="px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create New Type
                </button>
              </div>
            ) : (
              <div>
                {/* Create Button in Top Right */}
                <div className="flex justify-end mb-6">
                  <button
                    onClick={() => {
                      const input = document.getElementById('custom-type-input');
                      if (input) input.focus();
                    }}
                    className="px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium rounded-xl transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Create New Type
                  </button>
                </div>
                
                {/* Custom Types Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {meetingTypes.map((type) => (
                    <div
                      key={type}
                      className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all relative group"
                    >
                      {/* Delete Button */}
                      <button
                        onClick={() => removeMeetingType(type)}
                        className="absolute top-4 right-4 p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                      
                      {/* Icon */}
                      <div className="mb-4 p-3 bg-[#7C3AED]/10 rounded-xl w-fit">
                        <Sparkles className="w-6 h-6 text-[#7C3AED]" />
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-white font-semibold">{type}</h3>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add New Type Input - Always visible at bottom when custom tab is active */}
            <div className="mt-8 max-w-2xl">
              <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Add New Meeting Type</h3>
                <div className="flex gap-3">
                  <input
                    id="custom-type-input"
                    type="text"
                    placeholder="Enter meeting type name..."
                    value={newMeetingType}
                    onChange={(e) => setNewMeetingType(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addMeetingType)}
                    className="flex-1 px-4 py-3 border border-white/10 rounded-xl focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] focus:outline-none bg-[#0D0D0D] text-white placeholder:text-slate-500 text-sm"
                  />
                  <button
                    onClick={addMeetingType}
                    disabled={!newMeetingType.trim()}
                    className="px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-slate-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
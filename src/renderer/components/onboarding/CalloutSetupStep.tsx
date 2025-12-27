import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CalloutSetupStepProps {
  userName: string;
  onComplete: (data: { name: string; aliases: string[]; enableCallouts: boolean }) => void;
  onSkip: () => void;
}

export default function CalloutSetupStep({ userName, onComplete, onSkip }: CalloutSetupStepProps) {
  const [name, setName] = useState(userName || '');
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState('');
  const [enableCallouts, setEnableCallouts] = useState(true);

  const handleAddAlias = () => {
    if (aliasInput.trim() && !aliases.includes(aliasInput.trim())) {
      setAliases([...aliases, aliasInput.trim()]);
      setAliasInput('');
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter(a => a !== alias));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handleComplete = () => {
    onComplete({ name, aliases, enableCallouts });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-white">Personalize your callouts</h2>
        <p className="text-gray-400">
          Help us identify when someone asks you a question
        </p>
      </div>

      <div className="space-y-4 pt-4">
        {/* Name input */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Doe"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 border border-gray-700"
          />
        </div>

        {/* Aliases input */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">
            Also called (optional)
          </label>
          <input
            type="text"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g. Johnny, JD"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 border border-gray-700"
          />
          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-500/10 text-primary-400 rounded text-sm"
                >
                  {alias}
                  <button
                    onClick={() => handleRemoveAlias(alias)}
                    className="hover:text-primary-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Enable callouts toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div>
            <p className="text-sm font-medium text-white">Enable callout alerts</p>
            <p className="text-xs text-gray-500">
              Show suggestions when questions are detected
            </p>
          </div>
          <button
            onClick={() => setEnableCallouts(!enableCallouts)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              enableCallouts ? 'bg-primary-600' : 'bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                enableCallouts ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onSkip}
          className="flex-1 py-3 px-6 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors border border-gray-700"
        >
          Skip
        </button>
        <button
          onClick={handleComplete}
          disabled={!name.trim()}
          className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

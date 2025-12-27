import React, { useState } from 'react';
import { Calendar, Check } from 'lucide-react';

interface CalendarStepProps {
  onSuccess: () => void;
  onSkip: () => void;
}

export default function CalendarStep({ onSuccess, onSkip }: CalendarStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');

    try {
      // Try Google first (most common)
      await window.kakarot.calendar.connect('google');
      
      // Fetch upcoming meetings
      const events = await window.kakarot.calendar.listToday();
      setUpcomingCount(events.length);
      setIsConnected(true);
      
      // Auto-advance after showing success
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-white">Connect your calendar</h2>
        <p className="text-gray-400 max-w-md mx-auto">
          Read-only access to prepare you for upcoming meetings.
          We'll never modify or create events.
        </p>
      </div>

      <div className="pt-4">
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Calendar'}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3 py-3 px-6 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Check className="w-5 h-5 text-green-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-white">Calendar connected</p>
              <p className="text-xs text-gray-400">
                Found {upcomingCount} {upcomingCount === 1 ? 'meeting' : 'meetings'} today
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 text-center mt-3">{error}</p>
        )}
      </div>

      <div className="text-center pt-2">
        <button
          onClick={onSkip}
          disabled={isConnecting}
          className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}

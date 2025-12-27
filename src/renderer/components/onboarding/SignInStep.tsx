import React, { useState } from 'react';

interface SignInStepProps {
  onSuccess: (data: {
    name: string;
    email: string;
    avatar?: string;
    provider: 'google' | 'microsoft' | 'apple';
  }) => void;
  onSkip: () => void;
}

export default function SignInStep({ onSuccess, onSkip }: SignInStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async (provider: 'google' | 'microsoft' | 'apple') => {
    setIsConnecting(true);
    setError('');

    try {
      if (provider === 'google' || provider === 'microsoft') {
        const calendarProvider = provider === 'microsoft' ? 'outlook' : 'google';
        await window.kakarot.calendar.connect(calendarProvider);
        
        // Simulate extracting user info from OAuth response
        // In real implementation, this would come from the OAuth token/userinfo endpoint
        onSuccess({
          name: 'User',
          email: 'user@example.com',
          provider,
        });
      } else if (provider === 'apple') {
        // Apple sign-in would go here
        // For now, just simulate
        onSuccess({
          name: 'User',
          email: 'user@icloud.com',
          provider: 'apple',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-white">Sign in to get started</h2>
        <p className="text-gray-400">
          Connect your account to sync meetings and personalize your experience
        </p>
      </div>

      <div className="space-y-3 pt-4">
        <button
          onClick={() => handleConnect('google')}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => handleConnect('microsoft')}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 23 23">
            <path fill="#f35325" d="M0 0h11v11H0z" />
            <path fill="#81bc06" d="M12 0h11v11H12z" />
            <path fill="#05a6f0" d="M0 12h11v11H0z" />
            <path fill="#ffba08" d="M12 12h11v11H12z" />
          </svg>
          Continue with Microsoft
        </button>

        <button
          onClick={() => handleConnect('apple')}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Continue with Apple
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      <div className="text-center pt-4">
        <button
          onClick={onSkip}
          className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}

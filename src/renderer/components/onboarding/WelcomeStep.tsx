import React from 'react';

interface WelcomeStepProps {
  onContinue: () => void;
}

export default function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="text-center space-y-6">
      {/* Logo placeholder */}
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-primary-600 flex items-center justify-center">
          <span className="text-4xl font-bold text-white">K</span>
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="text-4xl font-semibold text-white">
          Your meetings, finally handled.
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Automatic transcription, real-time notes, and intelligent prep for every call.
          Never miss context again.
        </p>
      </div>

      <div className="pt-8">
        <button
          onClick={onContinue}
          className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import WelcomeStep from './WelcomeStep';
import SignInStep from './SignInStep';
import CalendarStep from './CalendarStep';
import AudioPermissionsStep from './AudioPermissionsStep';
import CompletionStep from './CompletionStep';

export type OnboardingStep = 'welcome' | 'signin' | 'calendar' | 'audio' | 'complete';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [userData, setUserData] = useState<{
    name: string;
    email: string;
    avatar?: string;
    provider?: 'google' | 'microsoft' | 'apple';
  } | null>(null);

  const steps: OnboardingStep[] = ['welcome', 'signin', 'calendar', 'audio', 'complete'];
  const currentStepIndex = steps.indexOf(currentStep);

  const goToStep = (step: OnboardingStep) => {
    setCurrentStep(step);
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl mx-auto px-6">
        {/* Progress indicator */}
        {currentStep !== 'welcome' && currentStep !== 'complete' && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.slice(1, -1).map((step, index) => (
              <div
                key={step}
                className={`h-2 rounded-full transition-all ${
                  steps.indexOf(step) <= currentStepIndex
                    ? 'w-8 bg-primary-500'
                    : 'w-2 bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step content */}
        <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">
          {currentStep === 'welcome' && (
            <WelcomeStep onContinue={nextStep} />
          )}
          {currentStep === 'signin' && (
            <SignInStep
              onSuccess={(data) => {
                setUserData(data);
                nextStep();
              }}
            />
          )}
          {currentStep === 'calendar' && (
            <CalendarStep onSuccess={nextStep} />
          )}
          {currentStep === 'audio' && (
            <AudioPermissionsStep onSuccess={nextStep} />
          )}
          {currentStep === 'complete' && (
            <CompletionStep userName={userData?.name} onFinish={onComplete} />
          )}
        </div>
      </div>
    </div>
  );
}

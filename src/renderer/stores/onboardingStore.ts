import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  isCompleted: boolean;
  completedAt: Date | null;
  userData: {
    name: string;
    email: string;
    avatar?: string;
    provider?: 'google' | 'microsoft' | 'apple';
  } | null;
  calloutSettings: {
    name: string;
    aliases: string[];
    enableCallouts: boolean;
  } | null;

  completeOnboarding: () => void;
  setUserData: (data: NonNullable<OnboardingState['userData']>) => void;
  setCalloutSettings: (settings: NonNullable<OnboardingState['calloutSettings']>) => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      isCompleted: false,
      completedAt: null,
      userData: null,
      calloutSettings: null,

      completeOnboarding: () =>
        set({
          isCompleted: true,
          completedAt: new Date(),
        }),

      setUserData: (data) =>
        set({
          userData: data,
        }),

      setCalloutSettings: (settings) =>
        set({
          calloutSettings: settings,
        }),

      resetOnboarding: () =>
        set({
          isCompleted: false,
          completedAt: null,
          userData: null,
          calloutSettings: null,
        }),
    }),
    {
      name: 'kakarot-onboarding',
    }
  )
);

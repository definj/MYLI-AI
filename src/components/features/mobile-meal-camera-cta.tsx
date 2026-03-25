'use client';

import { Camera } from 'lucide-react';

export const OPEN_MEAL_CAMERA_EVENT = 'myli-open-meal-camera';

export function MobileMealCameraCta() {
  return (
    <button
      type="button"
      className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#FF6B35] to-[#FF9A5C] text-sm font-semibold text-white shadow-[0_0_20px_rgba(255,107,53,0.35)] md:hidden"
      onClick={() => {
        window.location.hash = 'meal-logging';
        window.dispatchEvent(new Event(OPEN_MEAL_CAMERA_EVENT));
      }}
    >
      <Camera size={18} />
      Log Meal via Camera
    </button>
  );
}

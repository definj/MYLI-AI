import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Display enum / snake_case profile fields: `improve_endurance` → "Improve Endurance", `pomodoro` → "Pomodoro". */
export function formatProfileLabel(value: string | null | undefined, fallback = ""): string {
  if (value == null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().replace(/_/g, " ");
  return normalized
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

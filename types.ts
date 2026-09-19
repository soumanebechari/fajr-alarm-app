export type SoundType = 'classic' | 'digital' | 'gentle' | 'energetic' | 'birds';

export type ChallengeType = 'none' | 'math' | 'tap';

export interface Alarm {
  id: string;
  time: string; // HH:MM (24-hour format)
  label: string;
  enabled: boolean;
  days: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday. Empty = one-time
  sound: SoundType;
  volume: number; // 0.1 to 1.0
  snoozeMinutes: number;
  challenge: ChallengeType;
  vibrate: boolean;
  createdAt: number;
  lastDismissedDate?: string; // YYYY-MM-DD to avoid double triggering today if one-time
}

export type TabType = 'alarms' | 'clock' | 'timer' | 'stopwatch' | 'relax';

export interface LapTime {
  id: number;
  timeMs: number;
  formatted: string;
}

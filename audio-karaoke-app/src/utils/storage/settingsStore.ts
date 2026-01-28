/**
 * settingsStore.ts
 * Manages persistent user preferences in localStorage
 */

export type LyricTheme = 'modern' | 'classic' | 'neon' | 'dark';

export interface UserSettings {
    theme: LyricTheme;
    autoStartKaraoke: boolean;
    defaultVolumeBalance: number; // 0.5 is equal, 0 is all instrumental, 1 is all vocals
    stageModeEnabled: boolean;
    showVisualizer: boolean;
}

const STORAGE_KEY = 'muzika_user_settings';

const DEFAULT_SETTINGS: UserSettings = {
    theme: 'modern',
    autoStartKaraoke: false,
    defaultVolumeBalance: 0.5,
    stageModeEnabled: false,
    showVisualizer: true
};

export function getSettings(): UserSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Failed to load settings', e);
    }
    return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<UserSettings>): void {
    if (typeof window === 'undefined') return;

    try {
        const current = getSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to save settings', e);
    }
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { settingsAPI } from '../services/backendService';

export interface ServerSettings {
    googleClientId: string;
    settingsLoaded: boolean;
}

const defaultSettings: ServerSettings = { googleClientId: '', settingsLoaded: false };

const ServerSettingsContext = createContext<ServerSettings>(defaultSettings);

const MAX_SETTING_RETRIES = 5;
const RETRY_DELAY_MS = 1000;

export const ServerSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<ServerSettings>(defaultSettings);
    const [fatalError, setFatalError] = useState(false);
    const mountedRef = useRef(true);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        mountedRef.current = true;

        const fetchSettings = (attempt: number) => {
            settingsAPI.getServerSettings()
                .then(data => {
                    if (!mountedRef.current) return;
                    setFatalError(false);
                    setSettings({
                        googleClientId: data.googleClientId || '',
                        settingsLoaded: true,
                    });
                })
                .catch(err => {
                    if (!mountedRef.current) return;
                    console.error('Failed to fetch server settings:', err);
                    if (attempt < MAX_SETTING_RETRIES) {
                        // Retry after a fixed 1-second delay.
                        retryTimerRef.current = setTimeout(() => fetchSettings(attempt + 1), RETRY_DELAY_MS);
                    } else {
                        // All retries exhausted — unblock the UI and show an error toast.
                        setSettings(prev => ({ ...prev, settingsLoaded: true }));
                        setFatalError(true);
                    }
                });
        };

        fetchSettings(0);

        return () => {
            mountedRef.current = false;
            if (retryTimerRef.current !== null) {
                clearTimeout(retryTimerRef.current);
            }
        };
    }, []);

    return (
        <ServerSettingsContext.Provider value={settings}>
            {children}
            {fatalError && (
                <div role="alert" aria-live="assertive" className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 bg-red-950 border border-red-500/40 text-red-300 px-6 py-4 rounded-2xl shadow-2xl max-w-lg w-[90vw] animate-slide-up">
                    <AlertTriangle size={20} className="shrink-0 text-red-400" />
                    <p className="text-sm font-semibold flex-grow">Unable to connect to the server</p>
                    <button data-testid="btn-dismiss-settings-error" data-analytics="dismiss_settings_error" aria-label="Dismiss error" onClick={() => setFatalError(false)} className="shrink-0 text-red-500 hover:text-red-300"><X size={18} /></button>
                </div>
            )}
        </ServerSettingsContext.Provider>
    );
};

export const useServerSettings = (): ServerSettings => useContext(ServerSettingsContext);

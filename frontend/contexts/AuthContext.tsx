import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {authAPI, clearTokens, getAccessToken, SESSION_EXPIRED_EVENT} from '../services/backendService';
import {User} from '../types';

interface AuthContextType {
    user: User | null;
    authLoading: boolean;
    setUser: (user: User | null) => void;
    refreshUser: () => Promise<void>;
    handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            if (getAccessToken()) {
                try {
                    const currentUser = await authAPI.getCurrentUser();
                    setUser(currentUser);
                } catch {
                    clearTokens();
                } finally {
                    setAuthLoading(false);
                }
            } else {
                setAuthLoading(false);
            }
        };
        checkAuth();
    }, []);

    const handleLogout = useCallback(() => {
        authAPI.logout();
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        const currentUser = await authAPI.getCurrentUser();
        setUser(currentUser);
    }, []);

    // When the backend signals that both tokens are expired, force the user back to login
    useEffect(() => {
        const onSessionExpired = () => handleLogout();
        window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    }, [handleLogout]);

    return (
        <AuthContext.Provider value={{user, authLoading, setUser, refreshUser, handleLogout}}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

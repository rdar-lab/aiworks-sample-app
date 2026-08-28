/// <reference types="vite/client" />
/**
 * Backend API service for aiWorks
 * Replaces direct Gemini API calls with backend API calls
 */

import {
    StepTask,
    SavedSession,
    User,
    KnowledgeBase,
    MCPServer,
    PredefinedMCPServer,
    MemoryEntry,
    Notification,
    NotificationsResponse,
    TunnelServerSummary
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const MAX_RETRIES = 5;
const RETRY_WAIT_MS = 10_000;

// Custom event dispatched when both access and refresh tokens are invalid, requiring re-login
export const SESSION_EXPIRED_EVENT = 'session-expired';

interface ApiError {
    error: string;
}

// Thrown by apiRequest on non-2xx responses; carries the parsed response body
// so callers can inspect domain-specific error fields (e.g. parse_errors).
export class ApiResponseError extends Error {
    constructor(message: string, public readonly body: unknown) {
        super(message);
        this.name = 'ApiResponseError';
    }
}

// Re-throws err with a human-readable message when it is an ApiResponseError
// caused by file parse failures. Pass-through for all other error types.
function detectFileUploadErrors(err: unknown): never {
    if (err instanceof ApiResponseError) {
        const parseErrors: Array<{ error?: string }> = Array.isArray((err.body as any)?.parse_errors)
            ? (err.body as any).parse_errors
            : [];
        if (parseErrors.some(e => (e.error ?? '').toLowerCase().includes('too large'))) {
            throw new Error('One or more files are too large.');
        }
        if (parseErrors.length > 0) throw new Error('File upload failed');
    }
    throw err;
}

// Token management (localStorage persists tokens across browser sessions for remember-me).
// Note: localStorage is accessible to JavaScript; ensure the application has a strict
// Content Security Policy to mitigate XSS risk.
let accessToken: string | null = localStorage.getItem('access_token');
let refreshToken: string | null = localStorage.getItem('refresh_token');

export const setTokens = (access: string, refresh: string) => {
    accessToken = access;
    refreshToken = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
};

export const clearTokens = () => {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
};

export const getAccessToken = () => accessToken;

// Shared promise to serialise concurrent token-refresh attempts.
// When multiple requests get a 401 simultaneously, only one refresh call is
// made; all other callers await the same promise so they never send the
// already-blacklisted refresh token (ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION).
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
    if (!refreshToken) return false;

    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({refresh: refreshToken}),
            });

            if (refreshResponse.ok) {
                const {access, refresh: newRefresh} = await refreshResponse.json();
                // When token rotation is disabled the backend omits the refresh field.
                // Preserve the existing refresh token so the session stays alive.
                setTokens(access, newRefresh ?? refreshToken!);
                return true;
            } else {
                clearTokens();
                window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
                return false;
            }
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// API request wrapper with authentication
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    returnRawResponse = false,
    retryCount = 0
): Promise<T> {
    // Don't set Content-Type for FormData — browser must set it with the multipart boundary.
    const isFormData = options.body instanceof FormData;
    const headers: HeadersInit = isFormData
        ? {}
        : { 'Content-Type': 'application/json' };
    Object.assign(headers, options.headers);

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const method = (options.method ?? 'GET').toUpperCase();
    const isReadOnly = method === 'GET' || method === 'HEAD';

    let response!: Response;

    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    // Network error likely; retry if read-only and within retry limit
    } catch (err) {
        // Not read-only or retry limit exceeded - throw error
        if (!isReadOnly || retryCount >= MAX_RETRIES) {
            throw err;
        }
        // Read-only requests and within retry count - we retry
        return await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS)).then(() =>
            apiRequest<T>(endpoint, options, returnRawResponse, retryCount + 1)
        );
    }

    // Rate limit issue and retryCount is within limit - wait and retry
    if (response.status === 429 && retryCount < MAX_RETRIES) {
        return await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS)).then(() =>
            apiRequest<T>(endpoint, options, returnRawResponse, retryCount + 1)
        );
    }

    // If unauthorized and we have a refresh token, try to refresh.
    // refreshAccessToken() serialises concurrent attempts so the same
    // refresh token is never sent twice in parallel.
    if (response.status === 401 && refreshToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            throw new Error('Session expired. Please login again.');
        }
        return await apiRequest<T>(endpoint, options, returnRawResponse); // Retry original request with new token
    }

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: 'Request failed' }) as any);
        throw new ApiResponseError((errBody as ApiError).error || 'Request failed', errBody);
    }

    if (returnRawResponse) {
        return response as unknown as T;
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json();
}

// Authentication API
export const authAPI = {
    login: async (username: string, password: string) => {
        let response: Response;
        try {
            response = await fetch(`${API_BASE_URL}/auth/login/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password}),
            });
        } catch {
            throw new Error('There was an issue communicating with the server, please try again.');
        }

        if (!response.ok) {
            if (response.status >= 500) {
                throw new Error('There was an issue communicating with the server, please try again.');
            }
            const error = await response.json().catch(() => ({error: 'Login failed. Please try again.'}));
            throw new Error((error as ApiError).error || 'Login failed. Please try again.');
        }

        const data = await response.json();
        setTokens(data.tokens.access, data.tokens.refresh);
        return data.user;
    },

    googleLogin: async (credential: string) => {
        let response: Response;
        try {
            response = await fetch(`${API_BASE_URL}/auth/google/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({credential}),
            });
        } catch {
            throw new Error('There was an issue communicating with the server, please try again.');
        }

        if (!response.ok) {
            if (response.status >= 500) {
                throw new Error('There was an issue communicating with the server, please try again.');
            }
            const error = await response.json().catch(() => ({error: 'Google login failed. Please try again.'}));
            throw new Error((error as ApiError).error || 'Google login failed. Please try again.');
        }

        const data = await response.json();
        setTokens(data.tokens.access, data.tokens.refresh);
        return data.user;
    },

    // Exchange an OAuth authorization code for our app's JWT tokens.
    // Called after Google has already redirected the browser back to /login?code=...
    // The Login component's useEffect detects the ?code= param and invokes this function.
    // The backend exchanges the code with Google, then returns our access/refresh tokens.
    googleLoginWithCode: async (code: string, redirectUri: string) => {
        let response: Response;
        try {
            response = await fetch(`${API_BASE_URL}/auth/google/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({code, redirect_uri: redirectUri}),
            });
        } catch {
            throw new Error('There was an issue communicating with the server, please try again.');
        }

        if (!response.ok) {
            if (response.status >= 500) {
                throw new Error('There was an issue communicating with the server, please try again.');
            }
            const error = await response.json().catch(() => ({error: 'Google login failed. Please try again.'}));
            throw new Error((error as ApiError).error || 'Google login failed. Please try again.');
        }

        const data = await response.json();
        setTokens(data.tokens.access, data.tokens.refresh);
        return data.user;
    },

    register: async (userData: any) => {
        const response = await fetch(`${API_BASE_URL}/auth/register/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({error: 'Registration failed'}));
            throw new Error((error as ApiError).error || 'Registration failed');
        }

        return response.json();
    },

    getCurrentUser: async (): Promise<User> => {
        return apiRequest<User>('/auth/me/');
    },

    updateProfile: async (profileContext: string, firstName?: string, lastName?: string): Promise<User> => {
        return apiRequest<User>('/auth/me/', {
            method: 'PATCH',
            body: JSON.stringify({
                profileContext,
                ...(firstName !== undefined && { first_name: firstName }),
                ...(lastName !== undefined && { last_name: lastName }),
            }),
        });
    },

    updateLightMode: async (lightMode: boolean): Promise<User> => {
        return apiRequest<User>('/auth/me/', {
            method: 'PATCH',
            body: JSON.stringify({lightMode}),
        });
    },

    verifyEmail: async (token: string): Promise<{ detail: string }> => {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token}),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({error: 'Verification failed'}));
            throw new Error((error as ApiError).error || 'Verification failed');
        }
        return response.json();
    },

    requestPasswordReset: async (email: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/auth/password-reset/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email}),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({error: 'Request failed'}));
            throw new Error((error as ApiError).error || 'Request failed');
        }
    },

    confirmPasswordReset: async (token: string, password: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token, password}),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({error: 'Password reset failed'}));
            throw new Error((error as ApiError).error || 'Password reset failed');
        }
    },

    logout: async () => {
        if (refreshToken) {
            try {
                await fetch(`${API_BASE_URL}/auth/logout/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(accessToken ? {'Authorization': `Bearer ${accessToken}`} : {}),
                    },
                    body: JSON.stringify({refresh: refreshToken}),
                });
            } catch {
                // Always clear tokens client-side even if server call fails
            }
        }
        clearTokens();
    },
};

// Session API
export const sessionAPI = {
    /**
     * Create a session.  When `files` or `attachedSessionIds` are supplied the
     * request is sent as multipart/form-data so everything is processed
     * atomically on the backend (session + files + attachments in one
     * transaction).  Otherwise a plain JSON body is used.
     */
    createSession: async (
        sessionData: any,
        files: File[] = [],
        attachedSessionIds: string[] = [],
    ): Promise<{ id: string }> => {
        if (files.length > 0 || attachedSessionIds.length > 0) {
            const formData = new FormData();
            // Encode all session fields (including attachedSessionIds) as a JSON blob
            // in the 'data' field so complex types (arrays, booleans) survive multipart
            // encoding and the backend reads everything from one consistent place.
            const multipartSessionData = attachedSessionIds.length > 0
                ? { ...sessionData, attachedSessionIds }
                : sessionData;
            formData.append('data', JSON.stringify(multipartSessionData));
            files.forEach(f => formData.append('files', f));
            try {
                return await apiRequest<{ id: string }>('/sessions/', {
                    method: 'POST',
                    body: formData,
                });
            } catch (err) {
                detectFileUploadErrors(err); // always throws (return type: never)
                throw err; // unreachable — satisfies TypeScript and makes intent explicit
            }
        }
        return apiRequest<{ id: string }>('/sessions/', {
            method: 'POST',
            body: JSON.stringify(sessionData),
        });
    },

    getSession: async (sessionId: string) => {
        return apiRequest(`/sessions/${sessionId}/`);
    },

    listSessions: async (cursor?: string): Promise<{ results: SavedSession[], next_cursor: string | null, has_more: boolean }> => {
        const params = new URLSearchParams();
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return apiRequest<{ results: SavedSession[], next_cursor: string | null, has_more: boolean }>(`/sessions/${query}`);
    },

    listFavorites: async (): Promise<{ results: SavedSession[], next_cursor: string | null, has_more: boolean }> => {
        return apiRequest<{ results: SavedSession[], next_cursor: string | null, has_more: boolean }>('/sessions/favorites/');
    },

    favoriteSession: async (sessionId: string): Promise<{ favorited: boolean, favoriteIds: string[] }> => {
        return apiRequest(`/sessions/${sessionId}/favorite/`, { method: 'POST' });
    },

    unfavoriteSession: async (sessionId: string): Promise<{ favorited: boolean, favoriteIds: string[] }> => {
        return apiRequest(`/sessions/${sessionId}/unfavorite/`, { method: 'POST' });
    },

    toggleFavorite: async (sessionId: string): Promise<{ favorited: boolean, favoriteIds: string[] }> => {
        return apiRequest(`/sessions/${sessionId}/favorite/`, { method: 'POST' });
    },

    updateSession: async (sessionId: string, sessionData: any) => {
        return apiRequest(`/sessions/${sessionId}/`, {
            method: 'PATCH',
            body: JSON.stringify(sessionData),
        });
    },

    deleteSession: async (sessionId: string) => {
        return apiRequest(`/sessions/${sessionId}/`, {
            method: 'DELETE',
        });
    },

    // Upload files to a session (multipart/form-data); backend parses content
    uploadFiles: async (sessionId: string, files: File[]) => {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        try {
            return await apiRequest(`/sessions/${sessionId}/upload_files/`, {
                method: 'POST',
                body: formData,
            });
        } catch (err) {
            detectFileUploadErrors(err);
        }
    },

    attachSession: async (sessionId: string, sessionToAttachId: string) => {
        return apiRequest(`/sessions/${sessionId}/attach_session/`, {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionToAttachId }),
        });
    },

    // Start or resume the task. Returns the current status immediately
    // (pending/running/completed/failed); the caller is responsible for polling
    // execute_status until the task finishes.
    execute: async (sessionId: string): Promise<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }> => {
        return apiRequest<any>(`/sessions/${sessionId}/execute/`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    getWorkerStatus: async (sessionId: string): Promise<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[]; thinking?: string; last_tool_call?: { tool: string; input: string } }> => {
        return apiRequest<any>(`/sessions/${sessionId}/worker_status/`);
    },

    // Mark a session as publicly shareable
    makePublic: async (sessionId: string): Promise<{ isPublic: boolean }> => {
        return apiRequest<{ isPublic: boolean }>(`/sessions/${sessionId}/make_public/`, {
            method: 'POST',
        });
    },

    // Mark a session as private (unshare)
    makePrivate: async (sessionId: string): Promise<{ isPublic: boolean }> => {
        return apiRequest<{ isPublic: boolean }>(`/sessions/${sessionId}/make_private/`, {
            method: 'POST',
        });
    },

    // Get a scoped JWT preview token for website iframe preview
    getPreviewToken: async (sessionId: string): Promise<{ previewToken: string }> => {
        return apiRequest<{ previewToken: string }>(`/sessions/${sessionId}/preview_token/`, {
            method: 'GET',
        });
    },

    // Reset session  data and re-run the session from scratch
    rerun: async (sessionId: string, additionalUserComments?: string): Promise<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }> => {
        return apiRequest<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }>(`/sessions/${sessionId}/rerun/`, {
            method: 'POST',
            body: JSON.stringify({ additionalUserComments: additionalUserComments ?? '' }),
        });
    },

    refineSession: async (
        sessionId: string,
        refinementNotes: string,
        files: File[] = [],
        attachedSessionIds: string[] = [],
        knowledgeBaseIds: number[] = [],
        mcpServerIds: number[] = [],
        desktopTunnelServers: Record<string, string[]> = {},
    ): Promise<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }> => {
        if (files.length > 0 || attachedSessionIds.length > 0 || knowledgeBaseIds.length > 0 || mcpServerIds.length > 0 || Object.keys(desktopTunnelServers).length > 0) {
            const formData = new FormData();
            formData.append('data', JSON.stringify({
                additionalUserComments: refinementNotes,
                attachedSessionIds,
                knowledgeBaseIds,
                mcpServerIds,
                desktopTunnelServers,
            }));
            files.forEach(f => formData.append('files', f));
            return apiRequest<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }>(`/sessions/${sessionId}/rerun/`, {
                method: 'POST',
                body: formData,
            });
        }
        return apiRequest<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }>(`/sessions/${sessionId}/rerun/`, {
            method: 'POST',
            body: JSON.stringify({ additionalUserComments: refinementNotes }),
        });
    },

    // Refine an existing completed research session with targeted revision notes (delegates to rerun endpoint)
    refineResearch: async (sessionId: string, refinementNotes: string): Promise<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }> => {
        return apiRequest<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }>(`/sessions/${sessionId}/rerun/`, {
            method: 'POST',
            body: JSON.stringify({ additionalUserComments: refinementNotes }),
        });
    },

    // Execute a marketing session to generate posts
    executeSession: async (sessionId: string): Promise<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }> => {
        return apiRequest<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[] }>(`/sessions/${sessionId}/execute/`, {
            method: 'POST',
        });
    },

    downloadOutputFiles: async (sessionId: string): Promise<void> => {
        const response = await apiRequest<Response>(
            `/sessions/${sessionId}/download_output_files/`,
            {},
            true
        );

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch ? filenameMatch[1] : 'research-files.zip';

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    exportReport: async (sessionId: string, format: 'pdf' | 'docx'): Promise<void> => {
        const response = await apiRequest<Response>(
            `/sessions/${sessionId}/export_report/?export_format=${format}`,
            {},
            true
        );

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const defaultFilename = format === 'pdf' ? 'research-report.pdf' : 'research-report.docx';
        const filename = filenameMatch ? filenameMatch[1] : defaultFilename;

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    // List all snapshots for a session
    listSnapshots: async (sessionId: string): Promise<import('../types').SessionSnapshot[]> => {
        return apiRequest<import('../types').SessionSnapshot[]>(`/sessions/${sessionId}/snapshots/`);
    },

    // Restore a session to the state of a specific snapshot
    restoreSnapshot: async (sessionId: string, snapshotId: string): Promise<any> => {
        return apiRequest<any>(`/sessions/${sessionId}/snapshots/${snapshotId}/restore/`, {
            method: 'POST',
        });
    },
};

export const knowledgeBaseAPI = {
    list: async (): Promise<KnowledgeBase[]> => {
        return apiRequest<KnowledgeBase[]>('/knowledge-bases/');
    },

    get: async (kbId: number): Promise<KnowledgeBase> => {
        return apiRequest<KnowledgeBase>(`/knowledge-bases/${kbId}/`);
    },

    create: async (name: string): Promise<KnowledgeBase> => {
        return apiRequest<KnowledgeBase>('/knowledge-bases/', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    },

    update: async (kbId: number, name: string): Promise<KnowledgeBase> => {
        return apiRequest<KnowledgeBase>(`/knowledge-bases/${kbId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
        });
    },

    delete: async (kbId: number): Promise<void> => {
        await apiRequest(`/knowledge-bases/${kbId}/`, { method: 'DELETE' });
    },

    uploadFiles: async (kbId: number, files: File[]): Promise<{ files: { id: number; name: string; created_at?: string }[], parse_errors: {name: string, error: string}[] }> => {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        try {
            return await apiRequest(`/knowledge-bases/${kbId}/upload_files/`, {
                method: 'POST',
                body: formData,
            });
        } catch (err) {
            detectFileUploadErrors(err);
        }
    },

    removeFile: async (kbId: number, fileId: number): Promise<void> => {
        await apiRequest(`/knowledge-bases/${kbId}/files/${fileId}/`, { method: 'DELETE' });
    },
};

export interface MCPServerCreateData {
    name?: string;
    url?: string;
    headers?: Record<string, string>;
    auth_type?: 'none' | 'basic' | 'bearer' | 'oauth';
    username?: string;
    password?: string;
    token?: string;
    refresh_token?: string;
    oauth_metadata?: Record<string, unknown>;
    predefined_server_id?: number;
    server_type?: 'http' | 'openapi';
    openapi_spec_url?: string;
    openapi_spec?: string;
}

export interface MCPServerUpdateData {
    name?: string;
    url?: string;
    headers?: Record<string, string>;
    auth_type?: 'none' | 'basic' | 'bearer' | 'oauth';
    username?: string;
    password?: string;
    token?: string;
    refresh_token?: string;
    oauth_metadata?: Record<string, unknown>;
    server_type?: 'http' | 'openapi';
    openapi_spec_url?: string;
    openapi_spec?: string;
}

export const mcpServerAPI = {
    list: async (): Promise<MCPServer[]> => {
        return apiRequest<MCPServer[]>('/mcp-servers/');
    },

    create: async (data: MCPServerCreateData): Promise<MCPServer> => {
        return apiRequest<MCPServer>('/mcp-servers/', {
            method: 'POST',
            body: JSON.stringify({
                headers: {},
                auth_type: 'none',
                ...data,
            }),
        });
    },

    update: async (id: number, data: MCPServerUpdateData): Promise<MCPServer> => {
        return apiRequest<MCPServer>(`/mcp-servers/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: number): Promise<void> => {
        await apiRequest(`/mcp-servers/${id}/`, { method: 'DELETE' });
    },

    discoverOAuth: async (url: string, redirectUri: string, predefinedServerId?: number): Promise<{
        requires_oauth: boolean;
        authorization_endpoint?: string;
        token_endpoint?: string;
        client_id?: string;
        scope?: string;
        custom_auth_params?: Record<string, string>;
    }> => {
        return apiRequest('/mcp-servers/discover-oauth/', {
            method: 'POST',
            body: JSON.stringify({
                url,
                redirect_uri: redirectUri,
                ...(predefinedServerId !== undefined ? { predefined_server_id: predefinedServerId } : {}),
            }),
        });
    },

    exchangeOAuth: async (params: {
        token_endpoint: string;
        code: string;
        code_verifier: string;
        redirect_uri: string;
        client_id: string;
        client_secret?: string;
        predefined_server_id?: number;
        oauth_metadata?: Record<string, unknown>;
    }): Promise<{
        access_token: string;
        token_type: string;
        expires_in?: number;
        refresh_token?: string;
        oauth_metadata?: Record<string, unknown>;
    }> => {
        return apiRequest('/mcp-servers/oauth-exchange/', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    },
};

export const predefinedMCPServerAPI = {
    list: async (): Promise<PredefinedMCPServer[]> => {
        return apiRequest<PredefinedMCPServer[]>('/predefined-mcp-servers/');
    },
};

export const tunnelServersAPI = {
    get: async (tunnelId: string): Promise<TunnelServerSummary[]> => {
        return apiRequest<{ servers: TunnelServerSummary[] }>(`/mcp-tunnel/${tunnelId}/servers/`).then(r => r.servers);
    },
};

export interface TunnelInfo {
    tunnel_id: string;
    is_connected: boolean;
    created_at: string | null;
    servers?: { id: string; name: string }[];
}

export const tunnelAPI = {
    list: async (): Promise<TunnelInfo[]> => {
        return apiRequest<{ tunnels: TunnelInfo[] }>(`/mcp-tunnel/`).then(r => r.tunnels);
    },
};

export const settingsAPI = {
    getServerSettings: async (): Promise<{ googleClientId: string; }> => {
        return apiRequest('/server-settings/');
    },
};

export interface HelpChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export const helpChat = async (messages: HelpChatMessage[], manualContent?: string): Promise<string> => {
    const data = await apiRequest<{ reply: string }>('/help-chat/', {
        method: 'POST',
        body: JSON.stringify({ messages, manual_content: manualContent ?? '' }),
    });
    return data.reply;
};

export const memoryAPI = {
    list: async (): Promise<MemoryEntry[]> => {
        return apiRequest<MemoryEntry[]>('/memory/');
    },

    delete: async (id: number): Promise<void> => {
        await apiRequest<void>(`/memory/${id}/`, { method: 'DELETE' });
    },

    import: async (text: string): Promise<{ count: number }> => {
        return apiRequest<{ count: number }>('/memory/import/', {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
    },
};

export const notificationsAPI = {
    list: async (params?: {
        limit?: number;
        offset?: number;
    }): Promise<NotificationsResponse> => {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.set('limit', String(params.limit));
        if (params?.offset) queryParams.set('offset', String(params.offset));
        const query = queryParams.toString();
        const response = await apiRequest<{ data: Notification[]; meta: { unread_count: number; total: number; limit: number; offset: number; has_more: boolean } }>(`/notifications/${query ? `?${query}` : ''}`);
        return {
            data: response.data,
            meta: {
                ...response.meta,
                unreadCount: response.meta.unread_count,
                hasMore: response.meta.has_more,
            },
        };
    },

    updateStatus: async (notificationId: string, status: 'read' | 'dismissed'): Promise<Notification> => {
        const data = await apiRequest<{ data: Notification }>(`/notifications/`, {
            method: 'PUT',
            body: JSON.stringify({ notification_id: notificationId, status }),
        });
        return data.data;
    },
};

export interface SessionAttachmentResponse {
    content: string;
    mimeType: string;
}

export const sessionAttachmentAPI = {
    get: async (sessionId: string, attachmentPath: string): Promise<SessionAttachmentResponse> => {
        const response = await apiRequest<Response>(`/sessions/${sessionId}/session_attachment/${attachmentPath}`, {}, true);
        const content = await response.text();
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        return { content, mimeType: contentType };
    },
    getBlob: async (sessionId: string, attachmentPath: string): Promise<Blob> => {
        const response = await apiRequest<Response>(`/sessions/${sessionId}/session_attachment/${attachmentPath}`, {}, true);
        return response.blob();
    },
};

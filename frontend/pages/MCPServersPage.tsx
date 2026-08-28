import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Edit2, KeyRound, Plus, Server, Trash2, X } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { mcpServerAPI, predefinedMCPServerAPI } from '../services/backendService';
import { MCPServer, PredefinedMCPServer } from '../types';
import { useProFeature } from '../hooks/useProFeature';
import ProLockBadge from '../components/ProLockBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { OAUTH_STORAGE_KEY, OAUTH_STORAGE_KEY_LOCAL } from './MCPOAuthCallbackPage';

// ---------------------------------------------------------------------------
// Auth type definitions
// ---------------------------------------------------------------------------

type AuthType = 'none' | 'basic' | 'bearer' | 'oauth';
type ServerType = 'http' | 'openapi';

const SERVER_TYPE_LABELS: Record<ServerType, string> = {
  http: 'HTTP MCP Server',
  openapi: 'OpenAPI Server',
};

const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  none: 'No Auth',
  basic: 'Basic Auth',
  bearer: 'Bearer Token',
  oauth: 'OAuth',
};

// ---------------------------------------------------------------------------
// PKCE helpers (RFC 7636)
// ---------------------------------------------------------------------------

async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(96);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function randomState(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const oauthRedirectUri = (): string =>
  `${window.location.origin}/app/mcp-oauth-callback`;

// ---------------------------------------------------------------------------
// Form state type
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  url: string;
  serverType: ServerType;
  authType: AuthType;
  username: string;
  password: string;
  token: string;
  refreshToken: string;
  oauthMetadata?: Record<string, unknown>;
  headersJson: string;
  openapiSpecUrl: string;
  openapiSpec: string;
  predefinedServerId?: number;
}

const emptyForm = (): FormState => ({
  name: '', url: '', serverType: 'http', authType: 'none',
  username: '', password: '', token: '', refreshToken: '', headersJson: '',
  openapiSpecUrl: '', openapiSpec: '',
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MCPServersPage: React.FC = () => {
  const { lightMode } = useUI();
  const { isPro } = useProFeature('mcp_server');
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [predefinedServers, setPredefinedServers] = useState<PredefinedMCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const oauthConfigFileRef = useRef<HTMLInputElement>(null);
  // When set, we're adding a predefined server (the pill was clicked).
  const [addingPredefined, setAddingPredefined] = useState<PredefinedMCPServer | null>(null);
  const [addingPredefinedCreds, setAddingPredefinedCreds] = useState<{
    token: string; username: string; password: string; refreshToken: string;
    oauthMetadata?: Record<string, unknown>;
  }>({ token: '', username: '', password: '', refreshToken: '' });
    const pendingOauthRef = useRef<{
    codeVerifier: string; state: string; tokenEndpoint: string; clientId: string;
    resolve: (result: { refreshToken: string; oauthMetadata?: Record<string, unknown> }) => void; reject: (msg: string) => void;
  } | null>(null);

  // Edit state: serverId -> FormState + has_credentials
  const [editing, setEditing] = useState<Record<number, FormState & { has_credentials: boolean }>>({});
  const [deleteServerId, setDeleteServerId] = useState<number | null>(null);

  const card = lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800';
  const text = lightMode ? 'text-slate-800' : 'text-slate-200';
  const subText = lightMode ? 'text-slate-500' : 'text-slate-400';
  const inputCls = lightMode
    ? 'bg-slate-50 border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-400'
    : 'bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-blue-500';

  useEffect(() => { loadServers(); loadPredefinedServers(); }, []);

  async function loadServers() {
    try {
      setLoading(true);
      setServers(await mcpServerAPI.list());
    } catch (e: any) {
      setError(e.message || 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  }

  async function loadPredefinedServers() {
    try {
      setPredefinedServers(await predefinedMCPServerAPI.list());
    } catch {
      // Non-fatal — predefined servers are optional
    }
  }

  function validateUrl(url: string) { return url.startsWith('http://') || url.startsWith('https://'); }

  function parseHeaders(json: string): Record<string, string> | null {
    if (!json.trim()) return {};
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Record<string, string>;
    } catch { return null; }
  }

  // ------------------------------------------------------------------
  // OAuth PKCE flow — returns a Promise<refreshToken>
  // ------------------------------------------------------------------
  async function runOAuthFlow(serverUrl: string, predefinedServerId?: number, oauthMetadata?: Record<string, unknown>): Promise<{ refreshToken: string; oauthMetadata?: Record<string, unknown> }> {
    if (!serverUrl || !validateUrl(serverUrl)) throw new Error('Enter a valid MCP server URL first.');
    const redirectUri = oauthRedirectUri();

    let authorization_endpoint: string;
    let token_endpoint: string;
    let client_id: string;
    let scope: string;
    let custom_auth_params: Record<string, string> | undefined;
    let client_secret: string | undefined;

    // If oauthMetadata has authorization_endpoint and token_endpoint, skip discovery
    if (!predefinedServerId && oauthMetadata && (oauthMetadata as Record<string, unknown>).authorization_endpoint && (oauthMetadata as Record<string, unknown>).token_endpoint) {
      authorization_endpoint = (oauthMetadata as Record<string, unknown>).authorization_endpoint as string;
      token_endpoint = (oauthMetadata as Record<string, unknown>).token_endpoint as string;
      client_id = (oauthMetadata as Record<string, unknown>).client_id as string || 'aiworks-sample-app';
      scope = (oauthMetadata as Record<string, unknown>).scope as string || '';
      custom_auth_params = (oauthMetadata as Record<string, unknown>).custom_auth_params as Record<string, string> | undefined;
      client_secret = (oauthMetadata as Record<string, unknown>).client_secret as string | undefined;
    } else {
      const oauthInfo = await mcpServerAPI.discoverOAuth(serverUrl, redirectUri, predefinedServerId);
      if (!oauthInfo.requires_oauth) throw new Error('This MCP server does not require OAuth authentication.');
      authorization_endpoint = oauthInfo.authorization_endpoint!;
      token_endpoint = oauthInfo.token_endpoint!;
      client_id = oauthInfo.client_id!;
      scope = oauthInfo.scope || '';
      custom_auth_params = oauthInfo.custom_auth_params;
    }

    if (!authorization_endpoint || !token_endpoint || !client_id) throw new Error('OAuth discovery did not return required endpoint information.');

    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = randomState();

    return new Promise<{ refreshToken: string; oauthMetadata?: Record<string, unknown> }>((resolve, reject) => {
      localStorage.removeItem(OAUTH_STORAGE_KEY_LOCAL);
      sessionStorage.removeItem(OAUTH_STORAGE_KEY);
      pendingOauthRef.current = {
        codeVerifier, state, tokenEndpoint: token_endpoint, clientId: client_id,
        resolve, reject,
      };
      const authParams = new URLSearchParams({
        response_type: 'code', client_id, redirect_uri: redirectUri,
        code_challenge: codeChallenge, code_challenge_method: 'S256', state,
        ...(scope ? { scope } : {}),
        ...(custom_auth_params || {}),
      });
      const popup = window.open(`${authorization_endpoint}?${authParams}`, 'mcp-oauth', 'width=600,height=700,left=200,top=100');
      if (!popup) {
        pendingOauthRef.current = null;
        reject('Popup was blocked. Please allow popups for this site and try again.');
        return;
      }

      let resolved = false;
      const cleanup = () => { pendingOauthRef.current = null; clearInterval(pollInterval); clearTimeout(timeoutId); };

      const handler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data?.mcpOAuthCallback || resolved) return;
        const { code, error, errorDescription } = event.data;
        resolved = true;
        cleanup();
        window.removeEventListener('message', handler);
        if (error) { reject(`OAuth authorization failed: ${errorDescription || error}`); return; }
        if (!code) { reject('OAuth authorization did not return a code.'); return; }
        mcpServerAPI.exchangeOAuth({ token_endpoint, code, code_verifier: codeVerifier, redirect_uri: redirectUri, client_id, client_secret, predefined_server_id: predefinedServerId, oauth_metadata: oauthMetadata })
          .then(tokenData => {
            if (!tokenData.refresh_token) { reject('OAuth server did not return a refresh token. Use "Bearer Token" mode instead.'); return; }
            resolve({ refreshToken: tokenData.refresh_token, oauthMetadata: tokenData.oauth_metadata });
          }).catch(e => reject(e.message || 'Token exchange failed.'));
      };
      window.addEventListener('message', handler);

      const pollInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
          window.removeEventListener('message', handler);
          if (resolved) return;
          const stored = localStorage.getItem(OAUTH_STORAGE_KEY_LOCAL);
          if (!stored) { cleanup(); reject('OAuth authorization was cancelled by closing the popup.'); return; }
          localStorage.removeItem(OAUTH_STORAGE_KEY_LOCAL);
          let data: { code?: string; state?: string; error?: string; errorDescription?: string };
          try { data = JSON.parse(stored); } catch { cleanup(); reject('OAuth callback returned invalid data.'); return; }
          if (data.state !== state) { cleanup(); reject('OAuth state mismatch — possible CSRF attack.'); return; }
          if (data.error) { cleanup(); reject(`OAuth authorization failed: ${data.errorDescription || data.error}`); return; }
          if (!data.code) { cleanup(); reject('OAuth authorization did not return a code.'); return; }
          mcpServerAPI.exchangeOAuth({ token_endpoint, code: data.code, code_verifier: codeVerifier, redirect_uri: redirectUri, client_id, predefined_server_id: predefinedServerId })
            .then(tokenData => {
              if (!tokenData.refresh_token) { reject('OAuth server did not return a refresh token. Use "Bearer Token" mode instead.'); return; }
              resolve({ refreshToken: tokenData.refresh_token, oauthMetadata: tokenData.oauth_metadata });
            }).catch(e => reject(e.message || 'Token exchange failed.'));
        }
      }, 200);

      const timeoutId = setTimeout(() => {
        if (!popup.closed) popup.close();
        clearInterval(pollInterval);
        window.removeEventListener('message', handler);
        cleanup();
        reject('OAuth authorization timed out after 5 minutes.');
      }, 5 * 60 * 1000);
    });
  }

  async function handleOAuthClick(serverUrl: string, onSuccess: (result: { refreshToken: string; oauthMetadata?: Record<string, unknown> }) => void, predefinedServerId?: number, oauthMetadata?: Record<string, unknown>) {
    setError(null);
    setOauthLoading(true);
    try {
      const result = await runOAuthFlow(serverUrl, predefinedServerId, oauthMetadata);
      onSuccess(result);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : (e.message || 'OAuth flow failed.'));
    } finally {
      setOauthLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // Auth fields sub-component (rendered inline)
  // ------------------------------------------------------------------
  function renderAuthFields(
    authType: AuthType,
    setAuthType: (v: AuthType) => void,
    username: string, setUsername: (v: string) => void,
    password: string, setPassword: (v: string) => void,
    token: string, setToken: (v: string) => void,
    refreshToken: string,
    serverUrl: string,
    onOAuthSuccess: (result: { refreshToken: string; oauthMetadata?: Record<string, unknown> }) => void,
    hasCredentials: boolean,
    credentialsDisabled: boolean,
    lockAuthType: boolean,
    predefinedServerId?: number,
    oauthMetadata?: Record<string, unknown>,
    setOAuthMetadata?: (v: Record<string, unknown> | undefined) => void,
    oauthConfigFileRef?: React.RefObject<HTMLInputElement | null>,
    handleOAuthConfigUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void,
  ) {
    const isAuthenticated = authType === 'oauth' && (refreshToken !== '' || hasCredentials);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className={`text-xs font-semibold shrink-0 ${subText}`}>Authentication:</label>
          {lockAuthType ? (
            <span className={`border rounded-xl px-3 py-1.5 text-sm font-semibold ${inputCls} text-slate-500`}>
              {AUTH_TYPE_LABELS[authType]}
            </span>
          ) : (
            <select
              value={authType}
              onChange={e => setAuthType(e.target.value as AuthType)}
              data-testid="select-auth-type"
              className={`border rounded-xl px-3 py-1.5 text-sm font-semibold outline-none transition-colors flex-1 ${inputCls}`}
            >
              {(Object.keys(AUTH_TYPE_LABELS) as AuthType[]).map(k => (
                <option key={k} value={k}>{AUTH_TYPE_LABELS[k]}</option>
              ))}
            </select>
          )}
        </div>
        {authType === 'basic' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder={hasCredentials ? '••••••' : 'Username'} disabled={credentialsDisabled}
              data-testid="input-auth-username"
              className={`sm:flex-1 border rounded-xl px-3 py-1.5 text-sm font-semibold outline-none transition-colors ${inputCls}`} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={hasCredentials ? '••••••' : 'Password'} disabled={credentialsDisabled}
              data-testid="input-auth-password"
              className={`sm:flex-1 border rounded-xl px-3 py-1.5 text-sm font-semibold outline-none transition-colors ${inputCls}`} />
          </div>
        )}
        {authType === 'bearer' && (
          <input type="password" value={token} onChange={e => setToken(e.target.value)}
            placeholder={hasCredentials ? '••••••' : 'Bearer token'} disabled={credentialsDisabled}
            data-testid="input-auth-token"
            className={`border rounded-xl px-3 py-1.5 text-sm font-semibold outline-none transition-colors ${inputCls}`} />
        )}
        {authType === 'oauth' && (
          <div className="flex flex-col gap-2">
            {/* Upload config — before auth, new servers only */}
            {oauthConfigFileRef && handleOAuthConfigUpload && (
              <div className="flex items-center gap-3">
                <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition-colors ${inputCls}`}>
                  <input type="file" accept=".json" ref={oauthConfigFileRef}
                    onChange={handleOAuthConfigUpload}
                    className="hidden" data-testid="upload-oauth-config-btn" />
                  <Plus size={14} /> Upload OAuth Config JSON
                </label>
                {oauthMetadata && Object.keys(oauthMetadata).length > 0 && (
                  <button type="button" data-testid="btn-clear-oauth-config"
                    data-analytics="clear_oauth_config"
                    onClick={() => setOAuthMetadata?.(undefined)}
                    className="px-3 py-1.5 rounded-xl border text-xs font-bold hover:bg-slate-100 transition-colors">
                    Clear
                  </button>
                )}
              </div>
            )}
            {!predefinedServerId && oauthMetadata && Object.keys(oauthMetadata).length > 0 && (
              <div className="text-xs text-green-400 font-semibold">
                OAuth config loaded: {Object.keys(oauthMetadata).join(', ')}
              </div>
            )}
            {/* Authenticate button */}
            <div className="flex items-center gap-2">
              <button data-testid="btn-oauth-authenticate" data-analytics="oauth_authenticate_mcp"
                type="button" disabled={credentialsDisabled || oauthLoading || !serverUrl.trim()}
                onClick={() => handleOAuthClick(serverUrl, onOAuthSuccess, predefinedServerId, oauthMetadata)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors">
                <KeyRound size={14} />
                {oauthLoading ? 'Authenticating…' : (isAuthenticated ? 'Re-authenticate' : 'Authenticate')}
              </button>
              {isAuthenticated && (
                <span className="flex items-center gap-1.5 text-green-400 text-xs font-semibold">
                  <CheckCircle2 size={14} /> Authenticated
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  function handleOAuthConfigUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result as string);
        const validKeys = ['client_id', 'client_secret', 'authorization_endpoint', 'token_endpoint', 'scope', 'custom_auth_params'];
        const filtered = Object.fromEntries(
          Object.entries(parsed).filter(([k]) => validKeys.includes(k))
        );
        setForm(p => ({ ...p, oauthMetadata: filtered as Record<string, unknown> }));
      } catch {
        alert('Invalid OAuth config JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim(); const url = form.url.trim();
    if (!name || !url) return;
    if (!validateUrl(url)) { setError('URL must start with http:// or https://'); return; }
    if (form.authType === 'oauth' && !form.refreshToken) { setError('Click "Authenticate" to complete the OAuth flow before registering.'); return; }
    const headers = parseHeaders(form.headersJson);
    if (headers === null) { setError('Additional headers must be valid JSON object (e.g. {"X-Custom": "value"})'); return; }
    if (form.serverType === 'openapi' && !form.openapiSpecUrl && !form.openapiSpec) {
      setError('OpenAPI Server requires either an OpenAPI Spec URL or an uploaded spec file.'); return;
    }
    try {
      setCreating(true);
      await mcpServerAPI.create({
        name, url, headers, auth_type: form.authType,
        server_type: form.serverType,
        openapi_spec_url: form.openapiSpecUrl,
        openapi_spec: form.openapiSpec,
        ...(form.authType === 'basic' ? { username: form.username, password: form.password } : {}),
        ...(form.authType === 'bearer' ? { token: form.token } : {}),
        ...(form.authType === 'oauth' ? { refresh_token: form.refreshToken, oauth_metadata: form.oauthMetadata } : {}),
      });
      setForm(emptyForm());
      await loadServers();
    } catch (e: any) {
      setError(e.message || 'Failed to create MCP server');
    } finally {
      setCreating(false);
    }
  }

  // ------------------------------------------------------------------
  // Add from predefined
  // ------------------------------------------------------------------
  function handlePredefinedPillClick(predefined: PredefinedMCPServer) {
    // Check if user already added this predefined server
    if (servers.some(s => s.predefined_server_id === predefined.id)) return;
    setAddingPredefined(predefined);
    setAddingPredefinedCreds({ token: '', username: '', password: '', refreshToken: '' });
  }

  async function handleCreateFromPredefined(e: React.FormEvent) {
    e.preventDefault();
    if (!addingPredefined) return;
    const { id, auth_type } = addingPredefined;
    const { token, username, password, refreshToken, oauthMetadata } = addingPredefinedCreds;
    if (auth_type === 'oauth' && !refreshToken) {
      setError('Click "Authenticate" to complete the OAuth flow before registering.'); return;
    }
    try {
      setCreating(true);
      await mcpServerAPI.create({
        predefined_server_id: id,
        ...(auth_type === 'basic' ? { username, password } : {}),
        ...(auth_type === 'bearer' ? { token } : {}),
        ...(auth_type === 'oauth' ? { refresh_token: refreshToken, oauth_metadata: oauthMetadata } : {}),
      });
      setAddingPredefined(null);
      await loadServers();
    } catch (e: any) {
      setError(e.message || 'Failed to add MCP server');
    } finally {
      setCreating(false);
    }
  }

  // ------------------------------------------------------------------
  // Edit
  // ------------------------------------------------------------------
  function startEdit(server: MCPServer) {
    setEditing(prev => ({ ...prev, [server.id]: {
      name: server.name, url: server.url,
      serverType: server.server_type || 'http',
      authType: server.auth_type,
      username: '', password: '', token: '', refreshToken: '',
      has_credentials: server.has_credentials,
      headersJson: Object.keys(server.headers || {}).length > 0 ? JSON.stringify(server.headers, null, 2) : '',
      openapiSpecUrl: server.openapi_spec_url || '',
      openapiSpec: server.openapi_spec || '',
      oauthMetadata: server.oauth_metadata || {},
      predefinedServerId: server.predefined_server_id
    }}));
  }

  function cancelEdit(id: number) { setEditing(prev => { const n = { ...prev }; delete n[id]; return n; }); }

  function updateEdit(id: number, patch: Partial<FormState & { has_credentials: boolean }>) {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSaveEdit(server: MCPServer) {
    const draft = editing[server.id];
    if (!draft) return;
    const isBuiltIn = server.predefined_server_id !== null;

    if (!isBuiltIn) {
      // For manually created servers, validate name/url/headers as before.
      const name = draft.name.trim(); const url = draft.url.trim();
      if (!name || !url) { cancelEdit(server.id); return; }
      if (!validateUrl(url)) { setError('URL must start with http:// or https://'); return; }
      if (draft.authType === 'oauth' && !draft.refreshToken && !draft.has_credentials) {
        setError('Click "Authenticate" to complete the OAuth flow before saving.'); return;
      }
      const headers = parseHeaders(draft.headersJson);
      if (headers === null) { setError('Additional headers must be valid JSON object'); return; }
      try {
        await mcpServerAPI.update(server.id, {
          name, url, headers, auth_type: draft.authType,
          ...(draft.authType === 'basic' && draft.username ? { username: draft.username } : {}),
          ...(draft.authType === 'basic' && draft.password ? { password: draft.password } : {}),
          ...(draft.authType === 'bearer' && draft.token ? { token: draft.token } : {}),
          ...(draft.authType === 'oauth' && draft.refreshToken ? { refresh_token: draft.refreshToken, oauth_metadata: draft.oauthMetadata } : {}),
        });
      } catch (e: any) {
        setError(e.message || 'Failed to update MCP server');
        return;
      }
    } else {
      // For predefined-derived servers, only credentials can change.
      const auth_type = server.auth_type;
      if (auth_type === 'oauth' && !draft.refreshToken && !draft.has_credentials) {
        setError('Click "Authenticate" to complete the OAuth flow before saving.'); return;
      }
      try {
        await mcpServerAPI.update(server.id, {
          ...(auth_type === 'basic' && draft.username ? { username: draft.username } : {}),
          ...(auth_type === 'basic' && draft.password ? { password: draft.password } : {}),
          ...(auth_type === 'bearer' && draft.token ? { token: draft.token } : {}),
          ...(auth_type === 'oauth' && draft.refreshToken ? { refresh_token: draft.refreshToken, oauth_metadata: draft.oauthMetadata } : {}),
        });
      } catch (e: any) {
        setError(e.message || 'Failed to update MCP server');
        return;
      }
    }
    await loadServers();
    cancelEdit(server.id);
  }

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  function handleDelete(id: number) { setDeleteServerId(id); }

  async function confirmDelete() {
    if (deleteServerId === null) return;
    const id = deleteServerId;
    setDeleteServerId(null);
    try {
      await mcpServerAPI.delete(id);
      await loadServers();
    } catch (e: any) {
      setError(e.message || 'Failed to delete MCP server');
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="w-full max-w-3xl py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Server size={28} className="text-purple-500 shrink-0" />
        <div>
          <h1 className={`text-2xl font-bold ${text}`}>MCP Servers</h1>
          <p className={`text-sm ${subText}`}>Connect external tool providers to your sessions via MCP</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-950 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
          <span className="flex-grow">{error}</span>
          <button data-testid="btn-dismiss-error" data-analytics="dismiss_error" onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {/* Predefined server pills */}
      {predefinedServers.length > 0 && (
        <div className={`border rounded-2xl p-5 flex flex-col gap-3 ${card}`}>
          <div className="flex items-center gap-2">
            <p className={`text-xs font-bold uppercase tracking-widest ${subText}`}>Quick-add built-in servers</p>
            {!isPro && <ProLockBadge className="pointer-events-auto" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {predefinedServers.map(predefined => {
              const alreadyAdded = servers.some(s => s.predefined_server_id === predefined.id);
              return (
                <button
                  key={predefined.id}
                  data-testid="btn-add-predefined-mcp-server"
                  data-analytics="add_predefined_mcp_server"
                  data-predefined-id={predefined.id}
                  disabled={!isPro || alreadyAdded}
                  onClick={() => handlePredefinedPillClick(predefined)}
                  title={alreadyAdded ? 'Already added' : `Add ${predefined.name}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors
                    ${alreadyAdded
                      ? lightMode ? 'bg-green-50 border-green-200 text-green-700 cursor-default' : 'bg-green-950/30 border-green-800/50 text-green-400 cursor-default'
                      : !isPro
                        ? 'opacity-50 cursor-not-allowed border-slate-300 text-slate-500'
                        : lightMode ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' : 'bg-purple-950/30 border-purple-800/50 text-purple-400 hover:bg-purple-900/40'
                    }`}
                >
                  {alreadyAdded ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                  {predefined.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add-from-predefined credentials form */}
      {addingPredefined && (
        <div className={!isPro ? 'opacity-60 pointer-events-none' : undefined}>
          <form onSubmit={handleCreateFromPredefined} className={`border border-purple-500/30 rounded-2xl p-5 flex flex-col gap-3 ${card}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs font-bold uppercase tracking-widest ${subText}`}>
                Add <span className="text-purple-400">{addingPredefined.name}</span>
              </p>
              <button type="button" data-testid="btn-cancel-add-predefined-mcp" data-analytics="cancel_add_predefined_mcp"
                onClick={() => setAddingPredefined(null)}
                className={`p-1.5 rounded-lg transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-slate-800 text-slate-500'}`}>
                <X size={16} />
              </button>
            </div>
            <div className={`flex items-center gap-2 text-xs ${subText}`}>
              <span className="font-medium">URL:</span>
              <span className="truncate">{addingPredefined.url}</span>
            </div>
            {addingPredefined.auth_type !== 'none' && (
              <p className={`text-xs ${subText}`}>
                Enter your credentials for <span className="font-semibold">{AUTH_TYPE_LABELS[addingPredefined.auth_type]}</span>:
              </p>
            )}
            {renderAuthFields(
              addingPredefined.auth_type, () => { /* locked */ },
              addingPredefinedCreds.username, v => setAddingPredefinedCreds(p => ({ ...p, username: v })),
              addingPredefinedCreds.password, v => setAddingPredefinedCreds(p => ({ ...p, password: v })),
              addingPredefinedCreds.token, v => setAddingPredefinedCreds(p => ({ ...p, token: v })),
              addingPredefinedCreds.refreshToken,
              addingPredefined.url,
              result => setAddingPredefinedCreds(p => ({ ...p, refreshToken: result.refreshToken, oauthMetadata: {...(p.oauthMetadata || {}), ...(result.oauthMetadata || {})} })),
              false,
              false,
              true,
              addingPredefined.id,
            )}
            <div className="self-end flex items-center gap-2">
              <button type="button" data-testid="btn-cancel-add-predefined-mcp-server" data-analytics="cancel_add_predefined_mcp_server"
                onClick={() => setAddingPredefined(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${lightMode ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                Cancel
              </button>
              <button data-testid="btn-save-predefined-mcp-server" data-analytics="save_predefined_mcp_server" type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors">
                <Plus size={14} /> Add
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create form */}
      <div className={!isPro ? 'opacity-60 pointer-events-none' : undefined}>
        <form onSubmit={handleCreate} className={`border rounded-2xl p-5 flex flex-col gap-3 ${card}`}>
          <p className={`text-xs font-bold uppercase tracking-widest ${subText}`}>Register new MCP server</p>

          {/* Server type selector */}
          <div className="flex items-center gap-2">
            <label className={`text-xs font-semibold shrink-0 ${subText}`}>Server Type:</label>
            <div className="flex gap-2">
              {(['http', 'openapi'] as ServerType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  data-testid={`btn-server-type-${t}`}
                  data-analytics={`server_type_${t}`}
                  onClick={() => setForm(p => ({ ...p, serverType: t, openapiSpecUrl: '', openapiSpec: '' }))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                    form.serverType === t
                      ? lightMode ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-purple-900/30 border-purple-600 text-purple-300'
                      : lightMode ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {SERVER_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Server name..." disabled={!isPro} data-testid="input-mcp-name"
              className={`sm:flex-1 border rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-colors ${inputCls}`} />
            <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder="https://your-mcp-server/..." disabled={!isPro} data-testid="input-mcp-url"
              className={`sm:flex-[2] border rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-colors ${inputCls}`} />
          </div>

          {/* OpenAPI fields — only shown when serverType === 'openapi' */}
          {form.serverType === 'openapi' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="sm:flex-1 flex flex-col gap-1">
                  <label className={`text-xs font-semibold ${subText}`}>OpenAPI Spec URL (optional):</label>
                  <input value={form.openapiSpecUrl} onChange={e => setForm(p => ({ ...p, openapiSpecUrl: e.target.value }))}
                    placeholder="https://api.example.com/openapi.json" disabled={!isPro} data-testid="input-openapi-spec-url"
                    className={`border rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-colors ${inputCls}`} />
                </div>
                <div className="sm:flex-1 flex flex-col gap-1">
                  <label className={`text-xs font-semibold ${subText}`}>Or upload spec file:</label>
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition-colors ${inputCls}`}>
                    <input type="file" accept=".json,.yaml,.yml" disabled={!isPro}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setForm(p => ({ ...p, openapiSpec: (ev.target?.result as string) || '' }));
                        reader.readAsText(file);
                      }}
                      className="hidden" data-testid="input-openapi-spec-file" />
                    <Plus size={14} /> Upload .json / .yaml
                  </label>
                </div>
              </div>
              {form.openapiSpec && (
                <div className="flex items-center gap-2 text-xs text-green-400 font-semibold">
                  <CheckCircle2 size={14} />
                  Spec file loaded — {form.openapiSpec.length} chars
                  <button type="button" onClick={() => setForm(p => ({ ...p, openapiSpec: '' }))} className="ml-1 underline hover:text-red-300">Remove</button>
                </div>
              )}
            </div>
          )}

          {renderAuthFields(
            form.authType, v => setForm(p => ({ ...p, authType: v, username: '', password: '', token: '', refreshToken: '' })),
            form.username, v => setForm(p => ({ ...p, username: v })),
            form.password, v => setForm(p => ({ ...p, password: v })),
            form.token, v => setForm(p => ({ ...p, token: v })),
            form.refreshToken,
            form.url,
              result => setForm(p => ({ ...p, refreshToken: result.refreshToken, oauthMetadata: {...(p.oauthMetadata || {}), ...(result.oauthMetadata || {})} })),
              false,
              !isPro,
              false,
              undefined, // predefinedServerId
              form.authType === 'oauth' ? form.oauthMetadata : undefined,
              form.authType === 'oauth' ? (v: Record<string, unknown> | undefined) => setForm(p => ({ ...p, oauthMetadata: v })) : undefined,
              form.authType === 'oauth' ? oauthConfigFileRef : undefined,
              form.authType === 'oauth' ? handleOAuthConfigUpload : undefined,
            )}

          <div className="flex flex-col gap-1">
            <label className={`text-xs font-semibold ${subText}`}>Additional headers (optional):</label>
            <input value={form.headersJson} onChange={e => setForm(p => ({ ...p, headersJson: e.target.value }))}
              placeholder='{"X-Custom-Header": "value"}' disabled={!isPro} data-testid="input-mcp-headers"
              className={`border rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-colors ${inputCls}`} />
          </div>

          <div className="self-end flex flex-wrap items-center gap-2">
            <button data-testid="btn-register-mcp-server" data-analytics="register_mcp_server" type="submit"
              disabled={!isPro || creating || !form.name.trim() || !form.url.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors">
              <Plus size={16} /> Register
            </button>
            {!isPro && <ProLockBadge className="pointer-events-auto" />}
          </div>
        </form>
      </div>

      {/* Server list */}
      {loading ? (
        <div className={`text-center py-12 ${subText}`}>Loading...</div>
      ) : servers.length === 0 ? (
        <div className={`text-center py-12 border rounded-2xl ${card} ${subText}`}>
          <Server size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No MCP servers registered yet</p>
          <p className="text-xs mt-1">Register one above to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {servers.map(server => {
            const isBuiltIn = server.predefined_server_id !== null;
            return (
              <div key={server.id} className={`border rounded-2xl p-4 ${card}`}>
                {editing[server.id] ? (
                  <div className="flex flex-col gap-2">
                    {isBuiltIn ? (
                      /* Built-in servers: URL, name, headers, and auth type are locked — only credentials can be updated. */
                      <>
                        <div className={`flex items-center gap-2 text-xs ${subText} px-1`}>
                          <span className="font-medium">URL (locked):</span>
                          <span className="truncate">{server.url}</span>
                        </div>
                        <p className={`text-xs ${subText} px-1`}>Only credentials can be updated:</p>
                      </>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input autoFocus value={editing[server.id].name}
                          onChange={e => updateEdit(server.id, { name: e.target.value })}
                          className={`sm:flex-1 border rounded-xl px-3 py-1.5 text-sm font-semibold outline-none ${inputCls}`} />
                        <input value={editing[server.id].url}
                          onChange={e => updateEdit(server.id, { url: e.target.value })}
                          className={`sm:flex-[2] border rounded-xl px-3 py-1.5 text-sm font-semibold outline-none ${inputCls}`} />
                      </div>
                    )}

                    {renderAuthFields(
                      editing[server.id].authType,
                      isBuiltIn
                        ? () => { /* auth type locked for predefined-derived */ }
                        : v => updateEdit(server.id, { authType: v, username: '', password: '', token: '', refreshToken: '' }),
                      editing[server.id].username, v => updateEdit(server.id, { username: v }),
                      editing[server.id].password, v => updateEdit(server.id, { password: v }),
                      editing[server.id].token, v => updateEdit(server.id, { token: v }),
                      editing[server.id].refreshToken,
                      server.url,
                      result => updateEdit(server.id, { refreshToken: result.refreshToken, oauthMetadata:
                            {...(editing[server.id].oauthMetadata || {}), ...(result.oauthMetadata || {})} }),
                      editing[server.id].has_credentials,
                      false,
                      isBuiltIn,
                      editing[server.id].predefinedServerId,
                      editing[server.id].oauthMetadata
                    )}

                    {!isBuiltIn && (
                      <input value={editing[server.id].headersJson}
                        onChange={e => updateEdit(server.id, { headersJson: e.target.value })}
                        placeholder='Additional headers (optional JSON)'
                        className={`border rounded-xl px-3 py-1.5 text-sm font-semibold outline-none ${inputCls}`} />
                    )}

                    <div className="flex gap-2 justify-end">
                      <button data-testid="btn-cancel-edit-mcp-server" data-analytics="cancel_edit_mcp_server"
                        onClick={() => cancelEdit(server.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${lightMode ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                        Cancel
                      </button>
                      <button data-testid="btn-save-mcp-server" data-analytics="save_mcp_server"
                        onClick={() => handleSaveEdit(server)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3" data-testid="mcp-server-card" data-mcp-server-name={server.name}>
                    <Server size={18} className="text-purple-400 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-semibold truncate ${text}`}>{server.name}</p>
                        {(server.server_type === 'openapi') && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${lightMode ? 'bg-blue-50 text-blue-600' : 'bg-blue-950/30 text-blue-400'}`}>
                            OpenAPI
                          </span>
                        )}
                        {isBuiltIn && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${lightMode ? 'bg-purple-50 text-purple-600' : 'bg-purple-950/30 text-purple-400'}`}>
                            Built-in
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-xs truncate ${subText}`}>{server.url}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                          server.auth_type === 'none'
                            ? lightMode ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'
                            : lightMode ? 'bg-green-50 text-green-700' : 'bg-green-950/40 text-green-400'
                        }`}>
                          {AUTH_TYPE_LABELS[server.auth_type]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button data-testid="btn-edit-mcp-server" data-analytics="edit_mcp_server"
                        data-server-id={server.id} onClick={() => startEdit(server)} title="Edit"
                        className={`p-2 rounded-lg transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'}`}>
                        <Edit2 size={16} />
                      </button>
                      <button data-testid="btn-delete-mcp-server" data-analytics="delete_mcp_server"
                        data-server-id={server.id} onClick={() => handleDelete(server.id)} title="Delete"
                        className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteServerId !== null && (
        <ConfirmDialog
          title="Delete MCP Server?"
          message="This server will be removed from your account and will no longer be available for new sessions."
          confirmLabel="Delete"
          icon={<Trash2 size={24} className="text-red-400" />}
          onClose={() => setDeleteServerId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
};

export default MCPServersPage;

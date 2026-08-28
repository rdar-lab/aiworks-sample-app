import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export const OAUTH_STORAGE_KEY = 'mcpOauthResponse';
export const OAUTH_STORAGE_KEY_LOCAL = 'mcpOauthResponseLocal';

/**
 * Handles the OAuth 2.1 / PKCE redirect for MCP server authentication.
 *
 * The authorization server redirects here with query parameters:
 *   /app/mcp-oauth-callback?code=CODE&state=STATE
 *   /app/mcp-oauth-callback?error=ERROR&error_description=DESCRIPTION
 *
 * This page stores the callback data in sessionStorage and closes itself.
 * The opener polls sessionStorage to retrieve the result.
 */
const MCPOAuthCallbackPage: React.FC = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (!code && !error) return;

    const payload = { code, state, error, errorDescription };
    try {
      sessionStorage.setItem(OAUTH_STORAGE_KEY_LOCAL, JSON.stringify(payload));
    } catch (e) {
      console.error('[OAuth callback] sessionStorage write failed:', e);
    }
    if (window.opener) {
      window.opener.postMessage({ mcpOAuthCallback: true, ...payload }, window.location.origin);
    }
    setTimeout(() => { try { window.close(); } catch {} }, 100);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 size={40} className="text-purple-500 animate-spin" />
      <p className="text-slate-400 text-sm">Completing MCP authentication…</p>
    </div>
  );
};

export default MCPOAuthCallbackPage;

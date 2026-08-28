import { useEffect, useState } from 'react';
import { knowledgeBaseAPI, mcpServerAPI, tunnelAPI } from '../services/backendService';
import { KnowledgeBaseSummary, MCPServerSummary, TunnelServerSummary } from '../types';

/**
 * Loads all attachment data: knowledge bases, MCP servers, and tunnel servers.
 * Non-fatal: failures are silently swallowed so the toolbar simply won't
 * show those items rather than breaking the page.
 */
export function useAttachmentToolbarData() {
  const [availableKbs, setAvailableKbs] = useState<KnowledgeBaseSummary[]>([]);
  const [availableMcpServers, setAvailableMcpServers] = useState<MCPServerSummary[]>([]);
  const [availableTunnelServers, setAvailableTunnelServers] = useState<TunnelServerSummary[]>([]);
  const [selectedTunnelServerIds, setSelectedTunnelServerIds] = useState<string[]>([]);

  useEffect(() => {
    knowledgeBaseAPI.list()
      .then(kbs => setAvailableKbs(kbs.map(kb => ({ id: kb.id, name: kb.name }))))
      .catch(() => {});
    mcpServerAPI.list()
      .then(servers => setAvailableMcpServers(servers.map(s => ({ id: s.id, name: s.name, url: s.url }))))
      .catch(() => {});
    tunnelAPI.list()
      .then(tunnels => {
        const servers: (TunnelServerSummary & { tunnelId: string })[] = [];
        for (const tunnel of tunnels) {
          if (!tunnel.is_connected || !tunnel.servers) continue;
          for (const srv of tunnel.servers) {
            servers.push({ id: srv.id, name: srv.name, tunnelId: tunnel.tunnel_id });
          }
        }
        setAvailableTunnelServers(servers);
      })
      .catch(() => {});
  }, []);

  const onToggleTunnelServer = (id: string) => {
    setSelectedTunnelServerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return {
    availableKbs,
    availableMcpServers,
    availableTunnelServers,
    selectedTunnelServerIds,
    setSelectedTunnelServerIds,
    onToggleTunnelServer,
  };
}

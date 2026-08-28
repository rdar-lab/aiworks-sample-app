#!/usr/bin/env node

import parseArgs from "minimist";
import { loadMCPServerConfig } from "./config.js";
import { loadTunnelSession, saveTunnelSession, clearTunnelSession, generateTunnelApiKey } from "./tunnel-key.js";
import { MCPBridge } from "./mcp-bridge.js";
import { TunnelClient } from "./tunnel-client.js";

const DEFAULT_API_URL = process.env.DESKTOP_CLI_API_URL || "https://my.app.url/api";
const WS_PATH = "/ws/mcp-tunnel/connect";

interface Args {
  config?: string;
  "api-url"?: string;
  help?: boolean;
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] ${msg}\n`);
}

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2)) as Args;

  if (argv.help) {
    console.log(`AiWorks Sample App CLI
Usage: aiworks [options]
Options:
  --config <path>     Path to mcpServers.json (default: ~/.config/aiworks/mcpServers.json)
  --api-url <url>     REST API base URL (default: from DESKTOP_CLI_API_URL or cloud)
  --help              Show this help
`);
    return;
  }

  const configPath = argv.config;
  const baseUrl = (argv["api-url"] || DEFAULT_API_URL).replace(/\/$/, "").replace(/\/api$/, "");
  const wsEndpoint = baseUrl.replace(/^http/, "ws") + WS_PATH;

  const { servers } = loadMCPServerConfig(configPath);
  log(`Loaded ${servers.length} MCP server(s) from config`);

  const bridge = new MCPBridge();
  for (const server of servers) {
    log(`Starting MCP server "${server.name}" (id: ${server.id.substring(0, 8)}...)`);
    try {
      await bridge.startServer(server.id, server.name, server.command, server.args);
    } catch (err: any) {
      log(`Failed to start "${server.name}": ${err.message}`);
    }
  }

  const priorSession = loadTunnelSession();
  const existingTunnelId = priorSession?.tunnelId || null;
  const tunnelApiKey = priorSession?.tunnelApiKey || generateTunnelApiKey();

  let connected = false;
  let tunnelId: string | null = null;
  let isReconnect = false;

  const client = new TunnelClient();

  const onStatus = (msg: string) => log(msg);

  const onTunnelId = (id: string, reconnect: boolean) => {
    tunnelId = id;
    isReconnect = reconnect;
    connected = true;
    saveTunnelSession(id, tunnelApiKey);
    log(`tunnel_id: ${id}${reconnect ? " (reconnected)" : ""}`);
    log(`tunnel_api_key: ${tunnelApiKey}`);
  };

  client.connect(wsEndpoint, tunnelApiKey, existingTunnelId, onStatus, onTunnelId);
  client.setBridge(bridge);

  client.setCallHandler(async (serverId: string, tool: string, args: Record<string, unknown>) => {
    return bridge.callTool(serverId, tool, args);
  });

  const pingInterval = setInterval(() => {
    if (connected) client.sendPing();
  }, 30000);

  process.on("SIGINT", async () => {
    clearInterval(pingInterval);
    client.disconnect();
    for (const id of bridge.getServerIds()) {
      await bridge.stopServer(id);
    }
    log("Shutting down...");
    process.exit(0);
  });

  log("Ready. Waiting for tool calls...");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
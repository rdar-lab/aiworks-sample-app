import WebSocket from "ws";
import { ServerManifest } from "./mcp-bridge.js";

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] ${msg}\n`);
}

export type CallHandler = (
  serverId: string,
  tool: string,
  args: Record<string, unknown>
) => Promise<unknown>;

export class TunnelClient {
  private ws: WebSocket | null = null;
  private _bridge: import("./mcp-bridge.js").MCPBridge | null = null;
  private tunnelApiKey: string = "";
  private endpoint: string = "";
  private existingTunnelId: string | null = null;
  private reconnectDelay: number = 1000;
  private onStatus: (msg: string) => void = () => {};
  private onTunnelId: (id: string, isReconnect: boolean) => void = () => {};
  private disconnectRequested: boolean = false;

  connect(
    endpoint: string,
    tunnelApiKey: string,
    existingTunnelId: string | null,
    onStatus: (msg: string) => void,
    onTunnelId: (id: string, isReconnect: boolean) => void
  ): void {
    this.endpoint = endpoint;
    this.tunnelApiKey = tunnelApiKey;
    this.existingTunnelId = existingTunnelId;
    this.onStatus = onStatus;
    this.onTunnelId = onTunnelId;
    this._connect();
  }

  private _connect(): void {
    const url = new URL(this.endpoint);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
    } else if (url.protocol === "https:") {
      url.protocol = "wss:";
    }

    this.ws = new WebSocket(url.href, {
      headers: {
        Origin: `${url.protocol}//${url.host}`,
      },
    });

    this.ws.on("open", () => {
      this.reconnectDelay = 1000;
      this._sendConnect();
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        log(`← server ${msg.type || "?"}`);
        this._handleMessage(msg);
      } catch {
      }
    });

    this.ws.on("close", () => {
      if (this.disconnectRequested) return;
      this.onStatus("Disconnected. Reconnecting...");
      setTimeout(() => this._connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    });

    this.ws.on("error", (err) => {
      this.onStatus(`WS error: ${err.message}`);
    });
  }

  private _sendConnect(): void {
    const msg: Record<string, unknown> = {
      type: "connect",
      tunnel_api_key: this.tunnelApiKey,
    };
    if (this.existingTunnelId) {
      msg.tunnel_id = this.existingTunnelId;
    }
    this.ws?.send(JSON.stringify(msg));
  }

  private _handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    if (type === "connected") {
      const tunnelId = msg.tunnel_id as string;
      this.existingTunnelId = tunnelId;
      this.onTunnelId(tunnelId, !!(msg as any).reconnected);
      this.sendPing();
      return;
    }

    if (type === "error") {
      const errorMsg = msg.message as string;
      if (errorMsg.includes("not found") || errorMsg.includes("Please reregister")) {
        this.onStatus(`Tunnel not found. Clearing cache and reconnecting...`);
        this.existingTunnelId = null;
      }
      return;
    }

    if (type === "ping") {
      this._send({ type: "pong" });
      return;
    }

    if (type === "call") {
      const callId = msg.call_id as string;
      const serverId = msg.server_id as string;
      const tool = msg.tool as string;
      const args = (msg.args || {}) as Record<string, unknown>;
      this._handleCall(callId, serverId, tool, args).catch(() => {});
      return;
    }

    if (type === "pull_tools") {
      const callId = msg.call_id as string;
      const serverIds = (msg.server_ids as string[]) || [];
      this._handlePullTools(callId, serverIds).catch(() => {});
      return;
    }

    if (type === "get_servers") {
      const callId = msg.call_id as string;
      this._handleGetServers(callId).catch(() => {});
      return;
    }
  }

  private async _handleCall(
    callId: string,
    serverId: string,
    tool: string,
    args: Record<string, unknown>
  ): Promise<void> {
    console.log(`[tunnel-client] _handleCall serverId=${serverId} tool=${tool} _defaultHandler=${typeof this._defaultHandler} _bridge=${typeof this._bridge}`);
    try {
      const result = await this._defaultHandler(serverId, tool, args);
      this._send({ type: "call_result", call_id: callId, result });
    } catch (err: any) {
      console.log(`[tunnel-client] _handleCall error: ${err.message} serverId=${serverId}`);
      this._send({ type: "call_result", call_id: callId, error: err.message });
    }
  }

  private async _handlePullTools(callId: string, serverIds: string[]): Promise<void> {
    const allManifests = this._bridge ? this._bridge.getAllManifests() : [];
    console.log(`[tunnel-client] _handlePullTools serverIds=${JSON.stringify(serverIds)} available=${JSON.stringify(allManifests.map(m => m.id))}`);
    const servers = serverIds.length > 0
      ? allManifests.filter((m: ServerManifest) => serverIds.includes(m.id))
      : allManifests;
    this._send({ type: "tools", call_id: callId, servers });
  }

  private async _handleGetServers(callId: string): Promise<void> {
    const allManifests = this._bridge ? this._bridge.getAllManifests() : [];
    const servers = allManifests.map((m: ServerManifest) => ({ id: m.id, name: m.name }));
    this._send({ type: "servers", call_id: callId, servers });
  }

  sendTools(servers: ServerManifest[]): void {
    this._send({
      type: "tools",
      servers: servers.map((s) => ({
        id: s.id,
        name: s.name,
        tools: s.tools,
      })),
    });
  }

  sendPing(): void {
    this._send({ type: "ping" });
  }

  setBridge(bridge: import("./mcp-bridge.js").MCPBridge): void {
    this._bridge = bridge;
  }

  setCallHandler(handler: CallHandler): void {
    this._defaultHandler = handler;
  }

  private _defaultHandler: CallHandler = async () => { throw new Error("No handler"); };

  disconnect(): void {
    this.disconnectRequested = true;
    this.ws?.close();
    this.ws = null;
  }

  private _send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === 1) {
      log(`→ server ${msg.type || "?"}`);
      this.ws.send(JSON.stringify(msg));
    }
  }
}
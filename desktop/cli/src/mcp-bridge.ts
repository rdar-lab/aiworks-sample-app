import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, ChildProcess } from "child_process";

export interface ToolManifest {
  name: string;
  description: string;
  args_schema?: Record<string, unknown>;
}

export interface ServerManifest {
  id: string;
  name: string;
  tools: ToolManifest[];
}

interface ServerState {
  client: Client;
  manifest: ServerManifest;
  proc: ChildProcess;
}

export class MCPBridge {
  private servers: Map<string, ServerState> = new Map();
  private restartCounts: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 3;

  async startServer(
    serverId: string,
    name: string,
    command: string,
    args: string[]
  ): Promise<void> {
    await this._startServer(serverId, name, command, args);
  }

  private async _startServer(
    serverId: string,
    name: string,
    command: string,
    args: string[]
  ): Promise<void> {
    const transport = new StdioClientTransport({ command, args });

    const client = new Client({ name, version: "1.0.0" }, {});
    await client.connect(transport);

    const toolsResult = await client.listTools();
    const tools: ToolManifest[] = (toolsResult.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || "",
      args_schema: t.inputSchema || {},
    }));

    this.servers.set(serverId, {
      client,
      manifest: { id: serverId, name, tools },
      proc: (transport as any)._childProcess,
    });

    this.restartCounts.set(serverId, 0);
  }

  async stopServer(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) return;

    try {
      await state.client.close();
    } catch {
    }
    if (state.proc && !state.proc.killed) {
      state.proc.kill("SIGTERM");
    }
    this.servers.delete(serverId);
  }

  async restartServer(serverId: string): Promise<boolean> {
    const count = this.restartCounts.get(serverId) || 0;
    if (count >= this.MAX_RETRIES) {
      return false;
    }

    const state = this.servers.get(serverId);
    if (!state) return false;

    const name = state.manifest.name;
    const [command, ...args] = state.proc?.spawnargs || [];

    await this.stopServer(serverId);
    this.restartCounts.set(serverId, count + 1);

    try {
      await this._startServer(serverId, name, command, args);
      return true;
    } catch {
      return false;
    }
  }

  getServerIds(): string[] {
    return Array.from(this.servers.keys());
  }

  getToolManifest(serverId: string): ServerManifest | null {
    return this.servers.get(serverId)?.manifest || null;
  }

  getAllManifests(): ServerManifest[] {
    return Array.from(this.servers.values()).map((s) => s.manifest);
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      const result = await state.client.callTool(
        { name: toolName, arguments: args }
      );
      return result;
    } catch (err) {
      const restarted = await this.restartServer(serverId);
      if (restarted) {
        return this.callTool(serverId, toolName, args);
      }
      throw err;
    }
  }
}

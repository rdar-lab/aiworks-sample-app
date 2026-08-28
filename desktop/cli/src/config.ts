import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { v5 as uuidv5 } from "uuid";

export interface MCPServerEntry {
  command: string;
  args?: string[];
}

export interface MCPServerConfig {
  mcpServers: Record<string, MCPServerEntry>;
}

export interface ParsedServer {
  id: string;
  name: string;
  command: string;
  args: string[];
}

function getConfigDir(): string {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || "", "aiworks");
  }
  return path.join(os.homedir(), ".config", "aiworks");
}

function getDefaultConfigPath(): string {
  return path.join(getConfigDir(), "mcpServers.json");
}

export function loadMCPServerConfig(
  configPath?: string
): { servers: ParsedServer[] } {
  const filePath = configPath || getDefaultConfigPath();

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Config file not found at ${filePath}. Please create mcpServers.json.`
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const config: MCPServerConfig = JSON.parse(raw);

  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    throw new Error(
      "Invalid mcpServers.json: must have a 'mcpServers' object."
    );
  }

  const servers: ParsedServer[] = [];

  for (const [name, entry] of Object.entries(config.mcpServers)) {
    if (!entry.command || typeof entry.command !== "string") {
      throw new Error(
        `Server '${name}': must have a 'command' string.`
      );
    }
    const serverId = uuidv5(name, uuidv5.DNS);
    servers.push({
      id: serverId,
      name,
      command: entry.command,
      args: Array.isArray(entry.args) ? entry.args : [],
    });
  }

  return { servers };
}
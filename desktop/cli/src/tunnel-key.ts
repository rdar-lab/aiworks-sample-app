import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

export interface TunnelSession {
  tunnelId: string;
  tunnelApiKey: string;
}

let _configDir: string | null = null;

export function _setConfigDir(dir: string): void {
  _configDir = dir;
}

export function _resetConfigDir(): void {
  _configDir = null;
}

function getConfigDir(): string {
  if (_configDir !== null) return _configDir;
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || "", "aiworks");
  }
  return path.join(os.homedir(), ".config", "aiworks");
}

export function saveTunnelSession(tunnelId: string, tunnelApiKey: string): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const sessionFile = path.join(dir, "tunnel_key");
  const session: TunnelSession = { tunnelId, tunnelApiKey };
  fs.writeFileSync(sessionFile, JSON.stringify(session), "utf-8");
}

export function loadTunnelSession(): TunnelSession | null {
  const sessionFile = path.join(getConfigDir(), "tunnel_key");
  if (!fs.existsSync(sessionFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
  } catch {
    return null;
  }
}

export function clearTunnelSession(): void {
  const sessionFile = path.join(getConfigDir(), "tunnel_key");
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
  }
}

export function generateTunnelApiKey(): string {
  return "tk_" + crypto.randomBytes(24).toString("base64url");
}
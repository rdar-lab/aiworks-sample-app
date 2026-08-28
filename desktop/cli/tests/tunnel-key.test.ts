import { describe, it, expect, afterEach, beforeEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  saveTunnelSession,
  loadTunnelSession,
  clearTunnelSession,
  generateTunnelApiKey,
  _setConfigDir,
  _resetConfigDir,
} from "../src/tunnel-key";

const TEST_DIR = path.join(os.tmpdir(), "aiworks-cli-tunnel-key-test");

beforeEach(() => {
  _setConfigDir(TEST_DIR);
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  _resetConfigDir();
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
});

describe("generateTunnelApiKey", () => {
  it("generates a key starting with tk_", () => {
    const key = generateTunnelApiKey();
    expect(key.startsWith("tk_")).toBe(true);
  });

  it("generates unique keys each time", () => {
    const keys = new Set([generateTunnelApiKey(), generateTunnelApiKey(), generateTunnelApiKey()]);
    expect(keys.size).toBe(3);
  });

  it("key is long enough (24 bytes base64url ~= 32+ chars)", () => {
    const key = generateTunnelApiKey();
    expect(key.length).toBeGreaterThan(30);
  });
});

describe("loadTunnelSession", () => {
  it("returns null when no session file exists", () => {
    expect(loadTunnelSession()).toBeNull();
  });

  it("returns null for empty file", () => {
    fs.writeFileSync(path.join(TEST_DIR, "tunnel_key"), "", "utf-8");
    expect(loadTunnelSession()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    fs.writeFileSync(path.join(TEST_DIR, "tunnel_key"), "not valid json{", "utf-8");
    expect(loadTunnelSession()).toBeNull();
  });

  it("returns null for partial JSON", () => {
    fs.writeFileSync(path.join(TEST_DIR, "tunnel_key"), '{"tunnelId": "t_123"', "utf-8");
    expect(loadTunnelSession()).toBeNull();
  });
});

describe("saveTunnelSession", () => {
  it("saves and loads a session", () => {
    saveTunnelSession("t_test123", "tk_secret");
    const loaded = loadTunnelSession();
    expect(loaded).toEqual({ tunnelId: "t_test123", tunnelApiKey: "tk_secret" });
  });

  it("overwrites previous session", () => {
    saveTunnelSession("t_first", "tk_first");
    saveTunnelSession("t_second", "tk_second");
    const loaded = loadTunnelSession();
    expect(loaded?.tunnelId).toBe("t_second");
    expect(loaded?.tunnelApiKey).toBe("tk_second");
  });
});

describe("clearTunnelSession", () => {
  it("clears existing session", () => {
    saveTunnelSession("t_test", "tk_test");
    clearTunnelSession();
    expect(loadTunnelSession()).toBeNull();
  });

  it("does not throw when no session exists", () => {
    expect(() => clearTunnelSession()).not.toThrow();
  });
});
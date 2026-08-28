import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadMCPServerConfig } from "../src/config";

const TEST_DIR = path.join(os.tmpdir(), "aiworks-cli-config-test");

beforeEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
});

describe("loadMCPServerConfig", () => {
  it("parses a valid config file", () => {
    const configPath = path.join(TEST_DIR, "mcpServers.json");
    fs.writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
        },
        github: {
          command: "uvx",
          args: ["github-mcp"]
        }
      }
    }));

    const { servers } = loadMCPServerConfig(configPath);

    expect(servers).toHaveLength(2);
    expect(servers[0].name).toBe("filesystem");
    expect(servers[0].command).toBe("npx");
    expect(servers[0].args).toEqual(["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]);
    expect(servers[1].name).toBe("github");
  });

  it("uses name as id (deterministic uuidv5)", () => {
    const configPath = path.join(TEST_DIR, "mcpServers.json");
    fs.writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        myserver: { command: "echo", args: ["hello"] }
      }
    }));

    const { servers } = loadMCPServerConfig(configPath);

    expect(servers[0].id).toBeTruthy();
    expect(servers[0].id.length).toBeGreaterThan(10);
  });

  it("throws when file not found", () => {
    const configPath = path.join(TEST_DIR, "nonexistent.json");

    expect(() => {
      loadMCPServerConfig(configPath);
    }).toThrow(/Config file not found/);
  });

  it("throws when mcpServers is missing", () => {
    const configPath = path.join(TEST_DIR, "bad.json");
    fs.writeFileSync(configPath, JSON.stringify({}));

    expect(() => {
      loadMCPServerConfig(configPath);
    }).toThrow(/must have a 'mcpServers' object/);
  });

  it("throws when server has no command", () => {
    const configPath = path.join(TEST_DIR, "bad2.json");
    fs.writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        badserver: { args: ["something"] }
      }
    }));

    expect(() => {
      loadMCPServerConfig(configPath);
    }).toThrow(/must have a 'command' string/);
  });

  it("defaults args to empty array when not provided", () => {
    const configPath = path.join(TEST_DIR, "noargs.json");
    fs.writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        minimal: { command: "echo" }
      }
    }));

    const { servers } = loadMCPServerConfig(configPath);

    expect(servers[0].args).toEqual([]);
  });

  it("accepts args as array", () => {
    const configPath = path.join(TEST_DIR, "withargs.json");
    fs.writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        test: { command: "echo", args: ["arg1", "arg2"] }
      }
    }));

    const { servers } = loadMCPServerConfig(configPath);

    expect(servers[0].args).toEqual(["arg1", "arg2"]);
  });
});
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TunnelClient } from "../src/tunnel-client";
import type { ServerManifest } from "../src/mcp-bridge";

const mockSend = vi.fn();
const mockClose = vi.fn();

const { MockWebSocket } = vi.hoisted(() => {
  class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    send = mockSend;
    close = mockClose;
    private handlers: Map<string, Function[]> = new Map();

    constructor(_url: string) {
      setTimeout(() => this.trigger("open", {}), 5);
      setTimeout(() => {
        this.trigger("message", JSON.stringify({ type: "connected", tunnel_id: "t_abc123" }));
      }, 15);
    }

    on(_event: string, handler: Function) {
      if (!this.handlers.has(_event)) this.handlers.set(_event, []);
      this.handlers.get(_event)!.push(handler);
    }

    private trigger(event: string, data: any) {
      for (const h of (this.handlers.get(event) || [])) h(data);
    }
  }
  return { MockWebSocket };
});

vi.mock("ws", () => ({ default: MockWebSocket }));

describe("TunnelClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connect sends correct message on first connect", async () => {
    const client = new TunnelClient();
    client.connect("ws://localhost:8080", "tk_newkey", null, vi.fn(), vi.fn());
    await new Promise(r => setTimeout(r, 30));

    const sentMessages = mockSend.mock.calls.map(c => JSON.parse(c[0] as string));
    const connectMsg = sentMessages.find((m: any) => m.type === "connect");
    expect(connectMsg).toBeDefined();
    expect(connectMsg?.tunnel_api_key).toBe("tk_newkey");
    expect(connectMsg?.tunnel_id).toBeUndefined();
  });

  it("connect sends correct message on reconnect with tunnel_id", async () => {
    const client = new TunnelClient();
    client.connect("ws://localhost:8080", "tk_mykey", "t_existing", vi.fn(), vi.fn());
    await new Promise(r => setTimeout(r, 30));

    const sentMessages = mockSend.mock.calls.map(c => JSON.parse(c[0] as string));
    const connectMsg = sentMessages.find((m: any) => m.type === "connect");
    expect(connectMsg).toBeDefined();
    expect(connectMsg?.tunnel_api_key).toBe("tk_mykey");
    expect(connectMsg?.tunnel_id).toBe("t_existing");
  });

  it("disconnect calls ws.close", async () => {
    const client = new TunnelClient();
    client.connect("ws://localhost:8080", "tk_secret", null, vi.fn(), vi.fn());
    await new Promise(r => setTimeout(r, 20));
    client.disconnect();
    expect(mockClose).toHaveBeenCalled();
  });

  it("sendTools sends tools message when connected", async () => {
    const client = new TunnelClient();
    client.connect("ws://localhost:8080", "tk_secret", null, vi.fn(), vi.fn());
    await new Promise(r => setTimeout(r, 30));

    const servers: ServerManifest[] = [
      {
        id: "srv1",
        name: "TestServer",
        tools: [{ name: "tool1", description: "A tool", args_schema: {} }]
      }
    ];

    client.sendTools(servers);

    const sentMessages = mockSend.mock.calls.map(c => JSON.parse(c[0] as string));
    const toolsMsg = sentMessages.find((m: any) => m.type === "tools");
    expect(toolsMsg).toBeDefined();
    expect(toolsMsg?.servers).toHaveLength(1);
    expect(toolsMsg?.servers[0].id).toBe("srv1");
    expect(toolsMsg?.servers[0].tools[0].name).toBe("tool1");
  });

  it("sendPing sends ping message", async () => {
    const client = new TunnelClient();
    client.connect("ws://localhost:8080", "tk_secret", null, vi.fn(), vi.fn());
    await new Promise(r => setTimeout(r, 30));

    client.sendPing();

    const sentMessages = mockSend.mock.calls.map(c => JSON.parse(c[0] as string));
    expect(sentMessages.some((m: any) => m.type === "ping")).toBe(true);
  });

  it("setCallHandler is callable without throwing", () => {
    const client = new TunnelClient();
    expect(() => client.setCallHandler(vi.fn())).not.toThrow();
  });

  it("setBridge is callable without throwing", () => {
    const client = new TunnelClient();
    expect(() => client.setBridge({ getAllManifests: () => [] } as any)).not.toThrow();
  });

  it("onTunnelId is called after successful connection", async () => {
    const onTunnelId = vi.fn();
    const client = new TunnelClient();

    client.connect("ws://localhost:8080", "tk_secret", null, vi.fn(), onTunnelId);

    await new Promise(r => setTimeout(r, 50));

    expect(onTunnelId).toHaveBeenCalledWith("t_abc123", false);
  });
});
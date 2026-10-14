// packages/client-core/src/protocol/client.ts
// Official TypeScript client for Prumo Harness Daemon (Protocol 0.4.0+)
import net from "node:net";
import tls from "node:tls";
import { EventEmitter } from "node:events";

export const PROTOCOL_VERSION = "0.4.0";

export interface RunStatus {
  run_id: string;
  status: string;
  phase: string;
  stop_reason: string;
  active: boolean;
  interrupted?: boolean;
  resume_checkpoint?: string;
  permission_fingerprints?: Record<string, string>;
  pending_permissions?: string[];
}

export interface AgentEvent {
  id: string;
  run_id: string;
  turn_id?: string;
  kind: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface StartRequest {
  goal: string;
  provider?: string;
  model?: string;
  base_url?: string;
  max_turns?: number;
  run_id?: string;
  workspace?: string;
  reasoning_effort?: string;
}

export interface RemoteOptions {
  addr: string;
  token: string;
  caCert?: string;
}

export interface FileDiff {
  path: string;
  diff: string;
}

type OpEnvelope = Record<string, unknown>;

function splitLines(buf: string): { lines: string[]; rest: string } {
  const parts = buf.split("\n");
  return { lines: parts.slice(0, -1), rest: parts[parts.length - 1] };
}

export class Client {
  private socketPath?: string;
  private remote?: RemoteOptions;
  private timeoutMs: number;

  constructor(socketPath?: string, timeoutMs = 30000) {
    this.socketPath = socketPath;
    this.timeoutMs = timeoutMs;
  }

  static remote(opts: RemoteOptions, timeoutMs = 30000): Client {
    const c = new Client(undefined, timeoutMs);
    c.remote = opts;
    return c;
  }

  private connect(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error): void => reject(err);
      if (this.remote) {
        const [host, portRaw] = this.remote.addr.split(":");
        const port = Number(portRaw);
        const sock = tls.connect(
          {
            host,
            port,
            ca: this.remote.caCert,
            minVersion: "TLSv1.2",
            servername: host,
          },
          () => {
            sock.write(JSON.stringify({ auth: this.remote?.token }) + "\n");
            const chunks: string[] = [];
            const onData = (d: Buffer): void => {
              chunks.push(d.toString("utf8"));
              const { lines } = splitLines(chunks.join(""));
              if (lines.length > 0) {
                const first = JSON.parse(lines[0]) as { ok?: boolean; error?: string };
                sock.off("data", onData);
                if (first.ok) {
                  resolve(sock);
                } else {
                  sock.destroy();
                  reject(new Error(`auth: ${String(first.error)}`));
                }
              }
            };
            sock.on("data", onData);
          },
        );
        sock.once("error", onError);
        return;
      }
      if (!this.socketPath) {
        reject(new Error("no socket path or remote configured"));
        return;
      }
      const sock = net.createConnection(this.socketPath);
      sock.once("connect", () => resolve(sock));
      sock.once("error", onError);
    });
  }

  async call(msg: OpEnvelope): Promise<OpEnvelope> {
    const op = String(msg["op"] ?? "?");
    const sock = await this.connect();
    try {
      const reply = await new Promise<OpEnvelope>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("daemon timeout")), this.timeoutMs);
        let buf = "";
        sock.on("data", (d: Buffer) => {
          buf += d.toString("utf8");
          const { lines, rest } = splitLines(buf);
          buf = rest;
          if (lines.length > 0) {
            clearTimeout(timer);
            try {
              resolve(JSON.parse(lines[0]) as OpEnvelope);
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          }
        });
        sock.once("error", (e: Error) => {
          clearTimeout(timer);
          reject(e);
        });
        sock.write(JSON.stringify({ ...msg, protocol_version: PROTOCOL_VERSION }) + "\n");
      });
      if (!reply["ok"]) {
        throw new Error(`daemon op ${op}: ${String(reply["error"])}`);
      }
      return reply;
    } finally {
      sock.destroy();
    }
  }

  async start(r: StartRequest): Promise<string> {
    const res = await this.call({ op: "start", max_turns: r.max_turns ?? 30, ...r });
    return String(res["run_id"]);
  }

  async status(runID: string): Promise<RunStatus> {
    const res = await this.call({ op: "status", run_id: runID });
    return res as unknown as RunStatus;
  }

  async list(): Promise<RunStatus[]> {
    const res = await this.call({ op: "list" });
    return (res["runs"] ?? []) as RunStatus[];
  }

  async events(runID: string): Promise<AgentEvent[]> {
    const res = await this.call({ op: "events", run_id: runID });
    return (res["events"] ?? []) as AgentEvent[];
  }

  async cancel(runID: string): Promise<void> {
    await this.call({ op: "cancel", run_id: runID });
  }

  async steer(runID: string, message: string): Promise<void> {
    await this.call({ op: "steer", run_id: runID, message });
  }

  async diff(runID: string, path: string): Promise<FileDiff> {
    const res = await this.call({ op: "diff", run_id: runID, path });
    return {
      path: String(res["path"] ?? path),
      diff: String(res["diff"] ?? ""),
    };
  }

  async approve(runID: string, requestID: string, fingerprint: string): Promise<void> {
    await this.call({ op: "approve", run_id: runID, request_id: requestID, fingerprint });
  }

  async deny(runID: string, requestID: string, fingerprint: string, reason = ""): Promise<void> {
    await this.call({ op: "deny", run_id: runID, request_id: requestID, fingerprint, reason });
  }

  async models(provider = "", model = ""): Promise<string[]> {
    const res = await this.call({ op: "models", provider, model });
    return (res["models"] ?? []) as string[];
  }

  async protocol(): Promise<Record<string, unknown>> {
    return this.call({ op: "protocol" });
  }

  /**
   * Subscribe to live events via the push channel (Protocol 0.4.0+).
   * Yields events as they happen and resolves on terminal state.
   */
  async subscribe(
    runID: string,
    fromCursor = 0,
    onEvent: (ev: AgentEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const sock = await this.connect();
    return new Promise((resolve, reject) => {
      let buf = "";
      let acknowledged = false;

      const cleanup = (): void => {
        sock.destroy();
      };

      if (signal) {
        signal.addEventListener("abort", () => {
          cleanup();
          resolve();
        });
      }

      sock.on("data", (d: Buffer) => {
        buf += d.toString("utf8");
        const { lines, rest } = splitLines(buf);
        buf = rest;

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            if (!acknowledged) {
              if (parsed["op"] === "subscribed" && parsed["ok"]) {
                acknowledged = true;
                continue;
              } else if (!parsed["ok"]) {
                cleanup();
                reject(new Error(`subscription rejected: ${String(parsed["error"])}`));
                return;
              }
            }

            // Normal agent event
            const ev = parsed as unknown as AgentEvent;
            if (ev.kind) {
              onEvent(ev);
              if (
                ev.kind === "run.finished" ||
                ev.kind === "run.completed" ||
                ev.kind === "run.failed"
              ) {
                cleanup();
                resolve();
                return;
              }
            }
          } catch (e) {
            // Ignore parse errors on partial stream
          }
        }
      });

      sock.once("error", (err: Error) => {
        cleanup();
        reject(err);
      });

      sock.once("close", () => {
        resolve();
      });

      // Send initial subscribe request
      sock.write(
        JSON.stringify({
          op: "subscribe",
          run_id: runID,
          from: fromCursor,
          protocol_version: PROTOCOL_VERSION,
        }) + "\n",
      );
    });
  }
}

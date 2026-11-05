import type { HijackEngine, Viewer } from "../engine.ts";
import type { BrowserConn, BrowserHub } from "./browser-hub.ts";

export class SnapshotBroadcaster {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly hub: BrowserHub;
  private readonly viewerOf: (conn: BrowserConn) => Viewer;
  private readonly snapshotFor: (conn: BrowserConn, viewer: Viewer) => ReturnType<HijackEngine["snapshot"]>;
  private readonly intervalMs: number;

  constructor(opts: {
    hub: BrowserHub;
    viewerOf: (conn: BrowserConn) => Viewer;
    snapshotFor: (conn: BrowserConn, viewer: Viewer) => ReturnType<HijackEngine["snapshot"]>;
    intervalMs?: number;
  }) {
    this.hub = opts.hub;
    this.viewerOf = opts.viewerOf;
    this.snapshotFor = opts.snapshotFor;
    this.intervalMs = opts.intervalMs ?? 80;
  }

  schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.intervalMs);
  }

  flush(): void {
    for (const conn of this.hub.connections()) this.sendTo(conn);
  }

  sendTo(conn: BrowserConn): void {
    const state = this.snapshotFor(conn, this.viewerOf(conn));
    this.hub.send(conn, "state.snapshot", { state });
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

"use client";

export type AppView = "console" | "docs" | "styles";

type TopNavProps = {
  view: AppView;
  onViewChange: (view: AppView) => void;
};

export function TopNav({ view, onViewChange }: TopNavProps) {
  return (
    <header className="top-nav">
      <button className="wordmark" type="button" onClick={() => onViewChange("console")}>
        Patchline
      </button>

      <nav className="top-nav-links" aria-label="Primary">
        <button
          type="button"
          aria-current={view === "console" ? "page" : undefined}
          onClick={() => onViewChange("console")}
        >
          Console
        </button>
        <a href="#memory" onClick={() => onViewChange("console")}>
          Memory
        </a>
        <a href="#rules" onClick={() => onViewChange("console")}>
          Rules
        </a>
        <a href="#runs" onClick={() => onViewChange("console")}>
          Runs
        </a>
        <button
          type="button"
          aria-current={view === "docs" ? "page" : undefined}
          onClick={() => onViewChange("docs")}
        >
          Docs
        </button>
        <button
          type="button"
          aria-current={view === "styles" ? "page" : undefined}
          onClick={() => onViewChange("styles")}
        >
          Style
        </button>
      </nav>

      <div className="top-nav-right">
        <div className="agent-status" aria-label="Agent status">
          <span className="agent-pill">
            <span className="live-dot" aria-hidden="true" />
            GPT‑5.6 · attacker
          </span>
          <span className="agent-pill">
            <span className="live-dot" aria-hidden="true" />
            Codex · defender
          </span>
        </div>
      </div>
    </header>
  );
}

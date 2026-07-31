export const styles = `
  :host {
    all: initial;
    --sl-bg: #101318;
    --sl-bg-raised: #171b22;
    --sl-border: #303641;
    --sl-text: #f5f7fa;
    --sl-muted: #aeb6c4;
    --sl-accent: #83b7ff;
    --sl-error: #ff918b;
    --sl-warning: #ffd166;
    --sl-info: #87d7c4;
    position: fixed;
    inset: 0 0 0 auto;
    width: min(480px, 80vw);
    z-index: 2147483647;
    color-scheme: dark;
    pointer-events: none;
  }

  :host([hidden]) {
    display: none;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  button {
    font: inherit;
  }

  .panel {
    position: relative;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    border-left: 1px solid var(--sl-border);
    background: var(--sl-bg);
    color: var(--sl-text);
    box-shadow: -12px 0 36px rgb(0 0 0 / 30%);
    font: 14px/1.45 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: auto;
  }

  .resize-handle {
    position: absolute;
    z-index: 2;
    inset: 0 auto 0 -5px;
    width: 10px;
    cursor: ew-resize;
    touch-action: none;
  }

  .resize-handle:focus-visible,
  button:focus-visible {
    outline: 3px solid var(--sl-accent);
    outline-offset: 2px;
  }

  .header {
    display: grid;
    gap: 10px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--sl-border);
  }

  .header-row,
  .counts,
  .tabs,
  .actions,
  .entity-meta,
  .finding-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-row {
    justify-content: space-between;
  }

  h1, h2, h3, p, pre, dl, dd {
    margin: 0;
  }

  h1 {
    font-size: 17px;
  }

  h2 {
    font-size: 16px;
  }

  h3 {
    font-size: 14px;
  }

  .counts {
    flex-wrap: wrap;
    color: var(--sl-muted);
    font-size: 12px;
  }

  .count {
    border: 1px solid var(--sl-border);
    border-radius: 999px;
    padding: 2px 8px;
  }

  .tabs {
    overflow-x: auto;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sl-border);
    background: var(--sl-bg-raised);
  }

  .tab,
  .icon-button,
  .action-button,
  .entity-button {
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tab,
  .action-button {
    padding: 6px 10px;
  }

  .tab[aria-selected="true"] {
    border-color: var(--sl-accent);
    background: rgb(131 183 255 / 12%);
  }

  .icon-button {
    min-width: 32px;
    min-height: 32px;
    padding: 4px 8px;
  }

  .action-button {
    border-color: var(--sl-border);
    background: var(--sl-bg-raised);
  }

  .tab:hover,
  .icon-button:hover,
  .action-button:hover,
  .entity-button:hover {
    background: rgb(255 255 255 / 8%);
  }

  .main {
    min-height: 0;
    overflow: auto;
  }

  .view {
    display: grid;
    gap: 16px;
    padding: 16px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .card,
  .section,
  .script-card {
    border: 1px solid var(--sl-border);
    border-radius: 10px;
    background: var(--sl-bg-raised);
    padding: 12px;
  }

  .card strong {
    display: block;
    font-size: 22px;
  }

  .muted {
    color: var(--sl-muted);
  }

  .entities-layout {
    display: grid;
    grid-template-columns: minmax(150px, 42%) minmax(0, 1fr);
    min-height: 100%;
  }

  .entity-nav {
    overflow: auto;
    border-right: 1px solid var(--sl-border);
    padding: 12px;
  }

  .entity-detail {
    min-width: 0;
    overflow: auto;
    padding: 16px;
  }

  .entity-group + .entity-group {
    margin-top: 14px;
  }

  .entity-button {
    display: grid;
    gap: 3px;
    width: 100%;
    margin-top: 5px;
    padding: 8px;
    text-align: left;
  }

  .entity-button[aria-current="true"] {
    border-color: var(--sl-accent);
    background: rgb(131 183 255 / 12%);
  }

  .entity-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entity-meta,
  .finding-meta {
    color: var(--sl-muted);
    font-size: 11px;
  }

  .detail-stack,
  .finding-list,
  .reference-list,
  .script-list {
    display: grid;
    gap: 10px;
  }

  .detail-stack {
    gap: 16px;
  }

  .definition-list {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 5px 10px;
  }

  .definition-list dt {
    color: var(--sl-muted);
  }

  .definition-list dd {
    overflow-wrap: anywhere;
  }

  pre {
    max-height: 360px;
    overflow: auto;
    border: 1px solid var(--sl-border);
    border-radius: 8px;
    background: #0b0d11;
    padding: 10px;
    color: #dbe7f5;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .finding,
  .reference {
    border-left: 3px solid var(--sl-info);
    padding: 8px 10px;
    background: rgb(255 255 255 / 4%);
  }

  .finding[data-severity="error"] {
    border-color: var(--sl-error);
  }

  .finding[data-severity="warning"] {
    border-color: var(--sl-warning);
  }

  .status-error {
    color: var(--sl-error);
  }

  .status-warning {
    color: var(--sl-warning);
  }

  .status-info {
    color: var(--sl-info);
  }

  .live-region {
    min-height: 1.4em;
    color: var(--sl-muted);
    font-size: 12px;
  }

  .empty {
    color: var(--sl-muted);
    padding: 24px 4px;
    text-align: center;
  }

  @media (max-width: 640px) {
    :host {
      inset: 8px;
      width: auto !important;
    }

    .panel {
      height: calc(100dvh - 16px);
      border: 1px solid var(--sl-border);
      border-radius: 12px;
    }

    .resize-handle {
      display: none;
    }

    .entities-layout {
      grid-template-columns: 1fr;
    }

    .entity-nav {
      max-height: 34dvh;
      border-right: 0;
      border-bottom: 1px solid var(--sl-border);
    }
  }
`;

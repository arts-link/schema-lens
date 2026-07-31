import {
  createSchemaObserver,
  inspectDocument,
  OVERLAY_HOST_ATTRIBUTE,
  serializeInspectionResult,
  type InspectionResult,
  type InspectedEntity,
  type SchemaFinding,
  type SchemaObserver,
} from "@schema-lens/core";

import { styles } from "./styles.js";
import type { SchemaInspector, SchemaInspectorOptions } from "./types.js";

type ViewName = "summary" | "entities" | "scripts";

export function createSchemaInspector(options: SchemaInspectorOptions): SchemaInspector {
  const document = options.document;
  const browsingWindow = document.defaultView;
  if (!browsingWindow) throw new Error("Schema Lens requires a document with a browsing context.");
  const activeWindow: Window = browsingWindow;

  const host = document.createElement("div");
  host.setAttribute(OVERLAY_HOST_ATTRIBUTE, "");
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const panel = element(document, "section", "panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "schema-lens-title");
  panel.tabIndex = -1;

  const resizeHandle = element(document, "div", "resize-handle");
  resizeHandle.tabIndex = 0;
  resizeHandle.setAttribute("role", "separator");
  resizeHandle.setAttribute("aria-orientation", "vertical");
  resizeHandle.setAttribute("aria-label", "Resize Schema Lens panel");
  resizeHandle.setAttribute("aria-valuemin", "320");
  resizeHandle.setAttribute("aria-valuemax", String(Math.round(activeWindow.innerWidth * 0.8)));
  resizeHandle.setAttribute("aria-valuenow", "480");

  const header = element(document, "header", "header");
  const headerRow = element(document, "div", "header-row");
  const title = element(document, "h1");
  title.id = "schema-lens-title";
  title.textContent = "Schema Lens";
  const headerActions = element(document, "div", "actions");
  const refreshButton = button(document, "Refresh inspection", "Refresh");
  const copyButton = button(document, "Copy full inspection", "Copy");
  const closeButton = button(document, "Close Schema Lens", "Close");
  headerActions.append(refreshButton, copyButton, closeButton);
  headerRow.append(title, headerActions);
  const counts = element(document, "div", "counts");
  const liveRegion = element(document, "div", "live-region");
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");
  header.append(headerRow, counts, liveRegion);

  const tabs = element(document, "div", "tabs");
  tabs.setAttribute("role", "tablist");
  const main = element(document, "main", "main");
  main.id = "schema-lens-view";
  panel.append(resizeHandle, header, tabs, main);
  shadow.append(style, panel);
  (document.body ?? document.documentElement).append(host);

  let result = inspectDocument(document, options.rules ? { rules: options.rules } : {});
  let selectedKey: string | undefined = result.entities[0]?.key;
  let activeView: ViewName = "summary";
  let observer: SchemaObserver | undefined;
  let destroyed = false;
  let previousFocus: Element | null = null;
  let resizing = false;

  const updateResult = (nextResult: InspectionResult): void => {
    const previousEntity = result.entities.find((entity) => entity.key === selectedKey);
    result = nextResult;
    if (previousEntity?.id) {
      const matches = result.entities.filter((entity) => entity.id === previousEntity.id);
      if (matches.length === 1) selectedKey = matches[0]!.key;
    }
    if (!result.entities.some((entity) => entity.key === selectedKey)) {
      selectedKey = result.entities[0]?.key;
    }
    render();
  };

  const refresh = (): InspectionResult => {
    ensureAlive();
    if (observer) return observer.refresh();
    const next = inspectDocument(document, options.rules ? { rules: options.rules } : {});
    updateResult(next);
    return next;
  };

  refreshButton.addEventListener("click", refresh);
  copyButton.addEventListener("click", () => {
    void copyText(
      activeWindow,
      JSON.stringify(serializeInspectionResult(result), null, 2),
      liveRegion,
      "Inspection copied.",
    );
  });
  closeButton.addEventListener("click", close);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  panel.addEventListener("keydown", onKeyDown);

  const onPointerMove = (event: PointerEvent): void => {
    if (!resizing) return;
    const width = Math.min(
      Math.max(activeWindow.innerWidth - event.clientX, 320),
      activeWindow.innerWidth * 0.8,
    );
    host.style.width = `${String(Math.round(width))}px`;
    resizeHandle.setAttribute("aria-valuenow", String(Math.round(width)));
  };
  const stopResizing = (): void => {
    resizing = false;
  };
  resizeHandle.addEventListener("pointerdown", (event) => {
    resizing = true;
    resizeHandle.setPointerCapture?.(event.pointerId);
  });
  activeWindow.addEventListener("pointermove", onPointerMove);
  activeWindow.addEventListener("pointerup", stopResizing);

  if (options.observeChanges ?? true) {
    observer = createSchemaObserver(document, updateResult, {
      ...(options.rules ? { rules: options.rules } : {}),
      ...(options.debounceMs === undefined ? {} : { debounceMs: options.debounceMs }),
    });
  }

  render();

  return {
    open,
    close,
    toggle(): void {
      ensureAlive();
      if (host.hidden) open();
      else close();
    },
    refresh,
    getResult(): InspectionResult {
      ensureAlive();
      return result;
    },
    destroy(): void {
      if (destroyed) return;
      observer?.disconnect();
      observer = undefined;
      activeWindow.removeEventListener("pointermove", onPointerMove);
      activeWindow.removeEventListener("pointerup", stopResizing);
      panel.removeEventListener("keydown", onKeyDown);
      host.remove();
      destroyed = true;
      previousFocus = null;
    },
  };

  function open(): void {
    ensureAlive();
    if (!host.hidden) return;
    previousFocus = document.activeElement;
    host.hidden = false;
    panel.focus();
  }

  function close(): void {
    ensureAlive();
    if (host.hidden) return;
    host.hidden = true;
    if (previousFocus?.isConnected && "focus" in previousFocus) {
      (previousFocus as HTMLElement).focus();
    }
    previousFocus = null;
  }

  function ensureAlive(): void {
    if (destroyed) throw new Error("This Schema Lens inspector has been destroyed.");
  }

  function render(): void {
    renderCounts(document, counts, result);
    renderTabs();
    main.replaceChildren();
    if (activeView === "summary") main.append(renderSummary(document, result));
    if (activeView === "entities") main.append(renderEntities());
    if (activeView === "scripts") main.append(renderScripts());
  }

  function renderTabs(): void {
    tabs.replaceChildren();
    const definitions: [ViewName, string][] = [
      ["summary", "Summary"],
      ["entities", `Entities (${String(result.summary.entityCount)})`],
      ["scripts", `Scripts (${String(result.summary.scriptCount)})`],
    ];
    for (const [view, label] of definitions) {
      const tab = button(document, `Show ${label}`, label, "tab");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(activeView === view));
      tab.setAttribute("aria-controls", main.id);
      tab.addEventListener("click", () => {
        activeView = view;
        render();
      });
      tabs.append(tab);
    }
  }

  function renderEntities(): HTMLElement {
    if (result.entities.length === 0) return emptyState(document, "No entities found.");
    const layout = element(document, "div", "entities-layout");
    const nav = element(document, "nav", "entity-nav");
    nav.setAttribute("aria-label", "Schema entities");
    const detail = element(document, "section", "entity-detail");
    const groups = groupEntities(result.entities);

    for (const [groupName, entities] of groups) {
      const group = element(document, "section", "entity-group");
      const heading = element(document, "h3");
      heading.textContent = `${groupName} (${String(entities.length)})`;
      group.append(heading);
      for (const entity of entities) {
        const entityButton = button(
          document,
          `Inspect ${entityLabel(entity)}`,
          "",
          "entity-button",
        );
        entityButton.setAttribute("aria-current", String(entity.key === selectedKey));
        const label = element(document, "span", "entity-label");
        label.textContent = entityLabel(entity);
        const meta = element(document, "span", "entity-meta");
        meta.textContent = `Script ${String(entity.scriptIndex + 1)} · ${severityLabel(entity.findings)}`;
        entityButton.append(label, meta);
        entityButton.addEventListener("click", () => {
          selectedKey = entity.key;
          render();
        });
        group.append(entityButton);
      }
      nav.append(group);
    }

    const selected = result.entities.find((entity) => entity.key === selectedKey);
    detail.append(
      selected ? renderEntityDetail(selected) : emptyState(document, "Select an entity."),
    );
    layout.append(nav, detail);
    return layout;
  }

  function renderEntityDetail(entity: InspectedEntity): HTMLElement {
    const stack = element(document, "div", "detail-stack");
    const heading = element(document, "h2");
    heading.textContent = entityLabel(entity);
    const actions = element(document, "div", "actions");
    const copyEntity = button(document, "Copy selected entity JSON", "Copy JSON", "action-button");
    copyEntity.addEventListener("click", () => {
      void copyText(
        activeWindow,
        JSON.stringify(entity.value, null, 2),
        liveRegion,
        "Entity JSON copied.",
      );
    });
    const logSource = button(document, "Log source script element", "Log source", "action-button");
    logSource.addEventListener("click", () => {
      console.log("Schema Lens source script", result.scripts[entity.scriptIndex]?.element);
      liveRegion.textContent = "Source script logged to the console.";
    });
    actions.append(copyEntity, logSource);

    const definition = element(document, "dl", "definition-list");
    appendDefinition(document, definition, "Types", entity.types.join(", ") || "Untyped");
    appendDefinition(document, definition, "@id", entity.id ?? "None");
    appendDefinition(document, definition, "Script", String(entity.scriptIndex + 1));
    appendDefinition(document, definition, "Path", entity.path || "/");
    const json = element(document, "pre");
    json.textContent = JSON.stringify(entity.value, null, 2);

    stack.append(heading, actions, definition, section(document, "JSON", json));
    stack.append(
      section(document, "Findings", renderFindings(document, entity.findings)),
      section(
        document,
        "Incoming references",
        renderReferences(document, entity.inboundReferences, "No incoming references."),
      ),
      section(
        document,
        "Outgoing references",
        renderReferences(document, entity.outboundReferences, "No outgoing references."),
      ),
    );
    return stack;
  }

  function renderScripts(): HTMLElement {
    if (result.scripts.length === 0) return emptyState(document, "No JSON-LD scripts found.");
    const list = element(document, "div", "view script-list");
    for (const script of result.scripts) {
      const card = element(document, "article", "script-card");
      const heading = element(document, "h2");
      heading.textContent = `Script ${String(script.index + 1)}`;
      const meta = element(document, "p", "muted");
      meta.textContent = `${capitalize(script.status)} · ${String(script.entities.length)} entities · ${String(script.findings.length)} findings`;
      const log = button(
        document,
        `Log source for script ${String(script.index + 1)}`,
        "Log source",
        "action-button",
      );
      log.addEventListener("click", () => {
        console.log("Schema Lens source script", script.element);
        liveRegion.textContent = `Script ${String(script.index + 1)} logged to the console.`;
      });
      const raw = element(document, "pre");
      raw.textContent = script.rawText;
      card.append(heading, meta, log, renderFindings(document, script.findings), raw);
      list.append(card);
    }
    return list;
  }
}

function renderCounts(document: Document, container: HTMLElement, result: InspectionResult): void {
  container.replaceChildren();
  const values = [
    `${String(result.summary.entityCount)} entities`,
    `${String(result.summary.errorCount)} errors`,
    `${String(result.summary.warningCount)} warnings`,
  ];
  for (const value of values) {
    const count = element(document, "span", "count");
    count.textContent = value;
    container.append(count);
  }
}

function renderSummary(document: Document, result: InspectionResult): HTMLElement {
  const view = element(document, "div", "view");
  const grid = element(document, "div", "summary-grid");
  const cards: [string, number][] = [
    ["Scripts", result.summary.scriptCount],
    ["Entities", result.summary.entityCount],
    ["Errors", result.summary.errorCount],
    ["Warnings", result.summary.warningCount],
    ["Duplicate IDs", result.summary.duplicateIdCount],
    ["Unresolved references", result.summary.unresolvedReferenceCount],
  ];
  for (const [label, value] of cards) {
    const card = element(document, "div", "card");
    const number = element(document, "strong");
    number.textContent = String(value);
    const caption = element(document, "span", "muted");
    caption.textContent = label;
    card.append(number, caption);
    grid.append(card);
  }
  const types = element(document, "p");
  types.textContent = result.summary.types.join(", ") || "None";
  view.append(grid, section(document, "Types found", types));
  view.append(section(document, "Page findings", renderFindings(document, result.findings)));
  return view;
}

function renderFindings(document: Document, findings: readonly SchemaFinding[]): HTMLElement {
  if (findings.length === 0) return emptyState(document, "No findings.");
  const list = element(document, "div", "finding-list");
  for (const finding of findings) {
    const item = element(document, "div", "finding");
    item.dataset["severity"] = finding.severity;
    const message = element(document, "p");
    message.textContent = finding.message;
    const meta = element(document, "div", "finding-meta");
    const severity = element(document, "strong", `status-${finding.severity}`);
    severity.textContent = capitalize(finding.severity);
    const location = element(document, "span");
    location.textContent = `${finding.ruleId}${finding.path === undefined ? "" : ` · ${finding.path || "/"}`}`;
    meta.append(severity, location);
    item.append(message, meta);
    list.append(item);
  }
  return list;
}

function renderReferences(
  document: Document,
  references: readonly {
    targetId: string;
    status: string;
    propertyPath: string;
  }[],
  emptyMessage: string,
): HTMLElement {
  if (references.length === 0) return emptyState(document, emptyMessage);
  const list = element(document, "div", "reference-list");
  for (const reference of references) {
    const item = element(document, "div", "reference");
    const label = element(document, "p");
    label.textContent = reference.targetId;
    const meta = element(document, "div", "finding-meta");
    meta.textContent = `${capitalize(reference.status)} · ${reference.propertyPath || "/"}`;
    item.append(label, meta);
    list.append(item);
  }
  return list;
}

function groupEntities(entities: readonly InspectedEntity[]): Map<string, InspectedEntity[]> {
  const groups = new Map<string, InspectedEntity[]>();
  for (const entity of entities) {
    const types = entity.types.length > 0 ? entity.types : ["Untyped"];
    for (const type of types) {
      const group = groups.get(type) ?? [];
      group.push(entity);
      groups.set(type, group);
    }
  }
  return new Map([...groups].sort(([a], [b]) => a.localeCompare(b)));
}

function entityLabel(entity: InspectedEntity): string {
  for (const property of ["name", "headline", "url"] as const) {
    const value = entity.value[property];
    if (typeof value === "string" && value.trim()) return value;
  }
  return entity.id ?? entity.key;
}

function severityLabel(findings: readonly SchemaFinding[]): string {
  if (findings.some((finding) => finding.severity === "error")) return "Error";
  if (findings.some((finding) => finding.severity === "warning")) return "Warning";
  if (findings.some((finding) => finding.severity === "info")) return "Info";
  return "No findings";
}

function section(document: Document, headingText: string, content: Node): HTMLElement {
  const wrapper = element(document, "section", "section");
  const heading = element(document, "h2");
  heading.textContent = headingText;
  wrapper.append(heading, content);
  return wrapper;
}

function appendDefinition(
  document: Document,
  list: HTMLDListElement,
  term: string,
  value: string,
): void {
  const dt = element(document, "dt");
  dt.textContent = term;
  const dd = element(document, "dd");
  dd.textContent = value;
  list.append(dt, dd);
}

function emptyState(document: Document, message: string): HTMLElement {
  const empty = element(document, "p", "empty");
  empty.textContent = message;
  return empty;
}

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function button(
  document: Document,
  accessibleName: string,
  text: string,
  className = "icon-button",
): HTMLButtonElement {
  const control = element(document, "button", className);
  control.type = "button";
  control.setAttribute("aria-label", accessibleName);
  control.textContent = text;
  return control;
}

async function copyText(
  window: Window,
  text: string,
  liveRegion: HTMLElement,
  successMessage: string,
): Promise<void> {
  try {
    if (!window.navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await window.navigator.clipboard.writeText(text);
    liveRegion.textContent = successMessage;
  } catch {
    liveRegion.textContent = "Copy failed. Clipboard permission may be unavailable.";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

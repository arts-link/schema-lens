import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSchemaInspector } from "../src/index.js";

function addScript(value: string): HTMLScriptElement {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = value;
  document.body.append(script);
  return script;
}

function shadowRoot(): ShadowRoot {
  const host = document.querySelector("[data-schema-lens-overlay-host]");
  if (!host?.shadowRoot) throw new Error("Overlay shadow root was not created.");
  return host.shadowRoot;
}

function findButton(root: ParentNode, name: string): HTMLButtonElement {
  const control = [...root.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === name || button.textContent === name,
  );
  if (!(control instanceof HTMLButtonElement)) throw new Error(`Button "${name}" not found.`);
  return control;
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("createSchemaInspector", () => {
  it("opens, closes, toggles, and restores focus", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Trigger";
    document.body.append(trigger);
    trigger.focus();
    const inspector = createSchemaInspector({ document, observeChanges: false });
    const host = document.querySelector<HTMLElement>("[data-schema-lens-overlay-host]")!;

    expect(host.hidden).toBe(true);
    inspector.open();
    expect(host.hidden).toBe(false);
    expect(shadowRoot().activeElement?.classList.contains("panel")).toBe(true);

    inspector.close();
    expect(host.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    inspector.toggle();
    expect(host.hidden).toBe(false);
    inspector.destroy();
  });

  it("closes with Escape", () => {
    const inspector = createSchemaInspector({ document, observeChanges: false });
    inspector.open();
    const host = document.querySelector<HTMLElement>("[data-schema-lens-overlay-host]")!;
    const panel = shadowRoot().querySelector(".panel")!;

    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(host.hidden).toBe(true);
    inspector.destroy();
  });

  it("navigates entities and renders details as inert text", () => {
    addScript(`[
      {"@id":"#article","@type":["Article","CreativeWork"],"headline":"Story <img src=x>"},
      {"@id":"#person","@type":"Person","name":"Ada"}
    ]`);
    const inspector = createSchemaInspector({ document, observeChanges: false });
    inspector.open();
    const root = shadowRoot();

    findButton(root, "Show Entities (2)").click();
    findButton(root, "Inspect Story <img src=x>").click();

    expect(root.querySelector(".entity-detail")?.textContent).toContain("Story <img src=x>");
    expect(root.querySelector(".entity-detail img")).toBeNull();
    expect(root.querySelectorAll(".entity-group")).toHaveLength(3);
    inspector.destroy();
  });

  it("renders script status and logs the source element", () => {
    const script = addScript("{broken");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const inspector = createSchemaInspector({ document, observeChanges: false });
    inspector.open();
    const root = shadowRoot();

    findButton(root, "Show Scripts (1)").click();
    findButton(root, "Log source for script 1").click();

    expect(root.textContent).toContain("Invalid");
    expect(log).toHaveBeenCalledWith("Schema Lens source script", script);
    log.mockRestore();
    inspector.destroy();
  });

  it("copies a serialized inspection and selected entity JSON", async () => {
    addScript('{"@id":"#person","@type":"Person","name":"Ada"}');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const inspector = createSchemaInspector({ document, observeChanges: false });
    inspector.open();
    const root = shadowRoot();

    findButton(root, "Copy full inspection").click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining('"element"'));

    findButton(root, "Show Entities (1)").click();
    findButton(root, "Copy selected entity JSON").click();
    await Promise.resolve();
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"name": "Ada"'));
    inspector.destroy();
  });

  it("refreshes and preserves selection by unique ID", () => {
    const script = addScript(`[
      {"@id":"#a","@type":"Person","name":"A"},
      {"@id":"#b","@type":"Person","name":"B"}
    ]`);
    const inspector = createSchemaInspector({ document, observeChanges: false });
    inspector.open();
    const root = shadowRoot();
    findButton(root, "Show Entities (2)").click();
    findButton(root, "Inspect B").click();

    script.textContent = `[
      {"@id":"#new","@type":"Thing"},
      {"@id":"#b","@type":"Person","name":"B updated"}
    ]`;
    inspector.refresh();

    expect(root.querySelector(".entity-detail")?.textContent).toContain("B updated");
    inspector.destroy();
  });

  it("removes the host and makes destroyed instances unusable", () => {
    const inspector = createSchemaInspector({ document, observeChanges: true });

    inspector.destroy();
    inspector.destroy();

    expect(document.querySelector("[data-schema-lens-overlay-host]")).toBeNull();
    expect(() => inspector.open()).toThrow(/destroyed/);
  });

  it("has no basic automated accessibility violations when open", async () => {
    addScript('{"@type":"Person","name":"Ada"}');
    const inspector = createSchemaInspector({ document, observeChanges: false });
    inspector.open();

    const results = await axe.run(shadowRoot() as unknown as Element, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
    inspector.destroy();
  });
});

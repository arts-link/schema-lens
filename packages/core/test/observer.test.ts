import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSchemaObserver, type InspectionResult } from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  document.body.replaceChildren();
});

describe("createSchemaObserver", () => {
  it("reports the initial result and refreshes manually", () => {
    const callback = vi.fn<(result: InspectionResult) => void>();
    const observer = createSchemaObserver(document, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = '{"@type":"Thing"}';
    document.body.append(script);

    expect(observer.refresh().summary.entityCount).toBe(1);
    expect(callback).toHaveBeenCalledTimes(2);
    observer.disconnect();
  });

  it("debounces insertions, text changes, removals, and type changes", async () => {
    vi.useFakeTimers();
    const callback = vi.fn<(result: InspectionResult) => void>();
    const observer = createSchemaObserver(document, callback, { debounceMs: 25 });
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = '{"@type":"Thing"}';
    document.body.append(script);
    script.textContent = '{"@type":"Person"}';

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.lastCall?.[0].entities[0]?.types).toEqual(["Person"]);

    script.type = "application/json";
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);
    expect(callback.mock.lastCall?.[0].summary.entityCount).toBe(0);

    script.remove();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);
    expect(callback).toHaveBeenCalledTimes(4);
    observer.disconnect();
  });

  it("cancels pending work when disconnected", async () => {
    vi.useFakeTimers();
    const callback = vi.fn<(result: InspectionResult) => void>();
    const observer = createSchemaObserver(document, callback, { debounceMs: 25 });
    document.body.append(document.createElement("div"));
    observer.disconnect();

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores overlay-host-only mutations", async () => {
    vi.useFakeTimers();
    const callback = vi.fn<(result: InspectionResult) => void>();
    const observer = createSchemaObserver(document, callback, { debounceMs: 25 });
    const host = document.createElement("div");
    host.setAttribute("data-schema-lens-overlay-host", "");
    document.body.append(host);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);
    expect(callback).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });
});

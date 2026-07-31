import { inspectDocument } from "./inspect.js";
import type { InspectionResult, ObserverOptions, SchemaObserver } from "./types.js";

const OVERLAY_HOST_ATTRIBUTE = "data-schema-lens-overlay-host";

export function createSchemaObserver(
  document: Document,
  callback: (result: InspectionResult) => void,
  options: ObserverOptions = {},
): SchemaObserver {
  const debounceMs = Math.max(0, options.debounceMs ?? 100);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disconnected = false;

  const inspect = (): InspectionResult => {
    const result = inspectDocument(
      document,
      options.rules === undefined ? {} : { rules: options.rules },
    );
    callback(result);
    return result;
  };

  const observer = new MutationObserver((mutations) => {
    if (disconnected || mutations.every(isOverlayOnlyMutation)) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!disconnected) inspect();
    }, debounceMs);
  });

  const root = document.documentElement;
  if (root) {
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["type"],
    });
  }

  inspect();

  return {
    refresh(): InspectionResult {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      return inspect();
    },
    disconnect(): void {
      if (disconnected) return;
      disconnected = true;
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

function isOverlayOnlyMutation(mutation: MutationRecord): boolean {
  if (isInsideOverlay(mutation.target)) return true;
  if (mutation.type !== "childList") return false;
  const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
  return changedNodes.length > 0 && changedNodes.every(isInsideOverlay);
}

function isInsideOverlay(node: Node): boolean {
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  return Boolean(element?.closest(`[${OVERLAY_HOST_ATTRIBUTE}]`));
}

export { OVERLAY_HOST_ATTRIBUTE };

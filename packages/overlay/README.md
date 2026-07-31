# `@arts-link/schema-lens-overlay`

An accessible, framework-free Shadow DOM inspector for `@arts-link/schema-lens-core`.

```ts
import { createSchemaInspector } from "@arts-link/schema-lens-overlay";

const inspector = createSchemaInspector({
  document,
  observeChanges: true,
  debounceMs: 100,
});

inspector.open();
```

## Interface

```ts
interface SchemaInspector {
  open(): void;
  close(): void;
  toggle(): void;
  refresh(): InspectionResult;
  getResult(): InspectionResult;
  destroy(): void;
}
```

The right-side panel is resizable and switches to a nearly full-width layout on narrow screens. It provides:

- Page summary and aggregate findings
- Entity navigation grouped by every `@type`
- Entity JSON, location, findings, and references
- Script parse status, findings, raw text, and source logging
- Full-result and selected-entity copy actions
- Debounced live updates with selection preservation

Escape closes the panel. Opening captures focus, closing restores it, controls have accessible names and visible focus states, and status is communicated with text as well as color.

`destroy()` is idempotent. Other method calls after destruction throw because the instance no longer owns a usable DOM surface.

The overlay never executes schema content, sends network requests, injects schema strings as HTML, modifies page JSON-LD, or publishes internal state globally.

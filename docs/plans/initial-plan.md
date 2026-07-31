# Build an open-source browser-based JSON-LD inspector

Create a new open-source TypeScript project for inspecting Schema.org JSON-LD rendered on the current webpage.

The project should provide a reusable core library and an optional browser overlay. It must remain framework-independent so it can later be imported by Astro themes, CMS projects, browser extensions, test suites, and other frontend applications.

Use the temporary project name:

```text
schema-lens
```

Do not include any Ryder-specific behavior in the core project. Ryder will consume this package later and supply its own custom validation rules.

## Primary goal

Build a lightweight developer tool that can:

1. Find every `<script type="application/ld+json">` element in the current document.
2. Parse each script independently.
3. Normalize single objects, arrays, and `@graph` structures into a consistent entity model.
4. identify entities by `@id` and `@type`.
5. Build relationships between entities that reference each other through `@id`.
6. Report parsing, structural, duplicate-ID, and unresolved-reference problems.
7. Display the results in an isolated on-page debugging panel.
8. Observe the DOM for JSON-LD added, removed, or changed after page load.
9. Allow consuming applications to register custom inspection rules.

This is an inspection and debugging tool. It must not claim to duplicate Google Rich Results Test or provide a guarantee of search-engine eligibility.

## Technical requirements

Use:

- TypeScript
- pnpm
- Vite
- Vitest
- ESLint
- Prettier
- Changesets for package versioning
- npm-compatible package output
- ESM-first builds
- Shadow DOM for overlay isolation
- No frontend framework for the initial overlay

Use a pnpm workspace with this structure:

```text
schema-lens/
  packages/
    core/
    overlay/
  examples/
    basic/
  docs/
  .changeset/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  eslint.config.js
  README.md
  LICENSE
```

Use the MIT license.

## Package design

### `@schema-lens/core`

This package must contain all parsing, normalization, graph construction, and validation logic.

It should not depend on a frontend framework.

Its main public API should resemble:

```ts
import {
  inspectDocument,
  inspectScripts,
  createSchemaObserver,
} from "@schema-lens/core";
```

Proposed functions:

```ts
function inspectDocument(
  document: Document,
  options?: InspectionOptions,
): InspectionResult;

function inspectScripts(
  scripts: Iterable<HTMLScriptElement>,
  options?: InspectionOptions,
): InspectionResult;

function createSchemaObserver(
  document: Document,
  callback: (result: InspectionResult) => void,
  options?: ObserverOptions,
): SchemaObserver;
```

`createSchemaObserver` should expose:

```ts
interface SchemaObserver {
  refresh(): InspectionResult;
  disconnect(): void;
}
```

### `@schema-lens/overlay`

This package should provide an isolated browser UI built on top of the core package.

Its public API should resemble:

```ts
import { createSchemaInspector } from "@schema-lens/overlay";

const inspector = createSchemaInspector({
  document,
  observeChanges: true,
});

inspector.open();
```

The returned object should expose:

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

`destroy()` must remove the overlay, disconnect observers, remove event listeners, and clean up all created DOM nodes.

## Core data model

Design a clear internal and public type model.

Start with interfaces similar to these, but adjust them where necessary after implementation:

```ts
type JsonObject = Record<string, unknown>;

interface SchemaScriptResult {
  index: number;
  element: HTMLScriptElement;
  rawText: string;
  parsedValue?: unknown;
  entities: InspectedEntity[];
  findings: SchemaFinding[];
}

interface InspectedEntity {
  key: string;
  id?: string;
  types: string[];
  value: JsonObject;
  scriptIndex: number;
  path: string;
  sourceElement: HTMLScriptElement;
  inboundReferences: EntityReference[];
  outboundReferences: EntityReference[];
  findings: SchemaFinding[];
}

interface EntityReference {
  sourceKey: string;
  targetId: string;
  propertyPath: string;
  resolvedTargetKey?: string;
}

type FindingSeverity = "error" | "warning" | "info";

interface SchemaFinding {
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  scriptIndex?: number;
  entityKey?: string;
  path?: string;
}

interface InspectionResult {
  scripts: SchemaScriptResult[];
  entities: InspectedEntity[];
  findings: SchemaFinding[];
  summary: InspectionSummary;
}
```

The final model should avoid circular object references where possible so results can be serialized, logged, and tested easily.

## JSON-LD collection and parsing

Find scripts using:

```ts
document.querySelectorAll(
  'script[type="application/ld+json"]',
);
```

Treat each script independently. One malformed script must not prevent inspection of valid scripts elsewhere on the page.

Support:

- One top-level JSON object
- A top-level array
- An object containing `@graph`
- Nested entity objects
- Reference-only objects such as `{ "@id": "#organization" }`
- Multiple types in `@type`
- Multiple JSON-LD script elements
- Empty scripts
- Invalid JSON
- Leading and trailing whitespace

Do not use `eval`, `Function`, or permissive JavaScript parsing. JSON-LD script contents must be parsed as JSON.

## Entity normalization

Normalize inspectable entities into a flat collection while preserving:

- Original script index
- Object path
- Original object value
- `@id`
- One or more `@type` values
- Source script element

Use stable generated keys for entities without `@id`.

Do not silently merge entities that share the same `@id`. Preserve every definition and report duplicates or conflicts.

Handle `@graph` entries as first-class entities.

Avoid treating every nested object as an independent entity. A nested object should normally become an entity when it has an `@id`, an `@type`, or appears as a top-level or `@graph` entry.

Document the exact normalization rules in the package README.

## Reference graph

Recursively inspect entity property values for objects containing `@id`.

Create outbound references with:

- Source entity
- Target `@id`
- Property path
- Resolved target when exactly one match exists

Create corresponding inbound reference information.

Report:

- Unresolved local references
- References with multiple possible targets because of duplicate IDs
- Self-references as informational findings, not errors
- Duplicate `@id` definitions
- Potentially conflicting definitions using the same `@id`

Treat absolute URLs, fragment IDs, and relative IDs as strings. Do not attempt full remote JSON-LD expansion in version 0.1.

## Built-in rules

Implement deterministic rules only.

### Script-level rules

- Invalid JSON
- Empty JSON-LD script
- Unsupported top-level primitive
- Invalid `@graph` value
- No entities found in a valid script

### Entity-level rules

- Missing `@type`
- Empty or invalid `@type`
- Empty `@id`
- Invalid `@id` value type
- Duplicate `@id`
- Unresolved `@id` reference
- Ambiguous reference caused by duplicate IDs
- Properties with `undefined`, `null`, or empty-string values
- Empty arrays
- Invalid URL values for a small documented list of common URL properties
- Invalid date strings for common date properties

Do not describe optional Schema.org properties as universally required.

### Common-type advisory rules

Add modest advisory checks for:

- `Article`
- `BlogPosting`
- `NewsArticle`
- `Product`
- `Offer`
- `BreadcrumbList`
- `ListItem`
- `WebPage`
- `WebSite`
- `Organization`
- `Person`
- `ImageObject`

These findings should be labeled as general diagnostics, not as definitive Schema.org or Google errors.

Examples:

- Article-like entity has no `headline`
- Article-like entity has no `author`
- Product has no `name`
- BreadcrumbList has no `itemListElement`
- ListItem has no `position`
- Duplicate breadcrumb positions
- Organization has neither `name` nor `legalName`

Keep rules small, testable, and documented.

## Custom rule API

Allow consumers to add custom rules without modifying the package.

Design an API similar to:

```ts
interface InspectorRule {
  id: string;
  description?: string;
  inspect(context: RuleContext): SchemaFinding[];
}
```

Support both:

- Rules that inspect the full result
- Rules that inspect one entity at a time

Example usage:

```ts
const result = inspectDocument(document, {
  rules: [
    {
      id: "project/article-required",
      inspect(context) {
        // Consumer-specific checks
        return [];
      },
    },
  ],
});
```

Built-in and custom rule IDs must remain distinguishable.

A custom rule throwing an exception must produce a contained diagnostic and must not stop other rules from running.

## Overlay interface

Create a fixed, resizable debugging panel using Shadow DOM.

The overlay should not inherit host-page styles and should avoid affecting the page layout.

The first version should provide:

### Header

- Project name
- Refresh button
- Copy button
- Close button
- Entity, warning, and error counts

### Navigation

- Group entities by `@type`
- Show untyped entities separately
- Display an entity label selected from `name`, `headline`, `url`, `@id`, or generated key
- Show severity indicators
- Show script index

### Detail view

For the selected entity, show:

- Entity summary
- `@type`
- `@id`
- Formatted JSON
- Findings
- Incoming references
- Outgoing references
- Script index
- Original object path
- A button that logs the source script element to the console
- A button that copies the selected entity JSON

### Script view

Provide a separate view listing each JSON-LD script:

- Script index
- Parsing status
- Entity count
- Findings
- Raw text
- Source-element logging action

### Page summary

Show:

- Number of scripts
- Number of entities
- Types found
- Errors
- Warnings
- Duplicate IDs
- Unresolved references

## Accessibility

The overlay must:

- Be keyboard navigable
- Use semantic controls
- Have visible focus states
- Provide accessible labels
- Avoid using color as the only status indicator
- Allow Escape to close the panel
- Preserve focus appropriately when opened and closed
- Use a reasonable minimum text size
- Remain usable at narrow viewport widths

## MutationObserver behavior

When `observeChanges` is enabled:

- Watch for JSON-LD scripts being added or removed
- Watch for script text changes
- Debounce repeated mutations
- Refresh the inspection result
- Preserve the selected entity when possible
- Avoid observing the overlay’s own Shadow DOM
- Disconnect cleanly during `destroy()`

Do not perform continuous polling.

## Security and privacy

The package must:

- Make no network requests by default
- Never transmit schema data
- Never execute script contents
- Render JSON as text, not HTML
- Avoid unsafe `innerHTML` usage
- Protect against malicious strings in schema values
- Avoid modifying the page’s JSON-LD
- Avoid exposing private internal state globally unless the consumer explicitly chooses to do so

## Bundle and dependency goals

Keep dependencies minimal.

Targets:

- Core package should be small and tree-shakeable
- Overlay should be lazy-loadable
- No React, Vue, Svelte, or other UI framework in version 0.1
- Avoid bundling a complete Schema.org vocabulary initially
- Avoid adding a heavyweight JSON-LD processor unless clearly justified
- Browser support should include current Chrome, Firefox, Safari, and Edge

Add a bundle-size report or documented bundle-size check.

## Example application

Create `examples/basic` with a Vite page containing:

- Valid Article schema
- A `@graph`
- Linked WebPage, WebSite, and Organization entities
- Duplicate IDs
- An unresolved reference
- An invalid JSON block
- A button that dynamically adds JSON-LD
- A button that modifies existing JSON-LD
- A button that removes a JSON-LD script
- A button that opens the inspector

The example should make every important feature easy to test manually.

## Tests

Use Vitest with a DOM-capable test environment.

Add comprehensive tests for:

### Parsing

- Single object
- Top-level array
- `@graph`
- Invalid JSON
- Empty script
- Multiple scripts
- Primitive top-level values

### Normalization

- Typed entities
- ID-only references
- Nested entities
- Generated keys
- Multiple `@type` values
- Duplicate IDs
- Paths and script indexes

### Graph construction

- Resolved references
- Unresolved references
- Ambiguous references
- Inbound and outbound links
- Self-reference
- Nested reference paths

### Rules

- Every built-in rule
- Custom rules
- Custom-rule failure isolation
- Severity and location information

### Observation

- Script insertion
- Script removal
- Text mutation
- Debouncing
- Observer cleanup

### Overlay

Test the important behavior rather than visual implementation details:

- Open and close
- Entity navigation
- Detail selection
- Refresh
- Copy behavior
- Cleanup
- Source logging
- Keyboard controls

## Documentation

Write a useful root README containing:

- What the project does
- What it does not do
- Installation
- Core usage
- Overlay usage
- Custom-rule usage
- Mutation observation
- Browser support
- Security and privacy behavior
- Normalization rules
- Known limitations
- Development commands
- Contribution guidance
- Roadmap

Clearly distinguish:

- JSON parsing errors
- Structural diagnostics
- General Schema.org advisory checks
- Consumer-specific custom rules
- Google rich-result eligibility

Mention that users should still use Google Rich Results Test for Google-specific eligibility and Schema.org’s validator for external vocabulary validation.

## Package scripts

At the workspace root, provide scripts similar to:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --filter @schema-lens/example-basic dev",
    "test": "pnpm -r test",
    "test:watch": "pnpm -r test:watch",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Adjust package names as necessary for valid workspace behavior.

## Deliverables

Complete the following:

1. Initialize the workspace and package manifests.
2. Configure TypeScript, Vite, Vitest, ESLint, Prettier, and Changesets.
3. Implement the core collector and parser.
4. Implement normalization.
5. Implement reference graph construction.
6. Implement built-in diagnostics.
7. Implement the custom-rule API.
8. Implement DOM observation.
9. Implement the Shadow DOM overlay.
10. Build the example application.
11. Add tests.
12. Write documentation.
13. Add an MIT license.
14. Add a GitHub Actions workflow for install, lint, typecheck, test, and build.
15. Add package metadata suitable for later npm publication.

## Implementation approach

Work incrementally.

Before writing the full overlay:

1. Establish the workspace.
2. Define the core types.
3. Implement and test script collection.
4. Implement and test normalization.
5. Implement and test graph construction.
6. Implement and test rules.
7. Implement and test observation.
8. Build the overlay against the stable core API.

Do not begin with elaborate styling.

Prioritize:

- Correct parsing
- Predictable normalization
- Clear types
- Useful diagnostics
- Cleanup behavior
- Testability
- Small public APIs

## Completion report

At the end, provide:

- A concise architecture summary
- The final directory tree
- Important public APIs
- Commands for development and testing
- Current limitations
- Decisions that may need reconsideration before npm publication
- A suggested roadmap for versions `0.2.0` and `1.0.0`

Do not publish to npm or create a remote repository. Prepare the project so those actions can be performed separately after review.

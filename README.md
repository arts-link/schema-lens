# Schema Lens

Schema Lens is an open-source, browser-based inspector for Schema.org JSON-LD. It collects every JSON-LD script in a document, parses scripts independently, normalizes inspectable entities, connects exact `@id` references, reports deterministic diagnostics, and can display the result in an isolated Shadow DOM panel.

The project is framework-independent. The core package can be used by themes, CMS projects, browser extensions, test suites, or other browser applications, while the overlay is optional.

> Schema Lens is a debugging aid. It does not reproduce Google Rich Results Test and cannot guarantee search-engine eligibility. Use [Google Rich Results Test](https://search.google.com/test/rich-results) for Google-specific eligibility and [Schema.org Validator](https://validator.schema.org/) for external vocabulary validation.

## Packages

| Package                      | Purpose                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@schema-lens/core`          | Parsing, normalization, graph construction, diagnostics, custom rules, serialization, and DOM observation |
| `@schema-lens/overlay`       | Framework-free, accessible browser inspector built on the core package                                    |
| `@schema-lens/example-basic` | Private Vite application for manual testing                                                               |

## Installation

The packages are prepared for npm publication but are not published yet. Inside this workspace:

```sh
pnpm install
pnpm build
```

After publication:

```sh
pnpm add @schema-lens/core
pnpm add @schema-lens/overlay
```

Both public packages are ESM-only and include TypeScript declarations.

## Core usage

```ts
import { inspectDocument, serializeInspectionResult } from "@schema-lens/core";

const result = inspectDocument(document);

console.log(result.summary);
console.log(JSON.stringify(serializeInspectionResult(result), null, 2));
```

`inspectScripts` accepts an explicit iterable of `HTMLScriptElement` values when a consumer wants to inspect a subset:

```ts
import { inspectScripts } from "@schema-lens/core";

const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
const result = inspectScripts(scripts);
```

## Overlay usage

```ts
import { createSchemaInspector } from "@schema-lens/overlay";

const inspector = createSchemaInspector({
  document,
  observeChanges: true,
});

inspector.open();
```

The returned inspector exposes `open`, `close`, `toggle`, `refresh`, `getResult`, and `destroy`. `destroy()` is idempotent and removes the host, observer, timers, and window listeners.

## Custom rules

Rules are explicitly scoped to one entity or the whole result. The engine assigns the registered rule ID to returned findings.

```ts
import { inspectDocument, type InspectorRule } from "@schema-lens/core";

const rules: InspectorRule[] = [
  {
    id: "project/article-section",
    scope: "entity",
    inspect({ entity }) {
      if (entity.types.includes("Article") && typeof entity.value["articleSection"] !== "string") {
        return [
          {
            severity: "info",
            message: "This project prefers Article entities to define articleSection.",
          },
        ];
      }
      return [];
    },
  },
  {
    id: "project/page-check",
    scope: "result",
    inspect({ result }) {
      return result.entities.length === 0
        ? [{ severity: "warning", message: "This project expects schema on every page." }]
        : [];
    },
  },
];

const result = inspectDocument(document, { rules });
```

Custom IDs cannot use the reserved `schema-lens/` prefix. A rule exception becomes a contained diagnostic and does not stop other rules.

## Mutation observation

```ts
import { createSchemaObserver } from "@schema-lens/core";

const observer = createSchemaObserver(
  document,
  (result) => {
    console.log(result.summary);
  },
  { debounceMs: 100 },
);

observer.refresh();
observer.disconnect();
```

The observer reacts to JSON-LD script insertion, removal, text changes, and `type` attribute changes. It does not poll, and it ignores the overlay host and Shadow DOM.

## Diagnostics

Schema Lens distinguishes four sources of information:

- **JSON parsing errors:** the script is empty, malformed, or has an unsupported top-level value.
- **Structural and graph diagnostics:** invalid `@graph`, invalid identity fields, duplicates, ambiguous links, unresolved local links, and common value-shape problems.
- **General Schema.org advisories:** intentionally modest suggestions for common types. These are informational, not universal requirements.
- **Consumer rules:** project-specific checks registered through the custom-rule API.

Finding severities use a balanced posture: unusable scripts are errors, likely data defects are warnings, and hygiene or optional guidance is informational.

See the [core package documentation](packages/core/README.md) for exact normalization and rule behavior.

## Security and privacy

- No runtime network requests are made.
- Schema data is never transmitted by the packages.
- Script text is parsed strictly with `JSON.parse` and is never executed.
- The overlay renders schema values with text nodes and `textContent`, not injected HTML.
- The page’s JSON-LD is never modified.
- No inspector state is attached to a global unless a consumer does so explicitly.

Copy actions use the browser Clipboard API and can fail when clipboard permission is unavailable.

## Browser support

Version 0.1 targets current Chrome, Firefox, Safari, and Edge releases with ES2022, Shadow DOM, `MutationObserver`, and modern module support.

## Development

Requires Node.js 22 or newer and pnpm 11.

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm size
```

The example includes valid linked entities, duplicate IDs, an unresolved reference, malformed JSON, and controls for adding, changing, and removing JSON-LD after load.

## Automated releases

GitHub Actions validates and builds every pull request and every push to `main`. A separate Changesets workflow uses npm Trusted Publishing with GitHub OIDC, so no long-lived npm token is stored in the repository. After repeating the validation suite, it:

- creates or updates a `Release packages` pull request when pending Changesets exist;
- publishes changed public packages after that release pull request is merged;
- creates matching GitHub Releases and npm provenance attestations.

The release job remains disabled until the repository variable `NPM_TRUSTED_PUBLISHING` is set to `true`.

Because npm Trusted Publishing is configured per existing package, bootstrap each package once with an interactive, 2FA-protected publish from a clean `main` checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @schema-lens/core publish --access public
pnpm --filter @schema-lens/overlay publish --access public
```

Complete npm's 2FA challenge for each publish. After the packages exist:

1. Configure a GitHub Actions trusted publisher for both packages with GitHub owner `arts-link`, repository `schema-lens`, workflow filename `release.yml`, and permission to run `npm publish`.
2. Set the GitHub Actions repository variable `NPM_TRUSTED_PUBLISHING` to `true`.
3. Allow GitHub Actions to create release pull requests, or supply an appropriately scoped GitHub App or fine-grained token to Changesets.

Trusted Publishing requires an OIDC-compatible npm CLI. The release workflow uses Node.js 24, installs npm 11.15 or newer, grants only the required job permissions, and performs no dependency-cache restore during publication.

Add a Changeset to each pull request containing a user-visible package change:

```sh
pnpm changeset
```

## Known limitations

- IDs are matched as exact strings; URL expansion, base resolution, remote document loading, and JSON-LD expansion are intentionally out of scope.
- Unmatched absolute URLs are recorded as external rather than warned as unresolved.
- Schema Lens includes only a small deterministic advisory set, not the complete Schema.org vocabulary.
- Version 0.1 inspects browser DOM scripts rather than accepting arbitrary server-side JSON values.
- The npm package names were unclaimed when release automation was configured; publishing still requires control of the `@schema-lens` npm scope.
- Browser compatibility is configured and tested in jsdom; the example still requires final manual verification in each supported browser before publication.

## Contributing

Keep core behavior deterministic and framework-independent. Add tests for behavior changes, avoid runtime dependencies unless they have a clear bundle and maintenance benefit, and add a Changeset for user-visible package changes:

```sh
pnpm changeset
```

Pull requests should pass formatting, linting, typechecking, tests, builds, and the bundle report.

## Roadmap

### 0.2.0

- Filtering and search within larger entity graphs
- Export formats beyond the JSON-safe snapshot
- Optional raw-value inspection without DOM scripts
- More configurable advisory rule groups
- Browser-extension integration examples

### 1.0.0

- Stabilized public result and rule APIs
- Documented compatibility and deprecation policy
- Cross-browser automated integration suite
- Proven bundle-size budgets
- Publication and long-term release workflow

## License

[MIT](LICENSE)

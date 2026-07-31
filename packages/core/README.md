# `@arts-link/schema-lens-core`

Framework-independent collection, parsing, normalization, reference graph construction, diagnostics, serialization, and DOM observation for Schema.org JSON-LD.

## Public API

```ts
import {
  createSchemaObserver,
  inspectDocument,
  inspectScripts,
  serializeInspectionResult,
} from "@arts-link/schema-lens-core";
```

- `inspectDocument(document, options?)` inspects all exact `script[type="application/ld+json"]` matches.
- `inspectScripts(scripts, options?)` inspects an explicit iterable in iteration order.
- `createSchemaObserver(document, callback, options?)` reports the initial result and debounced changes.
- `serializeInspectionResult(result)` removes live DOM elements and returns a JSON-safe snapshot.

## Exact normalization rules

1. Every script is trimmed and parsed independently with `JSON.parse`. One invalid script cannot block another.
2. Supported roots are an object or array. Other JSON values produce an error and no entities.
3. A top-level object is an entity unless it is a graph-only wrapper containing only JSON-LD keyword properties and no `@id`, `@type`, or ordinary properties.
4. Object entries in a top-level array and object entries in a valid `@graph` array are always entities.
5. A nested object becomes an entity when it contains `@type`, or when it contains `@id` plus definition properties.
6. A nested object containing only `@id` (and optionally `@context`) is a reference, not another definition. The same shape is still an entity at the top level or directly inside `@graph`.
7. Non-object top-level array and `@graph` entries are ignored with structural findings.
8. Paths are RFC 6901 JSON Pointers. The root path is the empty string and is displayed as `/`.
9. Generated keys use the script index and path, so definitions with the same `@id` remain separate.
10. `@type` accepts a non-empty string or an array containing non-empty strings. Valid entries are retained even when other entries are invalid.
11. `@id` is retained only when it is a non-empty string.

## Reference behavior

- Objects containing a valid string `@id` in an entity value create an outbound reference.
- IDs match by exact string. They are not expanded, normalized, fetched, or resolved against a base URL.
- One match is resolved and creates an inbound reference.
- Multiple matches are ambiguous and retain every candidate key.
- No match for a fragment or relative value is unresolved and produces a warning.
- No match for an absolute or protocol-relative URL is external and does not produce an unresolved warning.
- References within a nested entity belong to that nested entity. Its parent still gets a relationship to the nested entity when the nested value has `@id`.
- Self-references are informational.

## Built-in diagnostics

Built-in IDs use the reserved `schema-lens/` prefix.

Errors cover invalid JSON, empty scripts, unsupported roots, and invalid `@graph` values. Warnings cover structural identity issues, duplicate or conflicting IDs, unresolved and ambiguous local links, common URL/date problems, and valid scripts with no entities. Informational findings cover empty values, empty arrays, self-references, and optional common-type guidance.

URL checks apply to string values of:

- `url`
- `sameAs`
- `contentUrl`
- `thumbnailUrl`
- `embedUrl`

Date checks accept ISO calendar dates and ISO date-times for:

- `datePublished`
- `dateModified`
- `dateCreated`
- `uploadDate`
- `validFrom`
- `validThrough`
- `priceValidUntil`

The advisory set covers Article, BlogPosting, NewsArticle, Product, Offer, BreadcrumbList, ListItem, WebPage, WebSite, Organization, Person, and ImageObject. Advisory messages are general diagnostics rather than definitive Schema.org or Google requirements.

## Custom rules

Rules use `scope: "entity"` or `scope: "result"`. They are synchronous and receive the complete built-in inspection result. Entity rules run before result rules.

Custom IDs must be non-empty, unique, and outside the `schema-lens/` namespace. Rule exceptions and invalid registrations produce contained diagnostics.

## Serialization

Live script results retain `HTMLScriptElement` as `element` for source logging. Entities use `scriptIndex` rather than repeating DOM references. Use `serializeInspectionResult` before persistence, copying, transmission, or snapshot assertions.

## Observation

The observer watches child, character-data, and `type` attribute changes below `document.documentElement`. The default debounce is 100 ms. `refresh()` invokes the callback synchronously and returns the result. `disconnect()` is idempotent and cancels pending work.

## Limitations

This package does not execute JSON-LD, load remote contexts, expand vocabularies, emulate search-engine rules, or guarantee rich-result eligibility.

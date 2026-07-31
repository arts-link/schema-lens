import { beforeEach, describe, expect, it } from "vitest";

import {
  inspectDocument,
  inspectScripts,
  serializeInspectionResult,
  type InspectorRule,
} from "../src/index.js";

function addScript(value: string, target = document): HTMLScriptElement {
  const script = target.createElement("script");
  script.type = "application/ld+json";
  script.textContent = value;
  target.body.append(script);
  return script;
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("inspection", () => {
  it("collects and parses scripts independently", () => {
    addScript('{"@type":"Article","headline":"Hello"}');
    addScript("{nope");
    addScript('[{"@type":"Person","name":"Ada"}]');

    const result = inspectDocument(document);

    expect(result.scripts).toHaveLength(3);
    expect(result.entities.map((entity) => entity.types[0])).toEqual(["Article", "Person"]);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "schema-lens/invalid-json", scriptIndex: 1 }),
    );
  });

  it("reports empty and primitive scripts", () => {
    addScript("  ");
    addScript('"hello"');

    const result = inspectDocument(document);

    expect(result.scripts.map((script) => script.status)).toEqual(["empty", "valid"]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(["schema-lens/script-empty", "schema-lens/unsupported-top-level"]),
    );
  });

  it("normalizes graph entries without treating a graph-only wrapper as an entity", () => {
    addScript(`{
      "@context": "https://schema.org",
      "@graph": [
        {"@id":"#page","@type":["WebPage","Article"],"headline":"Page"},
        {"@id":"#org","@type":"Organization","name":"Org"}
      ]
    }`);

    const result = inspectDocument(document);

    expect(result.entities).toHaveLength(2);
    expect(result.entities[0]).toMatchObject({
      path: "/@graph/0",
      id: "#page",
      types: ["WebPage", "Article"],
    });
  });

  it("reports invalid graph values and entries", () => {
    addScript('{"@graph":{}}');
    addScript('{"@graph":[null,{"@type":"Person","name":"Ada"}]}');

    const result = inspectDocument(document);

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(["schema-lens/invalid-graph", "schema-lens/invalid-graph-entry"]),
    );
    expect(result.entities).toHaveLength(1);
  });

  it("creates nested definitions but keeps ID-only objects as references", () => {
    addScript(`{
      "@id":"#article",
      "@type":"Article",
      "headline":"Story",
      "author":{"@id":"#person"},
      "publisher":{"@id":"#org","@type":"Organization","name":"Publisher"}
    }`);
    addScript('{"@id":"#person","@type":"Person","name":"Ada"}');

    const result = inspectDocument(document);
    const article = result.entities.find((entity) => entity.id === "#article")!;

    expect(result.entities.map((entity) => entity.id)).toEqual(["#article", "#org", "#person"]);
    expect(article.outboundReferences.map((reference) => reference.targetId)).toEqual([
      "#person",
      "#org",
    ]);
    expect(article.outboundReferences.every((reference) => reference.status === "resolved")).toBe(
      true,
    );
  });

  it("uses exact ID matching and distinguishes unresolved, external, and ambiguous references", () => {
    addScript(`[
      {"@id":"#article","@type":"Article","headline":"Story",
       "author":{"@id":"person"},
       "publisher":{"@id":"https://example.com/org"},
       "mainEntity":{"@id":"#duplicate"}},
      {"@id":"#duplicate","@type":"Person","name":"One"},
      {"@id":"#duplicate","@type":"Person","name":"Two"}
    ]`);

    const result = inspectDocument(document);
    const references = result.entities[0]!.outboundReferences;

    expect(references.map((reference) => reference.status)).toEqual([
      "unresolved",
      "external",
      "ambiguous",
    ]);
    expect(result.summary).toMatchObject({
      duplicateIdCount: 1,
      unresolvedReferenceCount: 1,
      ambiguousReferenceCount: 1,
    });
  });

  it("creates inbound references and informational self-reference findings", () => {
    addScript(`[
      {"@id":"#a","@type":"Thing","related":{"@id":"#b"}},
      {"@id":"#b","@type":"Thing","related":{"@id":"#b"}}
    ]`);

    const result = inspectDocument(document);
    const target = result.entities.find((entity) => entity.id === "#b")!;

    expect(target.inboundReferences).toHaveLength(2);
    expect(target.findings).toContainEqual(
      expect.objectContaining({ ruleId: "schema-lens/self-reference", severity: "info" }),
    );
  });

  it("distinguishes identical duplicate definitions from conflicting ones", () => {
    addScript('{"@id":"#same","@type":"Person","name":"Ada"}');
    addScript('{"@id":"#same","@type":"Person","name":"Ada"}');
    addScript('{"@id":"#different","@type":"Person","name":"Ada"}');
    addScript('{"@id":"#different","@type":"Person","name":"Grace"}');

    const result = inspectDocument(document);

    expect(
      result.findings.filter((finding) => finding.ruleId === "schema-lens/duplicate-id"),
    ).toHaveLength(2);
    expect(
      result.findings.filter((finding) => finding.ruleId === "schema-lens/conflicting-id"),
    ).toHaveLength(2);
  });

  it("reports identity, empty-value, URL, date, and advisory diagnostics", () => {
    addScript(`{
      "@id": 42,
      "@type": ["Article", ""],
      "headline": "",
      "sameAs": "http://",
      "datePublished": "2026-02-30",
      "keywords": [],
      "author": null
    }`);

    const result = inspectDocument(document);
    const ruleIds = result.findings.map((finding) => finding.ruleId);

    expect(ruleIds).toEqual(
      expect.arrayContaining([
        "schema-lens/invalid-id",
        "schema-lens/invalid-type",
        "schema-lens/empty-value",
        "schema-lens/invalid-url",
        "schema-lens/invalid-date",
        "schema-lens/empty-array",
        "schema-lens/advisory-article-author",
      ]),
    );
  });

  it("runs scoped custom rules and contains failures", () => {
    addScript('{"@type":"Person","name":"Ada"}');
    const rules: InspectorRule[] = [
      {
        id: "project/entity",
        scope: "entity",
        inspect: ({ entity }) => [
          { severity: "info", message: entity.value["name"] === "Ada" ? "Found Ada" : "Other" },
        ],
      },
      {
        id: "project/result",
        scope: "result",
        inspect: ({ result }) => [
          { severity: "info", message: `${result.entities.length} entity` },
        ],
      },
      {
        id: "project/broken",
        scope: "entity",
        inspect: () => {
          throw new Error("boom");
        },
      },
    ];

    const result = inspectDocument(document, { rules });

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "project/entity", message: "Found Ada" }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "project/result", message: "1 entity" }),
    );
    expect(
      result.findings.some(
        (finding) =>
          finding.ruleId === "schema-lens/custom-rule-failed" &&
          finding.message.includes("project/broken"),
      ),
    ).toBe(true);
  });

  it("rejects reserved and duplicate custom rule IDs", () => {
    addScript('{"@type":"Thing"}');
    const inspect = (): [] => [];

    const result = inspectDocument(document, {
      rules: [
        { id: "schema-lens/nope", scope: "result", inspect },
        { id: "project/same", scope: "result", inspect },
        { id: "project/same", scope: "result", inspect },
      ],
    });

    expect(
      result.findings.filter((finding) => finding.ruleId === "schema-lens/invalid-custom-rule"),
    ).toHaveLength(2);
  });

  it("inspects an explicit script iterable", () => {
    const first = addScript('{"@type":"Thing"}');
    addScript('{"@type":"Person"}');

    expect(inspectScripts([first]).summary.entityCount).toBe(1);
  });

  it("creates JSON-safe serialized snapshots without source elements", () => {
    addScript('{"@type":"Thing","value":"safe"}');

    const snapshot = serializeInspectionResult(inspectDocument(document));

    expect(snapshot.scripts[0]).not.toHaveProperty("element");
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });
});

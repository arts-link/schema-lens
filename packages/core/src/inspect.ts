import type {
  EntityReference,
  InspectionOptions,
  InspectionResult,
  InspectedEntity,
  InspectorRule,
  JsonObject,
  SchemaFinding,
  SchemaScriptResult,
} from "./types.js";
import {
  appendPointer,
  canonicalJson,
  countSeverities,
  entityKey,
  hasUriScheme,
  isGraphOnlyWrapper,
  isObject,
  isReferenceOnly,
  isValidIsoDate,
  isValidUrl,
} from "./utils.js";

const URL_PROPERTIES = new Set(["url", "sameAs", "contentUrl", "thumbnailUrl", "embedUrl"]);
const DATE_PROPERTIES = new Set([
  "datePublished",
  "dateModified",
  "dateCreated",
  "uploadDate",
  "validFrom",
  "validThrough",
  "priceValidUntil",
]);
const ARTICLE_TYPES = new Set(["Article", "BlogPosting", "NewsArticle"]);
const RESERVED_RULE_PREFIX = "schema-lens/";

interface InspectionState {
  scripts: SchemaScriptResult[];
  entities: InspectedEntity[];
  findings: SchemaFinding[];
  entityByKey: Map<string, InspectedEntity>;
  ownerByObject: WeakMap<object, InspectedEntity>;
  duplicateIdCount: number;
}

export function inspectDocument(
  document: Document,
  options: InspectionOptions = {},
): InspectionResult {
  return inspectScripts(
    document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    options,
  );
}

export function inspectScripts(
  scripts: Iterable<HTMLScriptElement>,
  options: InspectionOptions = {},
): InspectionResult {
  const state: InspectionState = {
    scripts: [],
    entities: [],
    findings: [],
    entityByKey: new Map(),
    ownerByObject: new WeakMap(),
    duplicateIdCount: 0,
  };

  Array.from(scripts).forEach((element, index) => parseScript(state, element, index));
  detectDuplicateIds(state);
  buildReferences(state);
  runValueAndAdvisoryRules(state);

  const result = createResult(state);
  runCustomRules(state, result, options.rules ?? []);
  result.summary = createSummary(state);
  return result;
}

function parseScript(state: InspectionState, element: HTMLScriptElement, index: number): void {
  const rawText = element.textContent ?? "";
  const script: SchemaScriptResult = {
    index,
    element,
    rawText,
    status: "valid",
    entities: [],
    findings: [],
  };
  state.scripts.push(script);

  if (rawText.trim() === "") {
    script.status = "empty";
    addFinding(state, {
      ruleId: "schema-lens/script-empty",
      severity: "error",
      message: "JSON-LD script is empty.",
      scriptIndex: index,
      path: "",
    });
    return;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawText) as unknown;
    script.parsedValue = parsedValue;
  } catch (error) {
    script.status = "invalid";
    addFinding(state, {
      ruleId: "schema-lens/invalid-json",
      severity: "error",
      message: `JSON-LD could not be parsed: ${errorMessage(error)}`,
      scriptIndex: index,
      path: "",
    });
    return;
  }

  if (!isObject(parsedValue) && !Array.isArray(parsedValue)) {
    addFinding(state, {
      ruleId: "schema-lens/unsupported-top-level",
      severity: "error",
      message: "JSON-LD must have an object or array at the top level.",
      scriptIndex: index,
      path: "",
    });
    return;
  }

  discoverEntities(state, script, parsedValue);

  if (script.entities.length === 0) {
    addFinding(state, {
      ruleId: "schema-lens/no-entities",
      severity: "warning",
      message: "No inspectable entities were found in this valid script.",
      scriptIndex: index,
      path: "",
    });
  }
}

function discoverEntities(
  state: InspectionState,
  script: SchemaScriptResult,
  root: JsonObject | unknown[],
): void {
  const visited = new WeakSet<object>();

  const register = (value: JsonObject, path: string): InspectedEntity => {
    const existingOwner = state.ownerByObject.get(value);
    if (existingOwner) return existingOwner;

    const entity: InspectedEntity = {
      key: entityKey(script.index, path),
      types: [],
      value,
      scriptIndex: script.index,
      path,
      inboundReferences: [],
      outboundReferences: [],
      findings: [],
    };
    script.entities.push(entity);
    state.entities.push(entity);
    state.entityByKey.set(entity.key, entity);
    state.ownerByObject.set(value, entity);
    normalizeIdentity(state, entity);
    return entity;
  };

  const visit = (value: unknown, path: string, position: "root" | "array" | "graph" | "nested") => {
    if (Array.isArray(value)) {
      value.forEach((item, itemIndex) => {
        const itemPath = appendPointer(path, itemIndex);
        if (position === "root" && !isObject(item) && !Array.isArray(item)) {
          addFinding(state, {
            ruleId: "schema-lens/unsupported-array-item",
            severity: "warning",
            message: "A top-level array item is not an object and was ignored.",
            scriptIndex: script.index,
            path: itemPath,
          });
        }
        visit(item, itemPath, position === "root" ? "array" : "nested");
      });
      return;
    }
    if (!isObject(value)) return;

    const shouldRegister =
      position === "array" ||
      position === "graph" ||
      (position === "root" && !isGraphOnlyWrapper(value)) ||
      (position === "nested" && ("@type" in value || ("@id" in value && !isReferenceOnly(value))));

    if (shouldRegister) register(value, path);
    if (visited.has(value)) return;
    visited.add(value);

    if ("@graph" in value) {
      const graphPath = appendPointer(path, "@graph");
      if (!Array.isArray(value["@graph"])) {
        addFinding(state, {
          ruleId: "schema-lens/invalid-graph",
          severity: "error",
          message: "The @graph property must be an array.",
          scriptIndex: script.index,
          ...(shouldRegister ? { entityKey: entityKey(script.index, path) } : {}),
          path: graphPath,
        });
      } else {
        value["@graph"].forEach((item, graphIndex) => {
          const itemPath = appendPointer(graphPath, graphIndex);
          if (!isObject(item)) {
            addFinding(state, {
              ruleId: "schema-lens/invalid-graph-entry",
              severity: "warning",
              message: "A @graph entry is not an object and was ignored.",
              scriptIndex: script.index,
              path: itemPath,
            });
          } else {
            visit(item, itemPath, "graph");
          }
        });
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === "@graph") continue;
      const childPath = appendPointer(path, key);
      if (Array.isArray(child)) {
        child.forEach((item, itemIndex) =>
          visit(item, appendPointer(childPath, itemIndex), "nested"),
        );
      } else {
        visit(child, childPath, "nested");
      }
    }
  };

  visit(root, "", "root");
}

function normalizeIdentity(state: InspectionState, entity: InspectedEntity): void {
  const typeValue = entity.value["@type"];
  if (typeValue === undefined) {
    addEntityFinding(
      state,
      entity,
      "schema-lens/missing-type",
      "warning",
      "Entity does not define @type.",
      appendPointer(entity.path, "@type"),
    );
  } else {
    const candidates = typeof typeValue === "string" ? [typeValue] : typeValue;
    if (!Array.isArray(candidates)) {
      addEntityFinding(
        state,
        entity,
        "schema-lens/invalid-type",
        "warning",
        "The @type value must be a string or an array of strings.",
        appendPointer(entity.path, "@type"),
      );
    } else {
      entity.types = candidates.filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim().length > 0,
      );
      if (
        entity.types.length === 0 ||
        candidates.some(
          (candidate) => typeof candidate !== "string" || candidate.trim().length === 0,
        )
      ) {
        addEntityFinding(
          state,
          entity,
          "schema-lens/invalid-type",
          "warning",
          "The @type value contains no usable type or includes invalid entries.",
          appendPointer(entity.path, "@type"),
        );
      }
    }
  }

  if ("@id" in entity.value) {
    const idValue = entity.value["@id"];
    if (typeof idValue !== "string") {
      addEntityFinding(
        state,
        entity,
        "schema-lens/invalid-id",
        "warning",
        "The @id value must be a string.",
        appendPointer(entity.path, "@id"),
      );
    } else if (idValue.trim() === "") {
      addEntityFinding(
        state,
        entity,
        "schema-lens/empty-id",
        "warning",
        "The @id value must not be empty.",
        appendPointer(entity.path, "@id"),
      );
    } else {
      entity.id = idValue;
    }
  }
}

function detectDuplicateIds(state: InspectionState): void {
  const entitiesById = new Map<string, InspectedEntity[]>();
  for (const entity of state.entities) {
    if (!entity.id) continue;
    const matches = entitiesById.get(entity.id) ?? [];
    matches.push(entity);
    entitiesById.set(entity.id, matches);
  }

  for (const [id, matches] of entitiesById) {
    if (matches.length < 2) continue;
    state.duplicateIdCount += 1;
    const conflicting = new Set(matches.map((entity) => canonicalJson(entity.value))).size > 1;
    for (const entity of matches) {
      addEntityFinding(
        state,
        entity,
        conflicting ? "schema-lens/conflicting-id" : "schema-lens/duplicate-id",
        "warning",
        conflicting
          ? `Multiple, potentially conflicting entities define @id "${id}".`
          : `Multiple entities define @id "${id}".`,
        appendPointer(entity.path, "@id"),
      );
    }
  }
}

function buildReferences(state: InspectionState): void {
  const entitiesById = new Map<string, InspectedEntity[]>();
  for (const entity of state.entities) {
    if (!entity.id) continue;
    const matches = entitiesById.get(entity.id) ?? [];
    matches.push(entity);
    entitiesById.set(entity.id, matches);
  }

  for (const entity of state.entities) {
    const visit = (value: unknown, path: string, isRoot = false): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, appendPointer(path, index)));
        return;
      }
      if (!isObject(value)) return;

      if (!isRoot && "@id" in value) {
        const targetId = value["@id"];
        if (typeof targetId !== "string" || targetId.trim() === "") {
          addEntityFinding(
            state,
            entity,
            "schema-lens/invalid-reference-id",
            "warning",
            "A referenced @id must be a non-empty string.",
            appendPointer(path, "@id"),
          );
        } else {
          const matches = entitiesById.get(targetId) ?? [];
          const reference = createReference(entity, targetId, path, matches);
          entity.outboundReferences.push(reference);
          if (reference.status === "resolved" && reference.resolvedTargetKey) {
            state.entityByKey.get(reference.resolvedTargetKey)?.inboundReferences.push(reference);
            if (reference.resolvedTargetKey === entity.key) {
              addEntityFinding(
                state,
                entity,
                "schema-lens/self-reference",
                "info",
                `Entity references itself through @id "${targetId}".`,
                path,
              );
            }
          } else if (reference.status === "unresolved") {
            addEntityFinding(
              state,
              entity,
              "schema-lens/unresolved-reference",
              "warning",
              `No local entity defines @id "${targetId}".`,
              path,
            );
          } else if (reference.status === "ambiguous") {
            addEntityFinding(
              state,
              entity,
              "schema-lens/ambiguous-reference",
              "warning",
              `Reference to @id "${targetId}" matches multiple entities.`,
              path,
            );
          }
        }
      }

      const nestedOwner = state.ownerByObject.get(value);
      if (!isRoot && nestedOwner && nestedOwner.key !== entity.key) return;

      for (const [key, child] of Object.entries(value)) {
        if (key === "@id" || key === "@context") continue;
        visit(child, appendPointer(path, key));
      }
    };
    visit(entity.value, entity.path, true);
  }
}

function createReference(
  source: InspectedEntity,
  targetId: string,
  propertyPath: string,
  matches: InspectedEntity[],
): EntityReference {
  if (matches.length === 1) {
    return {
      sourceKey: source.key,
      targetId,
      propertyPath,
      status: "resolved",
      resolvedTargetKey: matches[0]!.key,
    };
  }
  if (matches.length > 1) {
    return {
      sourceKey: source.key,
      targetId,
      propertyPath,
      status: "ambiguous",
      candidateTargetKeys: matches.map((match) => match.key),
    };
  }
  return {
    sourceKey: source.key,
    targetId,
    propertyPath,
    status: hasUriScheme(targetId) ? "external" : "unresolved",
  };
}

function runValueAndAdvisoryRules(state: InspectionState): void {
  for (const entity of state.entities) {
    const baseUrl =
      state.scripts[entity.scriptIndex]?.element.ownerDocument.baseURI ?? "about:blank";
    inspectValues(state, entity, entity.value, entity.path, baseUrl, true);
    runAdvisoryRules(state, entity);
  }
}

function inspectValues(
  state: InspectionState,
  entity: InspectedEntity,
  value: unknown,
  path: string,
  baseUrl: string,
  isRoot = false,
): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      addEntityFinding(
        state,
        entity,
        "schema-lens/empty-array",
        "info",
        "Property contains an empty array.",
        path,
      );
    }
    value.forEach((item, index) =>
      inspectValues(state, entity, item, appendPointer(path, index), baseUrl),
    );
    return;
  }
  if (!isObject(value)) return;

  const nestedOwner = state.ownerByObject.get(value);
  if (!isRoot && nestedOwner && nestedOwner.key !== entity.key) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = appendPointer(path, key);
    if (child === null || child === undefined) {
      addEntityFinding(
        state,
        entity,
        "schema-lens/empty-value",
        "info",
        `Property "${key}" has no value.`,
        childPath,
      );
      continue;
    }
    if (typeof child === "string" && child.trim() === "" && key !== "@id" && key !== "@type") {
      addEntityFinding(
        state,
        entity,
        "schema-lens/empty-value",
        "info",
        `Property "${key}" is an empty string.`,
        childPath,
      );
    }
    validateCommonValue(state, entity, key, child, childPath, baseUrl);
    inspectValues(state, entity, child, childPath, baseUrl);
  }
}

function validateCommonValue(
  state: InspectionState,
  entity: InspectedEntity,
  key: string,
  value: unknown,
  path: string,
  baseUrl: string,
): void {
  const stringValues = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  if (URL_PROPERTIES.has(key)) {
    stringValues.forEach((item, index) => {
      if (typeof item === "string" && item.trim() !== "" && !isValidUrl(item, baseUrl)) {
        addEntityFinding(
          state,
          entity,
          "schema-lens/invalid-url",
          "warning",
          `Property "${key}" contains an invalid URL.`,
          Array.isArray(value) ? appendPointer(path, index) : path,
        );
      }
    });
  }
  if (DATE_PROPERTIES.has(key)) {
    stringValues.forEach((item, index) => {
      if (typeof item === "string" && item.trim() !== "" && !isValidIsoDate(item)) {
        addEntityFinding(
          state,
          entity,
          "schema-lens/invalid-date",
          "warning",
          `Property "${key}" is not a valid ISO date or date-time.`,
          Array.isArray(value) ? appendPointer(path, index) : path,
        );
      }
    });
  }
}

function runAdvisoryRules(state: InspectionState, entity: InspectedEntity): void {
  const hasType = (type: string): boolean => entity.types.includes(type);
  const missing = (properties: string[]): boolean =>
    properties.every((property) => !hasMeaningfulValue(entity.value[property]));
  const advise = (rule: string, message: string, property: string): void =>
    addEntityFinding(
      state,
      entity,
      `schema-lens/advisory-${rule}`,
      "info",
      message,
      appendPointer(entity.path, property),
    );

  if (entity.types.some((type) => ARTICLE_TYPES.has(type))) {
    if (missing(["headline"]))
      advise("article-headline", "Article-like entity has no headline.", "headline");
    if (missing(["author"]))
      advise("article-author", "Article-like entity has no author.", "author");
  }
  if (hasType("Product") && missing(["name"]))
    advise("product-name", "Product has no name.", "name");
  if (hasType("Offer") && missing(["price", "priceSpecification"]))
    advise("offer-price", "Offer has neither price nor priceSpecification.", "price");
  if (hasType("BreadcrumbList")) {
    if (missing(["itemListElement"])) {
      advise("breadcrumb-items", "BreadcrumbList has no itemListElement.", "itemListElement");
    } else {
      const items = entity.value["itemListElement"];
      if (Array.isArray(items)) {
        const positions = items
          .filter(isObject)
          .map((item) => item["position"])
          .filter((position): position is number => typeof position === "number");
        if (new Set(positions).size < positions.length) {
          addEntityFinding(
            state,
            entity,
            "schema-lens/duplicate-breadcrumb-position",
            "warning",
            "BreadcrumbList contains duplicate numeric positions.",
            appendPointer(entity.path, "itemListElement"),
          );
        }
      }
    }
  }
  if (hasType("ListItem") && missing(["position"]))
    advise("list-item-position", "ListItem has no position.", "position");
  if (hasType("WebPage") && missing(["name", "headline"]))
    advise("web-page-name", "WebPage has neither name nor headline.", "name");
  if (hasType("WebSite")) {
    if (missing(["name"])) advise("web-site-name", "WebSite has no name.", "name");
    if (missing(["url"])) advise("web-site-url", "WebSite has no url.", "url");
  }
  if (hasType("Organization") && missing(["name", "legalName"]))
    advise("organization-name", "Organization has neither name nor legalName.", "name");
  if (hasType("Person") && missing(["name"])) advise("person-name", "Person has no name.", "name");
  if (hasType("ImageObject") && missing(["contentUrl", "url"]))
    advise("image-url", "ImageObject has neither contentUrl nor url.", "contentUrl");
}

function runCustomRules(
  state: InspectionState,
  result: InspectionResult,
  rules: readonly InspectorRule[],
): void {
  const validRules: InspectorRule[] = [];
  const ids = new Set<string>();

  for (const rule of rules) {
    if (
      !rule.id.trim() ||
      rule.id.startsWith(RESERVED_RULE_PREFIX) ||
      ids.has(rule.id) ||
      (rule.scope !== "entity" && rule.scope !== "result")
    ) {
      addFinding(state, {
        ruleId: "schema-lens/invalid-custom-rule",
        severity: "error",
        message: `Custom rule "${rule.id || "(empty)"}" has an invalid, duplicate, or reserved ID.`,
      });
      continue;
    }
    ids.add(rule.id);
    validRules.push(rule);
  }

  for (const rule of validRules.filter((candidate) => candidate.scope === "entity")) {
    for (const entity of state.entities) {
      try {
        const findings = rule.inspect({ scope: "entity", entity, result });
        for (const finding of findings) {
          addFinding(state, {
            ...finding,
            ruleId: rule.id,
            scriptIndex: finding.scriptIndex ?? entity.scriptIndex,
            entityKey: finding.entityKey ?? entity.key,
            path: finding.path ?? entity.path,
          });
        }
      } catch (error) {
        addEntityFinding(
          state,
          entity,
          "schema-lens/custom-rule-failed",
          "error",
          `Custom rule "${rule.id}" failed: ${errorMessage(error)}`,
          entity.path,
        );
      }
    }
  }

  for (const rule of validRules.filter((candidate) => candidate.scope === "result")) {
    try {
      const findings = rule.inspect({ scope: "result", result });
      for (const finding of findings) addFinding(state, { ...finding, ruleId: rule.id });
    } catch (error) {
      addFinding(state, {
        ruleId: "schema-lens/custom-rule-failed",
        severity: "error",
        message: `Custom rule "${rule.id}" failed: ${errorMessage(error)}`,
      });
    }
  }
}

function createResult(state: InspectionState): InspectionResult {
  return {
    scripts: state.scripts,
    entities: state.entities,
    findings: state.findings,
    summary: createSummary(state),
  };
}

function createSummary(state: InspectionState): InspectionResult["summary"] {
  const counts = countSeverities(state.findings);
  return {
    scriptCount: state.scripts.length,
    entityCount: state.entities.length,
    types: [...new Set(state.entities.flatMap((entity) => entity.types))].sort(),
    ...counts,
    duplicateIdCount: state.duplicateIdCount,
    unresolvedReferenceCount: state.entities
      .flatMap((entity) => entity.outboundReferences)
      .filter((reference) => reference.status === "unresolved").length,
    ambiguousReferenceCount: state.entities
      .flatMap((entity) => entity.outboundReferences)
      .filter((reference) => reference.status === "ambiguous").length,
  };
}

function addEntityFinding(
  state: InspectionState,
  entity: InspectedEntity,
  ruleId: string,
  severity: SchemaFinding["severity"],
  message: string,
  path: string,
): void {
  addFinding(state, {
    ruleId,
    severity,
    message,
    scriptIndex: entity.scriptIndex,
    entityKey: entity.key,
    path,
  });
}

function addFinding(state: InspectionState, finding: SchemaFinding): void {
  state.findings.push(finding);
  if (finding.scriptIndex !== undefined) {
    state.scripts[finding.scriptIndex]?.findings.push(finding);
  }
  if (finding.entityKey) {
    state.entityByKey.get(finding.entityKey)?.findings.push(finding);
  }
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

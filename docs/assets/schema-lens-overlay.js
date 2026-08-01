function I(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function g(t, e) {
  const n = String(e).replaceAll("~", "~0").replaceAll("/", "~1");
  return `${t}/${n}`;
}
function pe(t, e) {
  return `script:${t}:path:${e || "/"}`;
}
function Se(t) {
  const e = Object.keys(t);
  return !("@graph" in t) || "@id" in t || "@type" in t ? !1 : e.every((n) => n.startsWith("@"));
}
function Ae(t) {
  const e = Object.keys(t).filter((n) => n !== "@context");
  return e.length === 1 && e[0] === "@id";
}
function ke(t) {
  return JSON.stringify(X(t));
}
function X(t) {
  return Array.isArray(t) ? t.map(X) : I(t) ? Object.fromEntries(
    Object.keys(t).sort().map((e) => [e, X(t[e])])
  ) : t;
}
function Ie(t) {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(t) || t.startsWith("//");
}
function Ee(t, e) {
  try {
    return new URL(t, e), !/\s/.test(t);
  } catch {
    return !1;
  }
}
function Le(t) {
  const e = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
    t
  );
  if (!e)
    return !1;
  const n = Number(e[1]), r = Number(e[2]), i = Number(e[3]), s = new Date(Date.UTC(n, r - 1, i));
  return s.getUTCFullYear() !== n || s.getUTCMonth() !== r - 1 || s.getUTCDate() !== i || e[4] !== void 0 && (Number(e[4]) > 23 || Number(e[5]) > 59) ? !1 : e[6] === void 0 || Number(e[6]) <= 59;
}
function $e(t) {
  return t.reduce(
    (e, n) => (n.severity === "error" && (e.errorCount += 1), n.severity === "warning" && (e.warningCount += 1), n.severity === "info" && (e.infoCount += 1), e),
    { errorCount: 0, warningCount: 0, infoCount: 0 }
  );
}
const Ne = /* @__PURE__ */ new Set(["url", "sameAs", "contentUrl", "thumbnailUrl", "embedUrl"]), Oe = /* @__PURE__ */ new Set([
  "datePublished",
  "dateModified",
  "dateCreated",
  "uploadDate",
  "validFrom",
  "validThrough",
  "priceValidUntil"
]), Te = /* @__PURE__ */ new Set(["Article", "BlogPosting", "NewsArticle"]), Me = "schema-lens/";
function Y(t, e = {}) {
  return ze(
    t.querySelectorAll('script[type="application/ld+json"]'),
    e
  );
}
function ze(t, e = {}) {
  const n = {
    scripts: [],
    entities: [],
    findings: [],
    entityByKey: /* @__PURE__ */ new Map(),
    ownerByObject: /* @__PURE__ */ new WeakMap(),
    duplicateIdCount: 0
  };
  Array.from(t).forEach((i, s) => je(n, i, s)), Ke(n), Ue(n), De(n);
  const r = Ve(n);
  return Fe(n, r, e.rules ?? []), r.summary = he(n), r;
}
function je(t, e, n) {
  const r = e.textContent ?? "", i = {
    index: n,
    element: e,
    rawText: r,
    status: "valid",
    entities: [],
    findings: []
  };
  if (t.scripts.push(i), r.trim() === "") {
    i.status = "empty", x(t, {
      ruleId: "schema-lens/script-empty",
      severity: "error",
      message: "JSON-LD script is empty.",
      scriptIndex: n,
      path: ""
    });
    return;
  }
  let s;
  try {
    s = JSON.parse(r), i.parsedValue = s;
  } catch (o) {
    i.status = "invalid", x(t, {
      ruleId: "schema-lens/invalid-json",
      severity: "error",
      message: `JSON-LD could not be parsed: ${Q(o)}`,
      scriptIndex: n,
      path: ""
    });
    return;
  }
  if (!I(s) && !Array.isArray(s)) {
    x(t, {
      ruleId: "schema-lens/unsupported-top-level",
      severity: "error",
      message: "JSON-LD must have an object or array at the top level.",
      scriptIndex: n,
      path: ""
    });
    return;
  }
  Re(t, i, s), i.entities.length === 0 && x(t, {
    ruleId: "schema-lens/no-entities",
    severity: "warning",
    message: "No inspectable entities were found in this valid script.",
    scriptIndex: n,
    path: ""
  });
}
function Re(t, e, n) {
  const r = /* @__PURE__ */ new WeakSet(), i = (o, a) => {
    const c = t.ownerByObject.get(o);
    if (c) return c;
    const l = {
      key: pe(e.index, a),
      types: [],
      value: o,
      scriptIndex: e.index,
      path: a,
      inboundReferences: [],
      outboundReferences: [],
      findings: []
    };
    return e.entities.push(l), t.entities.push(l), t.entityByKey.set(l.key, l), t.ownerByObject.set(o, l), Pe(t, l), l;
  }, s = (o, a, c) => {
    if (Array.isArray(o)) {
      o.forEach((f, b) => {
        const C = g(a, b);
        c === "root" && !I(f) && !Array.isArray(f) && x(t, {
          ruleId: "schema-lens/unsupported-array-item",
          severity: "warning",
          message: "A top-level array item is not an object and was ignored.",
          scriptIndex: e.index,
          path: C
        }), s(f, C, c === "root" ? "array" : "nested");
      });
      return;
    }
    if (!I(o)) return;
    const l = c === "array" || c === "graph" || c === "root" && !Se(o) || c === "nested" && ("@type" in o || "@id" in o && !Ae(o));
    if (l && i(o, a), !r.has(o)) {
      if (r.add(o), "@graph" in o) {
        const f = g(a, "@graph");
        Array.isArray(o["@graph"]) ? o["@graph"].forEach((b, C) => {
          const E = g(f, C);
          I(b) ? s(b, E, "graph") : x(t, {
            ruleId: "schema-lens/invalid-graph-entry",
            severity: "warning",
            message: "A @graph entry is not an object and was ignored.",
            scriptIndex: e.index,
            path: E
          });
        }) : x(t, {
          ruleId: "schema-lens/invalid-graph",
          severity: "error",
          message: "The @graph property must be an array.",
          scriptIndex: e.index,
          ...l ? { entityKey: pe(e.index, a) } : {},
          path: f
        });
      }
      for (const [f, b] of Object.entries(o)) {
        if (f === "@graph") continue;
        const C = g(a, f);
        Array.isArray(b) ? b.forEach(
          (E, U) => s(E, g(C, U), "nested")
        ) : s(b, C, "nested");
      }
    }
  };
  s(n, "", "root");
}
function Pe(t, e) {
  const n = e.value["@type"];
  if (n === void 0)
    h(
      t,
      e,
      "schema-lens/missing-type",
      "warning",
      "Entity does not define @type.",
      g(e.path, "@type")
    );
  else {
    const r = typeof n == "string" ? [n] : n;
    Array.isArray(r) ? (e.types = r.filter(
      (i) => typeof i == "string" && i.trim().length > 0
    ), (e.types.length === 0 || r.some(
      (i) => typeof i != "string" || i.trim().length === 0
    )) && h(
      t,
      e,
      "schema-lens/invalid-type",
      "warning",
      "The @type value contains no usable type or includes invalid entries.",
      g(e.path, "@type")
    )) : h(
      t,
      e,
      "schema-lens/invalid-type",
      "warning",
      "The @type value must be a string or an array of strings.",
      g(e.path, "@type")
    );
  }
  if ("@id" in e.value) {
    const r = e.value["@id"];
    typeof r != "string" ? h(
      t,
      e,
      "schema-lens/invalid-id",
      "warning",
      "The @id value must be a string.",
      g(e.path, "@id")
    ) : r.trim() === "" ? h(
      t,
      e,
      "schema-lens/empty-id",
      "warning",
      "The @id value must not be empty.",
      g(e.path, "@id")
    ) : e.id = r;
  }
}
function Ke(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t.entities) {
    if (!n.id) continue;
    const r = e.get(n.id) ?? [];
    r.push(n), e.set(n.id, r);
  }
  for (const [n, r] of e) {
    if (r.length < 2) continue;
    t.duplicateIdCount += 1;
    const i = new Set(r.map((s) => ke(s.value))).size > 1;
    for (const s of r)
      h(
        t,
        s,
        i ? "schema-lens/conflicting-id" : "schema-lens/duplicate-id",
        "warning",
        i ? `Multiple, potentially conflicting entities define @id "${n}".` : `Multiple entities define @id "${n}".`,
        g(s.path, "@id")
      );
  }
}
function Ue(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t.entities) {
    if (!n.id) continue;
    const r = e.get(n.id) ?? [];
    r.push(n), e.set(n.id, r);
  }
  for (const n of t.entities) {
    const r = (i, s, o = !1) => {
      if (Array.isArray(i)) {
        i.forEach((c, l) => r(c, g(s, l)));
        return;
      }
      if (!I(i)) return;
      if (!o && "@id" in i) {
        const c = i["@id"];
        if (typeof c != "string" || c.trim() === "")
          h(
            t,
            n,
            "schema-lens/invalid-reference-id",
            "warning",
            "A referenced @id must be a non-empty string.",
            g(s, "@id")
          );
        else {
          const l = e.get(c) ?? [], f = Be(n, c, s, l);
          n.outboundReferences.push(f), f.status === "resolved" && f.resolvedTargetKey ? (t.entityByKey.get(f.resolvedTargetKey)?.inboundReferences.push(f), f.resolvedTargetKey === n.key && h(
            t,
            n,
            "schema-lens/self-reference",
            "info",
            `Entity references itself through @id "${c}".`,
            s
          )) : f.status === "unresolved" ? h(
            t,
            n,
            "schema-lens/unresolved-reference",
            "warning",
            `No local entity defines @id "${c}".`,
            s
          ) : f.status === "ambiguous" && h(
            t,
            n,
            "schema-lens/ambiguous-reference",
            "warning",
            `Reference to @id "${c}" matches multiple entities.`,
            s
          );
        }
      }
      const a = t.ownerByObject.get(i);
      if (!(!o && a && a.key !== n.key))
        for (const [c, l] of Object.entries(i))
          c === "@id" || c === "@context" || r(l, g(s, c));
    };
    r(n.value, n.path, !0);
  }
}
function Be(t, e, n, r) {
  return r.length === 1 ? {
    sourceKey: t.key,
    targetId: e,
    propertyPath: n,
    status: "resolved",
    resolvedTargetKey: r[0].key
  } : r.length > 1 ? {
    sourceKey: t.key,
    targetId: e,
    propertyPath: n,
    status: "ambiguous",
    candidateTargetKeys: r.map((i) => i.key)
  } : {
    sourceKey: t.key,
    targetId: e,
    propertyPath: n,
    status: Ie(e) ? "external" : "unresolved"
  };
}
function De(t) {
  for (const e of t.entities) {
    const n = t.scripts[e.scriptIndex]?.element.ownerDocument.baseURI ?? "about:blank";
    G(t, e, e.value, e.path, n, !0), Je(t, e);
  }
}
function G(t, e, n, r, i, s = !1) {
  if (Array.isArray(n)) {
    n.length === 0 && h(
      t,
      e,
      "schema-lens/empty-array",
      "info",
      "Property contains an empty array.",
      r
    ), n.forEach(
      (a, c) => G(t, e, a, g(r, c), i)
    );
    return;
  }
  if (!I(n)) return;
  const o = t.ownerByObject.get(n);
  if (!(!s && o && o.key !== e.key))
    for (const [a, c] of Object.entries(n)) {
      const l = g(r, a);
      if (c == null) {
        h(
          t,
          e,
          "schema-lens/empty-value",
          "info",
          `Property "${a}" has no value.`,
          l
        );
        continue;
      }
      typeof c == "string" && c.trim() === "" && a !== "@id" && a !== "@type" && h(
        t,
        e,
        "schema-lens/empty-value",
        "info",
        `Property "${a}" is an empty string.`,
        l
      ), We(t, e, a, c, l, i), G(t, e, c, l, i);
    }
}
function We(t, e, n, r, i, s) {
  const o = typeof r == "string" ? [r] : Array.isArray(r) ? r : [];
  Ne.has(n) && o.forEach((a, c) => {
    typeof a == "string" && a.trim() !== "" && !Ee(a, s) && h(
      t,
      e,
      "schema-lens/invalid-url",
      "warning",
      `Property "${n}" contains an invalid URL.`,
      Array.isArray(r) ? g(i, c) : i
    );
  }), Oe.has(n) && o.forEach((a, c) => {
    typeof a == "string" && a.trim() !== "" && !Le(a) && h(
      t,
      e,
      "schema-lens/invalid-date",
      "warning",
      `Property "${n}" is not a valid ISO date or date-time.`,
      Array.isArray(r) ? g(i, c) : i
    );
  });
}
function Je(t, e) {
  const n = (s) => e.types.includes(s), r = (s) => s.every((o) => !Ze(e.value[o])), i = (s, o, a) => h(
    t,
    e,
    `schema-lens/advisory-${s}`,
    "info",
    o,
    g(e.path, a)
  );
  if (e.types.some((s) => Te.has(s)) && (r(["headline"]) && i("article-headline", "Article-like entity has no headline.", "headline"), r(["author"]) && i("article-author", "Article-like entity has no author.", "author")), n("Product") && r(["name"]) && i("product-name", "Product has no name.", "name"), n("Offer") && r(["price", "priceSpecification"]) && i("offer-price", "Offer has neither price nor priceSpecification.", "price"), n("BreadcrumbList"))
    if (r(["itemListElement"]))
      i("breadcrumb-items", "BreadcrumbList has no itemListElement.", "itemListElement");
    else {
      const s = e.value.itemListElement;
      if (Array.isArray(s)) {
        const o = s.filter(I).map((a) => a.position).filter((a) => typeof a == "number");
        new Set(o).size < o.length && h(
          t,
          e,
          "schema-lens/duplicate-breadcrumb-position",
          "warning",
          "BreadcrumbList contains duplicate numeric positions.",
          g(e.path, "itemListElement")
        );
      }
    }
  n("ListItem") && r(["position"]) && i("list-item-position", "ListItem has no position.", "position"), n("WebPage") && r(["name", "headline"]) && i("web-page-name", "WebPage has neither name nor headline.", "name"), n("WebSite") && (r(["name"]) && i("web-site-name", "WebSite has no name.", "name"), r(["url"]) && i("web-site-url", "WebSite has no url.", "url")), n("Organization") && r(["name", "legalName"]) && i("organization-name", "Organization has neither name nor legalName.", "name"), n("Person") && r(["name"]) && i("person-name", "Person has no name.", "name"), n("ImageObject") && r(["contentUrl", "url"]) && i("image-url", "ImageObject has neither contentUrl nor url.", "contentUrl");
}
function Fe(t, e, n) {
  const r = [], i = /* @__PURE__ */ new Set();
  for (const s of n) {
    if (!s.id.trim() || s.id.startsWith(Me) || i.has(s.id) || s.scope !== "entity" && s.scope !== "result") {
      x(t, {
        ruleId: "schema-lens/invalid-custom-rule",
        severity: "error",
        message: `Custom rule "${s.id || "(empty)"}" has an invalid, duplicate, or reserved ID.`
      });
      continue;
    }
    i.add(s.id), r.push(s);
  }
  for (const s of r.filter((o) => o.scope === "entity"))
    for (const o of t.entities)
      try {
        const a = s.inspect({ scope: "entity", entity: o, result: e });
        for (const c of a)
          x(t, {
            ...c,
            ruleId: s.id,
            scriptIndex: c.scriptIndex ?? o.scriptIndex,
            entityKey: c.entityKey ?? o.key,
            path: c.path ?? o.path
          });
      } catch (a) {
        h(
          t,
          o,
          "schema-lens/custom-rule-failed",
          "error",
          `Custom rule "${s.id}" failed: ${Q(a)}`,
          o.path
        );
      }
  for (const s of r.filter((o) => o.scope === "result"))
    try {
      const o = s.inspect({ scope: "result", result: e });
      for (const a of o) x(t, { ...a, ruleId: s.id });
    } catch (o) {
      x(t, {
        ruleId: "schema-lens/custom-rule-failed",
        severity: "error",
        message: `Custom rule "${s.id}" failed: ${Q(o)}`
      });
    }
}
function Ve(t) {
  return {
    scripts: t.scripts,
    entities: t.entities,
    findings: t.findings,
    summary: he(t)
  };
}
function he(t) {
  const e = $e(t.findings);
  return {
    scriptCount: t.scripts.length,
    entityCount: t.entities.length,
    types: [...new Set(t.entities.flatMap((n) => n.types))].sort(),
    ...e,
    duplicateIdCount: t.duplicateIdCount,
    unresolvedReferenceCount: t.entities.flatMap((n) => n.outboundReferences).filter((n) => n.status === "unresolved").length,
    ambiguousReferenceCount: t.entities.flatMap((n) => n.outboundReferences).filter((n) => n.status === "ambiguous").length
  };
}
function h(t, e, n, r, i, s) {
  x(t, {
    ruleId: n,
    severity: r,
    message: i,
    scriptIndex: e.scriptIndex,
    entityKey: e.key,
    path: s
  });
}
function x(t, e) {
  t.findings.push(e), e.scriptIndex !== void 0 && t.scripts[e.scriptIndex]?.findings.push(e), e.entityKey && t.entityByKey.get(e.entityKey)?.findings.push(e);
}
function Ze(t) {
  return t == null || t === "" ? !1 : !Array.isArray(t) || t.length > 0;
}
function Q(t) {
  return t instanceof Error ? t.message : String(t);
}
const ve = "data-schema-lens-overlay-host";
function qe(t, e, n = {}) {
  const r = Math.max(0, n.debounceMs ?? 100);
  let i, s = !1;
  const o = () => {
    const l = Y(
      t,
      n.rules === void 0 ? {} : { rules: n.rules }
    );
    return e(l), l;
  }, a = new MutationObserver((l) => {
    s || l.every(He) || (i !== void 0 && clearTimeout(i), i = setTimeout(() => {
      i = void 0, s || o();
    }, r));
  }), c = t.documentElement;
  return c && a.observe(c, {
    subtree: !0,
    childList: !0,
    characterData: !0,
    attributes: !0,
    attributeFilter: ["type"]
  }), o(), {
    refresh() {
      return i !== void 0 && (clearTimeout(i), i = void 0), o();
    },
    disconnect() {
      s || (s = !0, a.disconnect(), i !== void 0 && clearTimeout(i), i = void 0);
    }
  };
}
function He(t) {
  if (fe(t.target)) return !0;
  if (t.type !== "childList") return !1;
  const e = [...t.addedNodes, ...t.removedNodes];
  return e.length > 0 && e.every(fe);
}
function fe(t) {
  return !!(t.nodeType === 1 ? t : t.parentElement)?.closest(`[${ve}]`);
}
function Xe(t) {
  return {
    scripts: t.scripts.map(({ element: e, ...n }) => F(n)),
    entities: F(t.entities),
    findings: F(t.findings),
    summary: F(t.summary)
  };
}
function F(t) {
  return JSON.parse(JSON.stringify(t));
}
const Ye = `
  :host {
    all: initial;
    --sl-bg: #101318;
    --sl-bg-raised: #171b22;
    --sl-border: #303641;
    --sl-text: #f5f7fa;
    --sl-muted: #aeb6c4;
    --sl-accent: #83b7ff;
    --sl-error: #ff918b;
    --sl-warning: #ffd166;
    --sl-info: #87d7c4;
    position: fixed;
    inset: 0 0 0 auto;
    width: min(480px, 80vw);
    z-index: 2147483647;
    color-scheme: dark;
    pointer-events: none;
  }

  :host([hidden]) {
    display: none;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  button {
    font: inherit;
  }

  .panel {
    position: relative;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    border-left: 1px solid var(--sl-border);
    background: var(--sl-bg);
    color: var(--sl-text);
    box-shadow: -12px 0 36px rgb(0 0 0 / 30%);
    font: 14px/1.45 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: auto;
  }

  .resize-handle {
    position: absolute;
    z-index: 2;
    inset: 0 auto 0 -5px;
    width: 10px;
    cursor: ew-resize;
    touch-action: none;
  }

  .resize-handle:focus-visible,
  button:focus-visible {
    outline: 3px solid var(--sl-accent);
    outline-offset: 2px;
  }

  .header {
    display: grid;
    gap: 10px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--sl-border);
  }

  .header-row,
  .counts,
  .tabs,
  .actions,
  .entity-meta,
  .finding-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-row {
    justify-content: space-between;
  }

  h1, h2, h3, p, pre, dl, dd {
    margin: 0;
  }

  h1 {
    font-size: 17px;
  }

  h2 {
    font-size: 16px;
  }

  h3 {
    font-size: 14px;
  }

  .counts {
    flex-wrap: wrap;
    color: var(--sl-muted);
    font-size: 12px;
  }

  .count {
    border: 1px solid var(--sl-border);
    border-radius: 999px;
    padding: 2px 8px;
  }

  .tabs {
    overflow-x: auto;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sl-border);
    background: var(--sl-bg-raised);
  }

  .tab,
  .icon-button,
  .action-button,
  .entity-button {
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tab,
  .action-button {
    padding: 6px 10px;
  }

  .tab[aria-selected="true"] {
    border-color: var(--sl-accent);
    background: rgb(131 183 255 / 12%);
  }

  .icon-button {
    min-width: 32px;
    min-height: 32px;
    padding: 4px 8px;
  }

  .action-button {
    border-color: var(--sl-border);
    background: var(--sl-bg-raised);
  }

  .tab:hover,
  .icon-button:hover,
  .action-button:hover,
  .entity-button:hover {
    background: rgb(255 255 255 / 8%);
  }

  .main {
    min-height: 0;
    overflow: auto;
  }

  .view {
    display: grid;
    gap: 16px;
    padding: 16px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .card,
  .section,
  .script-card {
    border: 1px solid var(--sl-border);
    border-radius: 10px;
    background: var(--sl-bg-raised);
    padding: 12px;
  }

  .card strong {
    display: block;
    font-size: 22px;
  }

  .muted {
    color: var(--sl-muted);
  }

  .entities-layout {
    display: grid;
    grid-template-columns: minmax(150px, 42%) minmax(0, 1fr);
    min-height: 100%;
  }

  .entity-nav {
    overflow: auto;
    border-right: 1px solid var(--sl-border);
    padding: 12px;
  }

  .entity-detail {
    min-width: 0;
    overflow: auto;
    padding: 16px;
  }

  .entity-group + .entity-group {
    margin-top: 14px;
  }

  .entity-button {
    display: grid;
    gap: 3px;
    width: 100%;
    margin-top: 5px;
    padding: 8px;
    text-align: left;
  }

  .entity-button[aria-current="true"] {
    border-color: var(--sl-accent);
    background: rgb(131 183 255 / 12%);
  }

  .entity-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entity-meta,
  .finding-meta {
    color: var(--sl-muted);
    font-size: 11px;
  }

  .detail-stack,
  .finding-list,
  .reference-list,
  .script-list {
    display: grid;
    gap: 10px;
  }

  .detail-stack {
    gap: 16px;
  }

  .definition-list {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 5px 10px;
  }

  .definition-list dt {
    color: var(--sl-muted);
  }

  .definition-list dd {
    overflow-wrap: anywhere;
  }

  pre {
    max-height: 360px;
    overflow: auto;
    border: 1px solid var(--sl-border);
    border-radius: 8px;
    background: #0b0d11;
    padding: 10px;
    color: #dbe7f5;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .finding,
  .reference {
    border-left: 3px solid var(--sl-info);
    padding: 8px 10px;
    background: rgb(255 255 255 / 4%);
  }

  .finding[data-severity="error"] {
    border-color: var(--sl-error);
  }

  .finding[data-severity="warning"] {
    border-color: var(--sl-warning);
  }

  .status-error {
    color: var(--sl-error);
  }

  .status-warning {
    color: var(--sl-warning);
  }

  .status-info {
    color: var(--sl-info);
  }

  .live-region {
    min-height: 1.4em;
    color: var(--sl-muted);
    font-size: 12px;
  }

  .empty {
    color: var(--sl-muted);
    padding: 24px 4px;
    text-align: center;
  }

  @media (max-width: 640px) {
    :host {
      inset: 8px;
      width: auto !important;
    }

    .panel {
      height: calc(100dvh - 16px);
      border: 1px solid var(--sl-border);
      border-radius: 12px;
    }

    .resize-handle {
      display: none;
    }

    .entities-layout {
      grid-template-columns: 1fr;
    }

    .entity-nav {
      max-height: 34dvh;
      border-right: 0;
      border-bottom: 1px solid var(--sl-border);
    }
  }
`;
function Ge(t) {
  const e = t.document, n = e.defaultView;
  if (!n) throw new Error("Schema Lens requires a document with a browsing context.");
  const r = n, i = e.createElement("div");
  i.setAttribute(ve, ""), i.hidden = !0;
  const s = i.attachShadow({ mode: "open" }), o = e.createElement("style");
  o.textContent = Ye;
  const a = d(e, "section", "panel");
  a.setAttribute("role", "dialog"), a.setAttribute("aria-modal", "false"), a.setAttribute("aria-labelledby", "schema-lens-title"), a.tabIndex = -1;
  const c = d(e, "div", "resize-handle");
  c.tabIndex = 0, c.setAttribute("role", "separator"), c.setAttribute("aria-orientation", "vertical"), c.setAttribute("aria-label", "Resize Schema Lens panel"), c.setAttribute("aria-valuemin", "320"), c.setAttribute("aria-valuemax", String(Math.round(r.innerWidth * 0.8))), c.setAttribute("aria-valuenow", "480");
  const l = d(e, "header", "header"), f = d(e, "div", "header-row"), b = d(e, "h1");
  b.id = "schema-lens-title", b.textContent = "Schema Lens";
  const C = d(e, "div", "actions"), E = k(e, "Refresh inspection", "Refresh"), U = k(e, "Copy full inspection", "Copy"), te = k(e, "Close Schema Lens", "Close");
  C.append(E, U, te), f.append(b, C);
  const ne = d(e, "div", "counts"), L = d(e, "div", "live-region");
  L.setAttribute("role", "status"), L.setAttribute("aria-live", "polite"), l.append(f, ne, L);
  const B = d(e, "div", "tabs");
  B.setAttribute("role", "tablist");
  const $ = d(e, "main", "main");
  $.id = "schema-lens-view", a.append(c, l, B, $), s.append(o, a), (e.body ?? e.documentElement).append(i);
  let m = Y(e, t.rules ? { rules: t.rules } : {}), N = m.entities[0]?.key, j = "summary", R, Z = !1, O = null, q = !1;
  const re = (u) => {
    const p = m.entities.find((y) => y.key === N);
    if (m = u, p?.id) {
      const y = m.entities.filter((v) => v.id === p.id);
      y.length === 1 && (N = y[0].key);
    }
    m.entities.some((y) => y.key === N) || (N = m.entities[0]?.key), W();
  }, ie = () => {
    if (P(), R) return R.refresh();
    const u = Y(e, t.rules ? { rules: t.rules } : {});
    return re(u), u;
  };
  E.addEventListener("click", ie), U.addEventListener("click", () => {
    me(
      r,
      JSON.stringify(Xe(m), null, 2),
      L,
      "Inspection copied."
    );
  }), te.addEventListener("click", D);
  const se = (u) => {
    u.key === "Escape" && (u.preventDefault(), D());
  };
  a.addEventListener("keydown", se);
  const oe = (u) => {
    if (!q) return;
    const p = Math.min(
      Math.max(r.innerWidth - u.clientX, 320),
      r.innerWidth * 0.8
    );
    i.style.width = `${String(Math.round(p))}px`, c.setAttribute("aria-valuenow", String(Math.round(p)));
  }, ae = () => {
    q = !1;
  };
  return c.addEventListener("pointerdown", (u) => {
    q = !0, c.setPointerCapture?.(u.pointerId);
  }), r.addEventListener("pointermove", oe), r.addEventListener("pointerup", ae), (t.observeChanges ?? !0) && (R = qe(e, re, {
    ...t.rules ? { rules: t.rules } : {},
    ...t.debounceMs === void 0 ? {} : { debounceMs: t.debounceMs }
  })), W(), {
    open: ce,
    close: D,
    toggle() {
      P(), i.hidden ? ce() : D();
    },
    refresh: ie,
    getResult() {
      return P(), m;
    },
    destroy() {
      Z || (R?.disconnect(), R = void 0, r.removeEventListener("pointermove", oe), r.removeEventListener("pointerup", ae), a.removeEventListener("keydown", se), i.remove(), Z = !0, O = null);
    }
  };
  function ce() {
    P(), i.hidden && (O = e.activeElement, i.hidden = !1, a.focus());
  }
  function D() {
    P(), !i.hidden && (i.hidden = !0, O?.isConnected && "focus" in O && O.focus(), O = null);
  }
  function P() {
    if (Z) throw new Error("This Schema Lens inspector has been destroyed.");
  }
  function W() {
    Qe(e, ne, m), be(), $.replaceChildren(), j === "summary" && $.append(_e(e, m)), j === "entities" && $.append(xe()), j === "scripts" && $.append(Ce());
  }
  function be() {
    B.replaceChildren();
    const u = [
      ["summary", "Summary"],
      ["entities", `Entities (${String(m.summary.entityCount)})`],
      ["scripts", `Scripts (${String(m.summary.scriptCount)})`]
    ];
    for (const [p, y] of u) {
      const v = k(e, `Show ${y}`, y, "tab");
      v.setAttribute("role", "tab"), v.setAttribute("aria-selected", String(j === p)), v.setAttribute("aria-controls", $.id), v.addEventListener("click", () => {
        j = p, W();
      }), B.append(v);
    }
  }
  function xe() {
    if (m.entities.length === 0) return K(e, "No entities found.");
    const u = d(e, "div", "entities-layout"), p = d(e, "nav", "entity-nav");
    p.setAttribute("aria-label", "Schema entities");
    const y = d(e, "section", "entity-detail"), v = et(m.entities);
    for (const [S, w] of v) {
      const T = d(e, "section", "entity-group"), de = d(e, "h3");
      de.textContent = `${S} (${String(w.length)})`, T.append(de);
      for (const M of w) {
        const J = k(
          e,
          `Inspect ${H(M)}`,
          "",
          "entity-button"
        );
        J.setAttribute("aria-current", String(M.key === N));
        const le = d(e, "span", "entity-label");
        le.textContent = H(M);
        const ue = d(e, "span", "entity-meta");
        ue.textContent = `Script ${String(M.scriptIndex + 1)} · ${tt(M.findings)}`, J.append(le, ue), J.addEventListener("click", () => {
          N = M.key, W();
        }), T.append(J);
      }
      p.append(T);
    }
    const A = m.entities.find((S) => S.key === N);
    return y.append(
      A ? we(A) : K(e, "Select an entity.")
    ), u.append(p, y), u;
  }
  function we(u) {
    const p = d(e, "div", "detail-stack"), y = d(e, "h2");
    y.textContent = H(u);
    const v = d(e, "div", "actions"), A = k(e, "Copy selected entity JSON", "Copy JSON", "action-button");
    A.addEventListener("click", () => {
      me(
        r,
        JSON.stringify(u.value, null, 2),
        L,
        "Entity JSON copied."
      );
    });
    const S = k(e, "Log source script element", "Log source", "action-button");
    S.addEventListener("click", () => {
      console.log("Schema Lens source script", m.scripts[u.scriptIndex]?.element), L.textContent = "Source script logged to the console.";
    }), v.append(A, S);
    const w = d(e, "dl", "definition-list");
    V(e, w, "Types", u.types.join(", ") || "Untyped"), V(e, w, "@id", u.id ?? "None"), V(e, w, "Script", String(u.scriptIndex + 1)), V(e, w, "Path", u.path || "/");
    const T = d(e, "pre");
    return T.textContent = JSON.stringify(u.value, null, 2), p.append(y, v, w, z(e, "JSON", T)), p.append(
      z(e, "Findings", _(e, u.findings)),
      z(
        e,
        "Incoming references",
        ge(e, u.inboundReferences, "No incoming references.")
      ),
      z(
        e,
        "Outgoing references",
        ge(e, u.outboundReferences, "No outgoing references.")
      )
    ), p;
  }
  function Ce() {
    if (m.scripts.length === 0) return K(e, "No JSON-LD scripts found.");
    const u = d(e, "div", "view script-list");
    for (const p of m.scripts) {
      const y = d(e, "article", "script-card"), v = d(e, "h2");
      v.textContent = `Script ${String(p.index + 1)}`;
      const A = d(e, "p", "muted");
      A.textContent = `${ee(p.status)} · ${String(p.entities.length)} entities · ${String(p.findings.length)} findings`;
      const S = k(
        e,
        `Log source for script ${String(p.index + 1)}`,
        "Log source",
        "action-button"
      );
      S.addEventListener("click", () => {
        console.log("Schema Lens source script", p.element), L.textContent = `Script ${String(p.index + 1)} logged to the console.`;
      });
      const w = d(e, "pre");
      w.textContent = p.rawText, y.append(v, A, S, _(e, p.findings), w), u.append(y);
    }
    return u;
  }
}
function Qe(t, e, n) {
  e.replaceChildren();
  const r = [
    `${String(n.summary.entityCount)} entities`,
    `${String(n.summary.errorCount)} errors`,
    `${String(n.summary.warningCount)} warnings`
  ];
  for (const i of r) {
    const s = d(t, "span", "count");
    s.textContent = i, e.append(s);
  }
}
function _e(t, e) {
  const n = d(t, "div", "view"), r = d(t, "div", "summary-grid"), i = [
    ["Scripts", e.summary.scriptCount],
    ["Entities", e.summary.entityCount],
    ["Errors", e.summary.errorCount],
    ["Warnings", e.summary.warningCount],
    ["Duplicate IDs", e.summary.duplicateIdCount],
    ["Unresolved references", e.summary.unresolvedReferenceCount]
  ];
  for (const [o, a] of i) {
    const c = d(t, "div", "card"), l = d(t, "strong");
    l.textContent = String(a);
    const f = d(t, "span", "muted");
    f.textContent = o, c.append(l, f), r.append(c);
  }
  const s = d(t, "p");
  return s.textContent = e.summary.types.join(", ") || "None", n.append(r, z(t, "Types found", s)), n.append(z(t, "Page findings", _(t, e.findings))), n;
}
function _(t, e) {
  if (e.length === 0) return K(t, "No findings.");
  const n = d(t, "div", "finding-list");
  for (const r of e) {
    const i = d(t, "div", "finding");
    i.dataset.severity = r.severity;
    const s = d(t, "p");
    s.textContent = r.message;
    const o = d(t, "div", "finding-meta"), a = d(t, "strong", `status-${r.severity}`);
    a.textContent = ee(r.severity);
    const c = d(t, "span");
    c.textContent = `${r.ruleId}${r.path === void 0 ? "" : ` · ${r.path || "/"}`}`, o.append(a, c), i.append(s, o), n.append(i);
  }
  return n;
}
function ge(t, e, n) {
  if (e.length === 0) return K(t, n);
  const r = d(t, "div", "reference-list");
  for (const i of e) {
    const s = d(t, "div", "reference"), o = d(t, "p");
    o.textContent = i.targetId;
    const a = d(t, "div", "finding-meta");
    a.textContent = `${ee(i.status)} · ${i.propertyPath || "/"}`, s.append(o, a), r.append(s);
  }
  return r;
}
function et(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t) {
    const r = n.types.length > 0 ? n.types : ["Untyped"];
    for (const i of r) {
      const s = e.get(i) ?? [];
      s.push(n), e.set(i, s);
    }
  }
  return new Map([...e].sort(([n], [r]) => n.localeCompare(r)));
}
function H(t) {
  for (const e of ["name", "headline", "url"]) {
    const n = t.value[e];
    if (typeof n == "string" && n.trim()) return n;
  }
  return t.id ?? t.key;
}
function tt(t) {
  return t.some((e) => e.severity === "error") ? "Error" : t.some((e) => e.severity === "warning") ? "Warning" : t.some((e) => e.severity === "info") ? "Info" : "No findings";
}
function z(t, e, n) {
  const r = d(t, "section", "section"), i = d(t, "h2");
  return i.textContent = e, r.append(i, n), r;
}
function V(t, e, n, r) {
  const i = d(t, "dt");
  i.textContent = n;
  const s = d(t, "dd");
  s.textContent = r, e.append(i, s);
}
function K(t, e) {
  const n = d(t, "p", "empty");
  return n.textContent = e, n;
}
function d(t, e, n) {
  const r = t.createElement(e);
  return n && (r.className = n), r;
}
function k(t, e, n, r = "icon-button") {
  const i = d(t, "button", r);
  return i.type = "button", i.setAttribute("aria-label", e), i.textContent = n, i;
}
async function me(t, e, n, r) {
  try {
    if (!t.navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await t.navigator.clipboard.writeText(e), n.textContent = r;
  } catch {
    n.textContent = "Copy failed. Clipboard permission may be unavailable.";
  }
}
function ee(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
let ye;
document.addEventListener("click", (t) => {
  if (!(t.target instanceof Element)) return;
  const e = t.target.closest("[data-add-overlay]");
  e && (ye ??= Ge({ document }), ye.open(), e.textContent = "Open the overlay");
});

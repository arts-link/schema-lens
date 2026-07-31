import type { JsonObject } from "./types.js";

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function appendPointer(path: string, segment: string | number): string {
  const encoded = String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
  return `${path}/${encoded}`;
}

export function entityKey(scriptIndex: number, path: string): string {
  return `script:${scriptIndex}:path:${path || "/"}`;
}

export function isGraphOnlyWrapper(value: JsonObject): boolean {
  const keys = Object.keys(value);
  if (!("@graph" in value) || "@id" in value || "@type" in value) {
    return false;
  }
  return keys.every((key) => key.startsWith("@"));
}

export function isReferenceOnly(value: JsonObject): boolean {
  const keys = Object.keys(value).filter((key) => key !== "@context");
  return keys.length === 1 && keys[0] === "@id";
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!isObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])]),
  );
}

export function hasUriScheme(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || value.startsWith("//");
}

export function isValidUrl(value: string, baseUrl: string): boolean {
  try {
    new URL(value, baseUrl);
    return !/\s/.test(value);
  } catch {
    return false;
  }
}

export function isValidIsoDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
      value,
    );
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59)) {
    return false;
  }
  return match[6] === undefined || Number(match[6]) <= 59;
}

export function countSeverities(findings: readonly { severity: string }[]): {
  errorCount: number;
  warningCount: number;
  infoCount: number;
} {
  return findings.reduce(
    (counts, finding) => {
      if (finding.severity === "error") counts.errorCount += 1;
      if (finding.severity === "warning") counts.warningCount += 1;
      if (finding.severity === "info") counts.infoCount += 1;
      return counts;
    },
    { errorCount: 0, warningCount: 0, infoCount: 0 },
  );
}

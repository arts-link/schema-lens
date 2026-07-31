import type { InspectionResult, SerializableInspectionResult } from "./types.js";

export function serializeInspectionResult(result: InspectionResult): SerializableInspectionResult {
  return {
    scripts: result.scripts.map(({ element: _element, ...script }) => clone(script)),
    entities: clone(result.entities),
    findings: clone(result.findings),
    summary: clone(result.summary),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

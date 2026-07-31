import type { InspectionOptions, InspectionResult } from "@arts-link/schema-lens-core";

export interface SchemaInspectorOptions extends InspectionOptions {
  document: Document;
  observeChanges?: boolean;
  debounceMs?: number;
}

export interface SchemaInspector {
  open(): void;
  close(): void;
  toggle(): void;
  refresh(): InspectionResult;
  getResult(): InspectionResult;
  destroy(): void;
}

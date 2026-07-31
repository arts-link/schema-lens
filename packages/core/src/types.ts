export type JsonObject = Record<string, unknown>;

export type FindingSeverity = "error" | "warning" | "info";

export interface SchemaFinding {
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  scriptIndex?: number;
  entityKey?: string;
  path?: string;
}

export type ReferenceStatus = "resolved" | "unresolved" | "ambiguous" | "external";

export interface EntityReference {
  sourceKey: string;
  targetId: string;
  propertyPath: string;
  status: ReferenceStatus;
  resolvedTargetKey?: string;
  candidateTargetKeys?: string[];
}

export interface InspectedEntity {
  key: string;
  id?: string;
  types: string[];
  value: JsonObject;
  scriptIndex: number;
  path: string;
  inboundReferences: EntityReference[];
  outboundReferences: EntityReference[];
  findings: SchemaFinding[];
}

export type ScriptStatus = "valid" | "empty" | "invalid";

export interface SchemaScriptResult {
  index: number;
  element: HTMLScriptElement;
  rawText: string;
  status: ScriptStatus;
  parsedValue?: unknown;
  entities: InspectedEntity[];
  findings: SchemaFinding[];
}

export interface InspectionSummary {
  scriptCount: number;
  entityCount: number;
  types: string[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  duplicateIdCount: number;
  unresolvedReferenceCount: number;
  ambiguousReferenceCount: number;
}

export interface InspectionResult {
  scripts: SchemaScriptResult[];
  entities: InspectedEntity[];
  findings: SchemaFinding[];
  summary: InspectionSummary;
}

export type RuleFinding = Omit<SchemaFinding, "ruleId">;

export interface EntityRuleContext {
  scope: "entity";
  entity: InspectedEntity;
  result: InspectionResult;
}

export interface ResultRuleContext {
  scope: "result";
  result: InspectionResult;
}

interface InspectorRuleBase {
  id: string;
  description?: string;
}

export interface EntityInspectorRule extends InspectorRuleBase {
  scope: "entity";
  inspect(context: EntityRuleContext): RuleFinding[];
}

export interface ResultInspectorRule extends InspectorRuleBase {
  scope: "result";
  inspect(context: ResultRuleContext): RuleFinding[];
}

export type InspectorRule = EntityInspectorRule | ResultInspectorRule;

export interface InspectionOptions {
  rules?: readonly InspectorRule[];
}

export interface ObserverOptions extends InspectionOptions {
  debounceMs?: number;
}

export interface SchemaObserver {
  refresh(): InspectionResult;
  disconnect(): void;
}

export type SerializableSchemaScriptResult = Omit<SchemaScriptResult, "element">;

export interface SerializableInspectionResult {
  scripts: SerializableSchemaScriptResult[];
  entities: InspectedEntity[];
  findings: SchemaFinding[];
  summary: InspectionSummary;
}

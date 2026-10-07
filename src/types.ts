export type Severity = "info" | "warning" | "error";

export interface TableContext {
  schema: string;
  table: string;
  bytes: number;
  estimatedRows: number;
}

export interface DatabaseContext {
  serverVersion: number;
  tables: Map<string, TableContext>;
}

export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  table?: string;
  title: string;
  detail: string;
  suggestion: string;
  lock?: string;
  context?: {
    bytes: number;
    estimatedRows: number;
  };
}

export interface AnalysisResult {
  findings: Finding[];
  files: number;
  statements: number;
  databaseConnected: boolean;
}

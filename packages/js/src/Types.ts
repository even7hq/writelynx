export type {
    WriteLynxRuleset,
    ValidatorSpec,
    FieldRule,
    PatternRule
} from "@writelynx/builtin-rules";

export type RuleUse = "redaction" | "validation";

export interface WriteLynxEngineOptions {
    rulesPaths?: string[];
    rules?: Partial<import("@writelynx/builtin-rules").WriteLynxRuleset>;
}

export interface ValidationResult {
    valid: boolean;
    ruleId: string;
    validatorId?: string;
    message?: string;
}

export interface TestResult {
    matched: boolean;
    validatorPassed: boolean;
    ruleId: string;
    redactedPreview?: string;
}

export interface ExtractResult {
    matches: string[];
    ruleId: string;
}

export interface CompiledFieldRule {
    id: string;
    category?: string;
    regex: RegExp;
    enabled: boolean;
    builtin: boolean;
}

export interface CompiledPatternRule {
    id: string;
    category?: string;
    regex: RegExp;
    replacement?: (match: string, ...groups: string[]) => string;
    validator?: (value: string) => boolean;
    uses: RuleUse[];
    enabled: boolean;
    builtin: boolean;
}

export interface CompiledRuleset {
    fieldRules: CompiledFieldRule[];
    patternRules: CompiledPatternRule[];
    validators: Map<string, (digits: string) => boolean>;
}

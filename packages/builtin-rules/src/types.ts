export interface Mod11Check {
    weights: number[];
    checkIndex: number;
}

export interface Mod11ValidatorSpec {
    type: "mod11";
    digitLength: number;
    rejectAllSame?: boolean;
    checks: Mod11Check[];
}

export interface LuhnValidatorSpec {
    type: "luhn";
    digitLength: number;
}

export type ValidatorSpec = Mod11ValidatorSpec | LuhnValidatorSpec;

export interface FieldRule {
    id: string;
    category?: string;
    pattern: string;
    flags?: string;
    enabled?: boolean;
    builtin?: boolean;
}

export interface PatternRule {
    id: string;
    category?: string;
    description?: string;
    pattern: string;
    flags?: string;
    replacement?: string;
    validator?: string;
    uses?: ("redaction" | "validation")[];
    enabled?: boolean;
    builtin?: boolean;
}

export interface WriteLynxRuleset {
    validators: Record<string, ValidatorSpec>;
    field: {
        rules: FieldRule[];
    };
    pattern: {
        rules: PatternRule[];
    };
}

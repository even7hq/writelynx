import { readFileSync } from "node:fs";
import { getBuiltinRuleset } from "@writelynx/builtin-rules";
import type { FieldRule, PatternRule, ValidatorSpec, WriteLynxRuleset } from "@writelynx/builtin-rules";
import { RuleCompiler } from "./RuleCompiler";
import { RulesetMerge } from "./RulesetMerge";
import type {
    CompiledRuleset,
    ExtractResult,
    RuleUse,
    TestResult,
    ValidationResult,
    WriteLynxEngineOptions
} from "./Types";

const MAX_DEPTH = 10;
const REDACTED_PLACEHOLDER = "[REDACTED]";
const FIELD_REDACTED = "[REDACTED]";
const MAX_DEPTH_EXCEEDED = "[MAX_DEPTH_EXCEEDED]";
const CIRCULAR_REFERENCE = "[CIRCULAR_REFERENCE]";

export class WriteLynxEngine {
    private enabled = true;
    private readonly builtinRuleset: WriteLynxRuleset;
    private customOverlays: Partial<WriteLynxRuleset>[] = [];
    private removedCustomIds = new Set<string>();
    private activeRuleset: WriteLynxRuleset;
    private compiled: CompiledRuleset;
    private compileOptions: RuleCompiler.CompileOptions = {};

    /**
     * Creates an engine with builtin rules only.
     *
     * @returns Engine instance with default builtin ruleset
     */
    public static createDefault(): WriteLynxEngine {
        return new WriteLynxEngine();
    }

    /**
     * Creates an engine with builtin rules plus optional file/object overlays.
     *
     * @param options - Optional rules paths and inline rules partial
     * @returns Configured engine instance
     */
    public static create(options: WriteLynxEngineOptions = {}): WriteLynxEngine {
        const engine = new WriteLynxEngine();

        if (options.rules) {
            engine.loadRulesFromJson(options.rules);
        }

        if (options.rulesPaths) {
            for (const path of options.rulesPaths) {
                engine.loadRulesFromFile(path);
            }
        }

        return engine;
    }

    /**
     * Constructs the engine and compiles the initial builtin ruleset.
     */
    public constructor() {
        this.builtinRuleset = getBuiltinRuleset();
        this.activeRuleset = { ...this.builtinRuleset };
        this.compiled = RuleCompiler.compile(this.activeRuleset);
    }

    /**
     * Deep-redacts sensitive data in an arbitrary value (objects, arrays, primitives).
     *
     * @param value - Value to redact
     * @param depth - Current recursion depth (internal)
     * @param seen - WeakSet for circular reference detection (internal)
     * @returns Redacted copy
     */
    public redact<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
        if (!this.enabled) {
            return value;
        }

        if (depth > MAX_DEPTH) {
            return MAX_DEPTH_EXCEEDED as T;
        }

        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === "string") {
            return this.redactString(value) as T;
        }

        if (value instanceof Date) {
            return value;
        }

        if (typeof value !== "object") {
            return value;
        }

        if (seen.has(value as object)) {
            return CIRCULAR_REFERENCE as T;
        }

        seen.add(value as object);

        if (Array.isArray(value)) {
            const result = value.map((item) => this.redact(item, depth + 1, seen));
            seen.delete(value as object);
            return result as T;
        }

        const result: Record<string, unknown> = {};

        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            if (this.isSensitiveFieldKey(key.toLowerCase())) {
                result[key] = FIELD_REDACTED;
            } else {
                result[key] = this.redact(child, depth + 1, seen);
            }
        }

        seen.delete(value as object);
        return result as T;
    }

    /**
     * Redacts sensitive patterns in a string.
     *
     * @param input - Input string
     * @returns Redacted string
     */
    public redactString(input: string): string {
        if (!this.enabled || input.length === 0) {
            return input;
        }

        let output = input;

        for (const rule of this.compiled.patternRules) {
            if (!rule.uses.includes("redaction")) {
                continue;
            }

            output = output.replace(rule.regex, (match, ...groups) => {
                if (rule.validator && !rule.validator(match)) {
                    return match;
                }

                if (rule.replacement) {
                    return rule.replacement(match, ...groups);
                }

                return REDACTED_PLACEHOLDER;
            });
        }

        return output;
    }

    /**
     * Returns true if the value or string contains sensitive data per active rules.
     *
     * @param value - Value or string to inspect
     * @returns Whether sensitive data was detected
     */
    public containsSensitiveData(value: unknown): boolean {
        if (!this.enabled) {
            return false;
        }

        if (typeof value === "string") {
            return this.stringContainsSensitive(value);
        }

        if (value === null || value === undefined || typeof value !== "object") {
            return false;
        }

        if (Array.isArray(value)) {
            return value.some((item) => this.containsSensitiveData(item));
        }

        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            if (this.isSensitiveFieldKey(key.toLowerCase())) {
                return true;
            }

            if (this.containsSensitiveData(child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validates a value against a pattern rule validator (by rule id).
     *
     * @param ruleId - Pattern rule id (e.g. cpf)
     * @param value - Value to validate
     * @returns Validation result
     */
    public validate(ruleId: string, value: string): ValidationResult {
        const rule = this.findPatternRule(ruleId);

        if (!rule) {
            return { valid: false, ruleId, message: `Unknown rule: ${ruleId}` };
        }

        if (!rule.validator) {
            return { valid: false, ruleId, message: "Rule has no validator" };
        }

        const valid = rule.validator(value);

        return {
            valid,
            ruleId,
            validatorId: this.getValidatorIdForRule(ruleId)
        };
    }

    /**
     * Tests whether a value matches a rule pattern and passes its validator.
     *
     * @param ruleId - Pattern rule id
     * @param value - Value to test
     * @returns Test result with match and validator status
     */
    public test(ruleId: string, value: string): TestResult {
        const rule = this.findPatternRule(ruleId);

        if (!rule) {
            return { matched: false, validatorPassed: false, ruleId };
        }

        const match = rule.regex.exec(value);
        rule.regex.lastIndex = 0;

        if (!match) {
            return { matched: false, validatorPassed: false, ruleId };
        }

        const matchedValue = match[0];
        const validatorPassed = rule.validator ? rule.validator(matchedValue) : true;

        return {
            matched: true,
            validatorPassed,
            ruleId,
            redactedPreview: validatorPassed ? this.redactString(matchedValue) : undefined
        };
    }

    /**
     * Extracts all substrings matching a pattern rule from text.
     *
     * @param ruleId - Pattern rule id
     * @param text - Text to scan
     * @returns Extract result with matches
     */
    public extract(ruleId: string, text: string): ExtractResult {
        const rule = this.findPatternRule(ruleId);

        if (!rule) {
            return { matches: [], ruleId };
        }

        const flags = rule.regex.flags.includes("g")
            ? rule.regex.flags
            : `${rule.regex.flags}g`;
        const globalRegex = new RegExp(rule.regex.source, flags);
        const matches: string[] = [];

        for (const match of text.matchAll(globalRegex)) {
            const value = match[0];

            if (!rule.validator || rule.validator(value)) {
                matches.push(value);
            }
        }

        return { matches, ruleId };
    }

    /**
     * Lists active rules, optionally filtered by use.
     *
     * @param uses - Optional use filter (redaction, validation)
     * @returns Pattern and field rule summaries
     */
    public listRules(uses?: RuleUse[]): {
        field: FieldRule[];
        pattern: PatternRule[];
    } {
        const compiled = RuleCompiler.compile(this.activeRuleset, { uses });

        const fieldIds = new Set(compiled.fieldRules.map((r) => r.id));
        const patternIds = new Set(compiled.patternRules.map((r) => r.id));

        return {
            field: this.activeRuleset.field.rules.filter((r) => fieldIds.has(r.id)),
            pattern: this.activeRuleset.pattern.rules.filter((r) => patternIds.has(r.id))
        };
    }

    /**
     * Loads and merges rules from a JSON file path.
     *
     * @param path - Filesystem path to rules JSON
     * @returns Nothing.
     */
    public loadRulesFromFile(path: string): void {
        const raw = readFileSync(path, "utf8");
        const parsed = JSON.parse(raw) as Partial<WriteLynxRuleset>;
        this.loadRulesFromJson(parsed);
    }

    /**
     * Merges a partial ruleset into the custom overlay stack and recompiles.
     *
     * @param rules - Partial ruleset overlay
     * @returns Nothing.
     */
    public loadRulesFromJson(rules: Partial<WriteLynxRuleset>): void {
        this.customOverlays.push(rules);
        this.removedCustomIds.clear();
        this.rebuildActiveRuleset();
    }

    /**
     * Registers or overrides a validator spec at runtime.
     *
     * @param id - Validator id
     * @param spec - Validator specification
     * @returns Nothing.
     */
    public registerValidator(id: string, spec: ValidatorSpec): void {
        this.loadRulesFromJson({ validators: { [id]: spec } });
    }

    /**
     * Registers or overrides a field rule at runtime.
     *
     * @param rule - Field rule definition
     * @returns Nothing.
     */
    public registerFieldRule(rule: FieldRule): void {
        this.loadRulesFromJson({ field: { rules: [rule] } });
    }

    /**
     * Registers or overrides a pattern rule at runtime.
     *
     * @param rule - Pattern rule definition
     * @returns Nothing.
     */
    public registerPatternRule(rule: PatternRule): void {
        this.loadRulesFromJson({ pattern: { rules: [rule] } });
    }

    /**
     * Unregisters a custom rule by id (builtin returns after reload if not overridden).
     *
     * @param id - Rule id to remove from custom overlays
     * @returns Nothing.
     */
    public unregisterRule(id: string): void {
        this.removedCustomIds.add(id);
        this.rebuildActiveRuleset();
    }

    /**
     * Rebuilds the active ruleset from builtin + custom overlays and recompiles matchers.
     *
     * @returns Nothing.
     */
    public reload(): void {
        this.rebuildActiveRuleset();
    }

    /**
     * Enables or disables all redaction (validation unaffected).
     *
     * @param enabled - Whether redaction is enabled
     * @returns Nothing.
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Returns whether redaction is currently enabled.
     *
     * @returns Enabled flag
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Returns the readonly builtin ruleset snapshot.
     *
     * @returns Builtin ruleset
     */
    public getBuiltinRules(): Readonly<WriteLynxRuleset> {
        return this.builtinRuleset;
    }

    /**
     * Returns the readonly active (post-merge) ruleset.
     *
     * @returns Active ruleset
     */
    public getActiveRules(): Readonly<WriteLynxRuleset> {
        return this.activeRuleset;
    }

    /**
     * Returns true if the rule id exists in the builtin ruleset.
     *
     * @param id - Rule id
     * @returns Whether the rule is builtin
     */
    public isBuiltinRule(id: string): boolean {
        const inField = this.builtinRuleset.field.rules.some((r) => r.id === id);
        const inPattern = this.builtinRuleset.pattern.rules.some((r) => r.id === id);

        return inField || inPattern;
    }

    /**
     * Sets category filter for compilation (used by CLI --only).
     *
     * @param categories - Category names to include
     * @returns Nothing.
     */
    public setCategoryFilter(categories: string[]): void {
        this.compileOptions = { ...this.compileOptions, categories };
        this.compiled = RuleCompiler.compile(this.activeRuleset, this.compileOptions);
    }

    /**
     * Rebuilds merged ruleset and recompiles pattern/field matchers.
     *
     * @returns Nothing.
     */
    private rebuildActiveRuleset(): void {
        let merged = structuredClone(this.builtinRuleset) as WriteLynxRuleset;

        for (const overlay of this.customOverlays) {
            merged = RulesetMerge.merge(merged, overlay);
        }

        for (const id of this.removedCustomIds) {
            if (!this.isBuiltinRule(id)) {
                merged = RulesetMerge.removeRuleById(merged, id);
            } else {
                const builtinField = this.builtinRuleset.field.rules.find((r) => r.id === id);
                const builtinPattern = this.builtinRuleset.pattern.rules.find((r) => r.id === id);

                if (builtinField) {
                    merged.field.rules = merged.field.rules.filter((r) => r.id !== id);
                    merged.field.rules.push(builtinField);
                }

                if (builtinPattern) {
                    merged.pattern.rules = merged.pattern.rules.filter((r) => r.id !== id);
                    merged.pattern.rules.push(builtinPattern);
                }
            }
        }

        this.activeRuleset = merged;
        this.compiled = RuleCompiler.compile(this.activeRuleset, this.compileOptions);
    }

    /**
     * Returns true if any field rule matches the object key name.
     *
     * @param key - Object property key
     * @returns Whether the key is sensitive
     */
    private isSensitiveFieldKey(key: string): boolean {
        return this.compiled.fieldRules.some((rule) => rule.regex.test(key));
    }

    /**
     * Returns true if a string matches any active pattern or field heuristic.
     *
     * @param input - String to check
     * @returns Whether sensitive content was found
     */
    private stringContainsSensitive(input: string): boolean {
        for (const rule of this.compiled.patternRules) {
            const flags = rule.regex.flags.includes("g")
                ? rule.regex.flags
                : `${rule.regex.flags}g`;
            const re = new RegExp(rule.regex.source, flags);

            for (const match of input.matchAll(re)) {
                const value = match[0];

                if (!rule.validator || rule.validator(value)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Finds a compiled pattern rule by id.
     *
     * @param ruleId - Pattern rule id
     * @returns Compiled pattern rule or undefined
     */
    private findPatternRule(ruleId: string): CompiledRuleset["patternRules"][number] | undefined {
        return this.compiled.patternRules.find((r) => r.id === ruleId);
    }

    /**
     * Resolves validator id for a pattern rule from the active ruleset.
     *
     * @param ruleId - Pattern rule id
     * @returns Validator id or undefined
     */
    private getValidatorIdForRule(ruleId: string): string | undefined {
        return this.activeRuleset.pattern.rules.find((r) => r.id === ruleId)?.validator;
    }
}

/**
 * Creates the default WriteLynx engine (builtin rules only).
 *
 * @returns Default engine instance
 */
export function createDefaultEngine(): WriteLynxEngine {
    return WriteLynxEngine.createDefault();
}

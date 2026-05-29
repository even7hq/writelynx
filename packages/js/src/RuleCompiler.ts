import type { FieldRule, PatternRule, WriteLynxRuleset } from "@writelynx/builtin-rules";
import type { CompiledFieldRule, CompiledPatternRule, CompiledRuleset, RuleUse } from "./Types";
import { TemplateEngine } from "./TemplateEngine";
import { ValidatorCompiler } from "./ValidatorCompiler";

export namespace RuleCompiler {
    export interface CompileOptions {
        categories?: string[];
        uses?: RuleUse[];
    }

    /**
     * Builds a RegExp from pattern and flags strings.
     *
     * @param pattern - Regex source
     * @param flags - Regex flags
     * @returns Compiled RegExp
     */
    function toRegex(pattern: string, flags?: string): RegExp {
        return new RegExp(pattern, flags ?? "");
    }

    /**
     * Returns true when the rule category passes the filter (if any).
     *
     * @param category - Rule category
     * @param categories - Allowed categories filter
     * @returns Whether the rule should be included
     */
    function matchesCategory(category: string | undefined, categories?: string[]): boolean {
        if (!categories || categories.length === 0) {
            return true;
        }

        return category !== undefined && categories.includes(category);
    }

    /**
     * Returns true when rule uses overlap the requested uses filter.
     *
     * @param ruleUses - Rule uses array
     * @param filter - Requested uses filter
     * @returns Whether the rule should be included
     */
    function matchesUses(ruleUses: RuleUse[] | undefined, filter?: RuleUse[]): boolean {
        if (!filter || filter.length === 0) {
            return true;
        }

        const uses = ruleUses ?? ["redaction"];

        return filter.some((u) => uses.includes(u));
    }

    /**
     * Compiles a field rule into a matcher.
     *
     * @param rule - Field rule definition
     * @param options - Compile filters
     * @returns Compiled field rule or null if filtered out
     */
    function compileFieldRule(rule: FieldRule, options: CompileOptions): CompiledFieldRule | null {
        if (rule.enabled === false) {
            return null;
        }

        if (!matchesCategory(rule.category, options.categories)) {
            return null;
        }

        return {
            id: rule.id,
            category: rule.category,
            regex: toRegex(rule.pattern, rule.flags),
            enabled: true,
            builtin: rule.builtin === true
        };
    }

    /**
     * Compiles a pattern rule into a matcher with optional validator and replacement.
     *
     * @param rule - Pattern rule definition
     * @param validators - Compiled validator map
     * @param options - Compile filters
     * @returns Compiled pattern rule or null if filtered out
     */
    function compilePatternRule(
        rule: PatternRule,
        validators: Map<string, (digits: string) => boolean>,
        options: CompileOptions
    ): CompiledPatternRule | null {
        if (rule.enabled === false) {
            return null;
        }

        if (!matchesCategory(rule.category, options.categories)) {
            return null;
        }

        const uses = (rule.uses ?? ["redaction"]) as RuleUse[];

        if (!matchesUses(uses, options.uses)) {
            return null;
        }

        let validator: ((value: string) => boolean) | undefined;

        if (rule.validator) {
            const fn = validators.get(rule.validator);

            if (fn) {
                validator = (value: string) => fn(ValidatorCompiler.extractDigits(value));
            }
        }

        let replacement: ((match: string, ...groups: string[]) => string) | undefined;

        if (rule.replacement) {
            const compiled = TemplateEngine.compile(rule.replacement);
            replacement = compiled;
        }

        return {
            id: rule.id,
            category: rule.category,
            regex: toRegex(rule.pattern, rule.flags),
            replacement,
            validator,
            uses,
            enabled: true,
            builtin: rule.builtin === true
        };
    }

    /**
     * Compiles a full ruleset into executable matchers.
     *
     * @param ruleset - Merged ruleset
     * @param options - Optional category/use filters
     * @returns Compiled ruleset
     */
    export function compile(ruleset: WriteLynxRuleset, options: CompileOptions = {}): CompiledRuleset {
        const validators = new Map<string, (digits: string) => boolean>();

        for (const [id, spec] of Object.entries(ruleset.validators)) {
            validators.set(id, ValidatorCompiler.compile(spec));
        }

        const fieldRules: CompiledFieldRule[] = [];

        for (const rule of ruleset.field.rules) {
            const compiled = compileFieldRule(rule, options);

            if (compiled) {
                fieldRules.push(compiled);
            }
        }

        const patternRules: CompiledPatternRule[] = [];

        for (const rule of ruleset.pattern.rules) {
            const compiled = compilePatternRule(rule, validators, options);

            if (compiled) {
                patternRules.push(compiled);
            }
        }

        return { fieldRules, patternRules, validators };
    }
}

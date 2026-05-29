import type { FieldRule, PatternRule, ValidatorSpec, WriteLynxRuleset } from "@writelynx/builtin-rules";

export namespace RulesetMerge {
    /**
     * Merges a partial ruleset overlay onto a base ruleset (custom overrides builtin by id).
     *
     * @param base - Base ruleset (typically builtin)
     * @param overlay - Partial custom ruleset
     * @returns New merged ruleset
     */
    export function merge(base: WriteLynxRuleset, overlay: Partial<WriteLynxRuleset>): WriteLynxRuleset {
        const validators: Record<string, ValidatorSpec> = { ...base.validators };

        if (overlay.validators) {
            Object.assign(validators, overlay.validators);
        }

        const fieldRules = mergeRulesById(base.field.rules, overlay.field?.rules ?? []);
        const patternRules = mergeRulesById(base.pattern.rules, overlay.pattern?.rules ?? []);

        return {
            validators,
            field: { rules: fieldRules },
            pattern: { rules: patternRules }
        };
    }

    /**
     * Merges rule arrays by id; overlay entries replace base entries with the same id.
     *
     * @param baseRules - Base rule list
     * @param overlayRules - Overlay rule list
     * @returns Merged rule list
     */
    function mergeRulesById<T extends { id: string }>(baseRules: T[], overlayRules: T[]): T[] {
        const byId = new Map<string, T>();

        for (const rule of baseRules) {
            byId.set(rule.id, rule);
        }

        for (const rule of overlayRules) {
            byId.set(rule.id, rule);
        }

        return Array.from(byId.values());
    }

    /**
     * Removes a rule by id from field and pattern lists.
     *
     * @param ruleset - Active ruleset
     * @param id - Rule id to remove
     * @returns Updated ruleset without the rule
     */
    export function removeRuleById(ruleset: WriteLynxRuleset, id: string): WriteLynxRuleset {
        return {
            validators: { ...ruleset.validators },
            field: {
                rules: ruleset.field.rules.filter((r: FieldRule) => r.id !== id)
            },
            pattern: {
                rules: ruleset.pattern.rules.filter((r: PatternRule) => r.id !== id)
            }
        };
    }
}

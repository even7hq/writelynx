import validatorsJson from "../validation/validators.json";
import fieldRulesJson from "../redaction/field.rules.json";
import patternRulesJson from "../redaction/pattern.rules.json";
import type { WriteLynxRuleset } from "./types";

export type {
    WriteLynxRuleset,
    ValidatorSpec,
    Mod11ValidatorSpec,
    LuhnValidatorSpec,
    FieldRule,
    PatternRule
} from "./types";

/**
 * Returns the built-in WriteLynx ruleset (validators + field + pattern rules).
 *
 * @returns Merged builtin ruleset ready for engine consumption
 */
export function getBuiltinRuleset(): WriteLynxRuleset {
    return {
        validators: validatorsJson as WriteLynxRuleset["validators"],
        field: {
            rules: fieldRulesJson as WriteLynxRuleset["field"]["rules"]
        },
        pattern: {
            rules: patternRulesJson as WriteLynxRuleset["pattern"]["rules"]
        }
    };
}

/**
 * Raw validation validator specs JSON.
 *
 * @returns Validator map keyed by id
 */
export function getBuiltinValidators(): WriteLynxRuleset["validators"] {
    return validatorsJson as WriteLynxRuleset["validators"];
}

/**
 * Raw field redaction rules array.
 *
 * @returns Field rules list
 */
export function getBuiltinFieldRules(): WriteLynxRuleset["field"]["rules"] {
    return fieldRulesJson as WriteLynxRuleset["field"]["rules"];
}

/**
 * Raw pattern rules array.
 *
 * @returns Pattern rules list
 */
export function getBuiltinPatternRules(): WriteLynxRuleset["pattern"]["rules"] {
    return patternRulesJson as WriteLynxRuleset["pattern"]["rules"];
}

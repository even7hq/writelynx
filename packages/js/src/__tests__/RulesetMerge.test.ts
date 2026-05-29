import { describe, expect, it } from "vitest";
import { getBuiltinRuleset } from "@writelynx/builtin-rules";
import { RulesetMerge } from "../RulesetMerge";

describe("RulesetMerge", () => {
    it("overrides builtin pattern rule by id", () => {
        const base = getBuiltinRuleset();
        const merged = RulesetMerge.merge(base, {
            pattern: {
                rules: [{ id: "cpf", enabled: false, pattern: "x", uses: ["redaction"] }]
            }
        });

        const cpf = merged.pattern.rules.find((r) => r.id === "cpf");
        expect(cpf?.enabled).toBe(false);
    });

    it("appends new custom pattern rule", () => {
        const base = getBuiltinRuleset();
        const merged = RulesetMerge.merge(base, {
            pattern: {
                rules: [{
                    id: "custom_secret",
                    pattern: "SECRET-\\d+",
                    replacement: "[CUSTOM]",
                    uses: ["redaction"]
                }]
            }
        });

        expect(merged.pattern.rules.some((r) => r.id === "custom_secret")).toBe(true);
    });
});

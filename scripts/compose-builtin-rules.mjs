import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import validators from "../packages/builtin-rules/validation/validators.json" with { type: "json" };
import fieldRules from "../packages/builtin-rules/redaction/field.rules.json" with { type: "json" };
import patternRules from "../packages/builtin-rules/redaction/pattern.rules.json" with { type: "json" };

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "packages/builtin-rules/dist");
const ruleset = {
    validators,
    field: { rules: fieldRules },
    pattern: { rules: patternRules }
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "ruleset.json"), JSON.stringify(ruleset, null, 2));
console.log("Wrote packages/builtin-rules/dist/ruleset.json");

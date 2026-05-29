import { describe, expect, it } from "vitest";
import { WriteLynxEngine } from "../WriteLynxEngine";

describe("WriteLynxEngine", () => {
    it("redacts valid CPF in string", () => {
        const engine = WriteLynxEngine.createDefault();
        const input = "user cpf 529.982.247-25 ok";
        const output = engine.redactString(input);
        expect(output).not.toContain("529.982.247-25");
        expect(output).toContain("***");
    });

    it("redacts sensitive field keys in objects", () => {
        const engine = WriteLynxEngine.createDefault();
        const output = engine.redact({ password: "secret123", name: "Alice" }) as Record<string, unknown>;
        expect(output.password).toBe("[REDACTED]");
        expect(output.name).toBe("Alice");
    });

    it("validates CPF rule", () => {
        const engine = WriteLynxEngine.createDefault();
        expect(engine.validate("cpf", "529.982.247-25").valid).toBe(true);
        expect(engine.validate("cpf", "123.456.789-00").valid).toBe(false);
    });

    it("detects sensitive data", () => {
        const engine = WriteLynxEngine.createDefault();
        expect(engine.containsSensitiveData({ token: "abc" })).toBe(true);
        expect(engine.containsSensitiveData({ name: "Bob" })).toBe(false);
    });

    it("respects setEnabled(false)", () => {
        const engine = WriteLynxEngine.createDefault();
        engine.setEnabled(false);
        const input = "529.982.247-25";
        expect(engine.redactString(input)).toBe(input);
    });

    it("registers custom pattern rule and reloads", () => {
        const engine = WriteLynxEngine.createDefault();
        engine.registerPatternRule({
            id: "tenant_code",
            pattern: "TENANT-\\d{4}",
            replacement: "TENANT-****",
            uses: ["redaction"]
        });
        engine.reload();
        expect(engine.redactString("id TENANT-1234")).toContain("TENANT-****");
    });
});

import { describe, expect, it } from "vitest";
import { ValidatorCompiler } from "../ValidatorCompiler";
import type { ValidatorSpec } from "@writelynx/builtin-rules";

const cpfSpec: ValidatorSpec = {
    type: "mod11",
    digitLength: 11,
    rejectAllSame: true,
    checks: [
        { weights: [10, 9, 8, 7, 6, 5, 4, 3, 2], checkIndex: 9 },
        { weights: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2], checkIndex: 10 }
    ]
};

const luhnSpec: ValidatorSpec = {
    type: "luhn",
    digitLength: 16
};

describe("ValidatorCompiler", () => {
    it("accepts valid CPF checksum", () => {
        const validate = ValidatorCompiler.compile(cpfSpec);
        expect(validate("52998224725")).toBe(true);
    });

    it("rejects invalid CPF checksum", () => {
        const validate = ValidatorCompiler.compile(cpfSpec);
        expect(validate("12345678901")).toBe(false);
    });

    it("rejects CPF with all same digits", () => {
        const validate = ValidatorCompiler.compile(cpfSpec);
        expect(validate("11111111111")).toBe(false);
    });

    it("accepts valid Luhn card", () => {
        const validate = ValidatorCompiler.compile(luhnSpec);
        expect(validate("4111111111111111")).toBe(true);
    });

    it("rejects invalid Luhn card", () => {
        const validate = ValidatorCompiler.compile(luhnSpec);
        expect(validate("4111111111111112")).toBe(false);
    });
});

import { describe, expect, it } from "vitest";
import { TemplateEngine } from "../TemplateEngine";

describe("TemplateEngine", () => {
    it("replaces $0 with full match", () => {
        const fn = TemplateEngine.compile("$0[0:4]***");
        expect(fn("abcdefghij")).toBe("abcd***");
    });

    it("replaces $1 with first capture group", () => {
        const fn = TemplateEngine.compile("$1[0:2]***@$2");
        expect(fn("user@example.com", "user", "example.com")).toBe("us***@example.com");
    });

    it("replaces $d with digits and slice", () => {
        const fn = TemplateEngine.compile("***.$d[3:6].$d[6:9]-**");
        expect(fn("123.456.789-09")).toBe("***.456.789-**");
    });

    it("supports negative end slice on $0", () => {
        const fn = TemplateEngine.compile("$0[0:3]*****$0[-2:]");
        expect(fn("+5511999887766")).toBe("+5511999887766".slice(0, 3) + "*****" + "66");
    });
});

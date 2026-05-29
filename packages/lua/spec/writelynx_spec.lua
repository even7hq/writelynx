package.path = package.path .. ";./src/?.lua;./src/?/init.lua"

local writelynx = require("writelynx.init")
local ruleset_merge = require("writelynx.ruleset_merge")
local templates = require("writelynx.templates")
local validators = require("writelynx.validators")

describe("writelynx lua", function()
    it("merges rulesets by id", function()
        local base = {
            validators = {},
            field = { rules = { { id = "a", pattern = "x" } } },
            pattern = { rules = {} }
        }
        local merged = ruleset_merge.merge(base, {
            field = { rules = { { id = "a", pattern = "y" } } }
        })
        assert.equals(merged.field.rules[1].pattern, "y")
    end)

    it("compiles templates with $d slices", function()
        local fn = templates.compile("***.$d[3:6].$d[6:9]-**")
        assert.equals(fn("123.456.789-09"), "***.456.789-**")
    end)

    it("validates mod11 cpf digits", function()
        local spec = {
            type = "mod11",
            digitLength = 11,
            rejectAllSame = true,
            checks = {
                { weights = { 10, 9, 8, 7, 6, 5, 4, 3, 2 }, checkIndex = 9 },
                { weights = { 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 }, checkIndex = 10 }
            }
        }
        local fn = validators.compile(spec)
        assert.is_true(fn("52998224725"))
        assert.is_false(fn("11111111111"))
    end)

    it("redacts valid cpf in string", function()
        local out = writelynx.redact_string("cpf 529.982.247-25")
        assert.is_not.equal(out, "cpf 529.982.247-25")
    end)

    it("redacts sensitive object keys", function()
        local out = writelynx.redact_object({ password = "x", name = "Bob" })
        assert.equals(out.password, "[REDACTED]")
        assert.equals(out.name, "Bob")
    end)
end)

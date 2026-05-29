local templates = require("writelynx.templates")
local validators = require("writelynx.validators")

local M = {}

--- @param pattern string
--- @param flags string|nil
--- @return table
local function compile_regex(pattern, flags)
    return {
        pattern = pattern,
        flags = flags or ""
    }
end

--- Compiles a ruleset for redaction/validation.
--- @param ruleset table
--- @param options table|nil
--- @return table
function M.compile(ruleset, options)
    options = options or {}
    local categories = options.categories
    local compiled_validators = {}

    for id, spec in pairs(ruleset.validators or {}) do
        compiled_validators[id] = validators.compile(spec)
    end

    local field_rules = {}

    for _, rule in ipairs(ruleset.field.rules or {}) do
        if rule.enabled ~= false then
            if not categories or (rule.category and categories[rule.category]) then
                table.insert(field_rules, {
                    id = rule.id,
                    regex = compile_regex(rule.pattern, rule.flags),
                    builtin = rule.builtin
                })
            end
        end
    end

    local pattern_rules = {}

    for _, rule in ipairs(ruleset.pattern.rules or {}) do
        if rule.enabled ~= false then
            if not categories or (rule.category and categories[rule.category]) then
                local entry = {
                    id = rule.id,
                    regex = compile_regex(rule.pattern, rule.flags),
                    uses = rule.uses or { "redaction" },
                    builtin = rule.builtin
                }

                if rule.validator and compiled_validators[rule.validator] then
                    local fn = compiled_validators[rule.validator]
                    entry.validator = function(value)
                        return fn(validators.extract_digits(value))
                    end
                end

                if rule.replacement then
                    entry.replacement = templates.compile(rule.replacement)
                end

                table.insert(pattern_rules, entry)
            end
        end
    end

    return {
        field_rules = field_rules,
        pattern_rules = pattern_rules,
        validators = compiled_validators
    }
end

return M

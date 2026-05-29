local builtin_rules = require("writelynx.builtin_rules")
local ruleset_merge = require("writelynx.ruleset_merge")
local compiler = require("writelynx.compiler")

local M = {}

local enabled = true
local custom_overlays = {}
local active_ruleset
local compiled

--- @return table
local function rebuild()
    local merged = {
        validators = {},
        field = { rules = {} },
        pattern = { rules = {} }
    }

    for k, v in pairs(builtin_rules.validators) do
        merged.validators[k] = v
    end

    for _, rule in ipairs(builtin_rules.field.rules) do
        table.insert(merged.field.rules, rule)
    end

    for _, rule in ipairs(builtin_rules.pattern.rules) do
        table.insert(merged.pattern.rules, rule)
    end

    for _, overlay in ipairs(custom_overlays) do
        merged = ruleset_merge.merge(merged, overlay)
    end

    active_ruleset = merged
    compiled = compiler.compile(active_ruleset)
    return merged
end

rebuild()

--- Loads JSON rules from file path (requires cjson in OpenResty).
--- @param path string
function M.load(path)
    local file = io.open(path, "r")

    if not file then
        error("Cannot open rules file: " .. path)
    end

    local content = file:read("*a")
    file:close()

    local cjson = require("cjson")
    local overlay = cjson.decode(content)
    table.insert(custom_overlays, overlay)
    rebuild()
end

--- Merges a Lua table ruleset overlay.
--- @param overlay table
function M.load_json(overlay)
    table.insert(custom_overlays, overlay)
    rebuild()
end

--- @param input string
--- @return string
function M.redact_string(input)
    if not enabled or input == "" then
        return input
    end

    local ngx_re = ngx and ngx.re
    local output = input

    for _, rule in ipairs(compiled.pattern_rules) do
        local uses_redaction = false

        for _, use in ipairs(rule.uses) do
            if use == "redaction" then
                uses_redaction = true
                break
            end
        end

        if uses_redaction then
            if ngx_re then
                local iter, err = ngx_re.gmatch(output, rule.regex.pattern, rule.regex.flags .. "jo")

                if not iter then
                    error(err)
                end

                local parts = {}
                local last_end = 1
                local m = iter()

                while m do
                    local match = m[0]
                    local replace = match

                    if not rule.validator or rule.validator(match) then
                        if rule.replacement then
                            replace = rule.replacement(match, m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9])
                        else
                            replace = "[REDACTED]"
                        end
                    end

                    local from = m._from or 1
                    table.insert(parts, output:sub(last_end, from - 1))
                    table.insert(parts, replace)
                    last_end = (m._to or from) + 1
                    m = iter()
                end

                table.insert(parts, output:sub(last_end))
                output = table.concat(parts)
            else
                local mock = require("ngx_re_mock")
                output = mock.gsub(output, rule)
            end
        end
    end

    return output
end

--- @param key string
--- @return boolean
local function is_sensitive_field(key)
    for _, rule in ipairs(compiled.field_rules) do
        local mock = require("ngx_re_mock")

        if mock.match(key, rule.regex) then
            return true
        end
    end

    return false
end

--- @param value any
--- @param depth number|nil
--- @return any
function M.redact_object(value, depth)
    depth = depth or 0

    if not enabled or depth > 10 then
        return "[REDACTED]"
    end

    local t = type(value)

    if t == "string" then
        return M.redact_string(value)
    end

    if t ~= "table" then
        return value
    end

    local result = {}

    for k, v in pairs(value) do
        if is_sensitive_field(tostring(k)) then
            result[k] = "[REDACTED]"
        else
            result[k] = M.redact_object(v, depth + 1)
        end
    end

    return result
end

--- @param rule_id string
--- @param value string
--- @return table
function M.validate(rule_id, value)
    for _, rule in ipairs(compiled.pattern_rules) do
        if rule.id == rule_id then
            if not rule.validator then
                return { valid = false, ruleId = rule_id, message = "Rule has no validator" }
            end

            return {
                valid = rule.validator(value),
                ruleId = rule_id
            }
        end
    end

    return { valid = false, ruleId = rule_id, message = "Unknown rule" }
end

--- @param rule_id string
--- @param value string
--- @return table
function M.test(rule_id, value)
    local mock = require("ngx_re_mock")

    for _, rule in ipairs(compiled.pattern_rules) do
        if rule.id == rule_id then
            local m = mock.match(value, rule.regex)

            if not m then
                return { matched = false, validatorPassed = false, ruleId = rule_id }
            end

            local matched = m[0]
            local passed = rule.validator and rule.validator(matched) or true

            return {
                matched = true,
                validatorPassed = passed,
                ruleId = rule_id,
                redactedPreview = passed and M.redact_string(matched) or nil
            }
        end
    end

    return { matched = false, validatorPassed = false, ruleId = rule_id }
end

--- @param rule_id string
--- @param text string
--- @return table
function M.extract(rule_id, text)
    local mock = require("ngx_re_mock")
    local matches = {}

    for _, rule in ipairs(compiled.pattern_rules) do
        if rule.id == rule_id then
            local from = 1

            while from <= #text do
                local slice = text:sub(from)
                local m = mock.match(slice, rule.regex)

                if not m then
                    break
                end

                local match = m[0]

                if not rule.validator or rule.validator(match) then
                    table.insert(matches, match)
                end

                from = from + (m._to or #match)
            end

            return { matches = matches, ruleId = rule_id }
        end
    end

    return { matches = {}, ruleId = rule_id }
end

function M.reload()
    rebuild()
end

--- @param flag boolean
function M.set_enabled(flag)
    enabled = flag
end

--- @return boolean
function M.is_enabled()
    return enabled
end

return M

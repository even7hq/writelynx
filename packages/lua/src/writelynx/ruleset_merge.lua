local M = {}

--- Merges rule arrays by id.
--- @param base_rules table[]
--- @param overlay_rules table[]
--- @return table[]
local function merge_rules_by_id(base_rules, overlay_rules)
    local by_id = {}

    for _, rule in ipairs(base_rules) do
        by_id[rule.id] = rule
    end

    for _, rule in ipairs(overlay_rules) do
        by_id[rule.id] = rule
    end

    local result = {}

    for _, rule in pairs(by_id) do
        table.insert(result, rule)
    end

    return result
end

--- Merges overlay ruleset onto base.
--- @param base table
--- @param overlay table
--- @return table
function M.merge(base, overlay)
    local validators = {}

    for k, v in pairs(base.validators or {}) do
        validators[k] = v
    end

    if overlay.validators then
        for k, v in pairs(overlay.validators) do
            validators[k] = v
        end
    end

    return {
        validators = validators,
        field = {
            rules = merge_rules_by_id(base.field.rules, overlay.field and overlay.field.rules or {})
        },
        pattern = {
            rules = merge_rules_by_id(base.pattern.rules, overlay.pattern and overlay.pattern.rules or {})
        }
    }
end

return M

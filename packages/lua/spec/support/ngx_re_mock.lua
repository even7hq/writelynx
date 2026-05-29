local M = {}

--- Builds Lua pattern from PCRE-ish pattern (subset for tests).
--- @param pattern string
--- @param flags string
--- @return string
local function to_lua_pattern(pattern, flags)
    local p = pattern
    p = p:gsub("%(%?<!\\d%)", "")
    p = p:gsub("%(%?!\\d%)", "")
    p = p:gsub("\\b", "")
    p = p:gsub("\\.", ".")
    p = p:gsub("\\/", "/")
    p = p:gsub("%[", "[")
    return p
end

--- @param text string
--- @param regex table
--- @return table|nil
function M.match(text, regex)
    local pat = to_lua_pattern(regex.pattern, regex.flags)
    local caps = { text:match(pat) }

    if caps[1] == nil and caps[0] == nil then
        local full = text:match(pat)

        if not full then
            return nil
        end

        return { [0] = full, _from = 1, _to = #full }
    end

    local full = caps[1] or text:match(pat)

    if not full then
        return nil
    end

    local m = { [0] = full, _from = 1, _to = #full }

    for i = 2, #caps do
        m[i - 1] = caps[i]
    end

    return m
end

--- @param text string
--- @param rule table
--- @return string
function M.gsub(text, rule)
    local pat = to_lua_pattern(rule.regex.pattern, rule.regex.flags)
    local result = {}
    local last = 1
    local pos = 1

    while pos <= #text do
        local slice = text:sub(pos)
        local from, to, cap1, cap2, cap3, cap4 = slice:find(pat)

        if not from then
            break
        end

        local match = slice:sub(from, to)
        local abs_from = pos + from - 1
        local abs_to = pos + to - 1
        table.insert(result, text:sub(last, abs_from - 1))

        local replace = match

        if not rule.validator or rule.validator(match) then
            if rule.replacement then
                replace = rule.replacement(match, cap1, cap2, cap3, cap4)
            else
                replace = "[REDACTED]"
            end
        end

        table.insert(result, replace)
        last = abs_to + 1
        pos = last
    end

    table.insert(result, text:sub(last))
    return table.concat(result)
end

return M

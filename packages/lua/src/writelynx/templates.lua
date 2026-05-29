local M = {}

--- Extracts digits from a string.
--- @param value string
--- @return string
local function extract_digits(value)
    return (value:gsub("%D", ""))
end

--- Slices a string with Python-style indices.
--- @param value string
--- @param start number
--- @param end_ number
--- @return string
local function slice_value(value, start, end_)
    local len = #value
    local s = start < 0 and math.max(0, len + start) or start
    local e = end_ < 0 and math.max(0, len + end_) or end_

    if s >= e then
        return ""
    end

    return value:sub(s + 1, e)
end

--- Compiles a replacement template.
--- @param template string
--- @return fun(match: string, ...: string): string
function M.compile(template)
    local parts = {}
    local pos = 1

    while pos <= #template do
        local s, e, token, slice_start, slice_end = template:find("$(%d+|d)%[?(-?%d*):?(-?%d*)%]?", pos)

        if not s then
            table.insert(parts, { literal = template:sub(pos) })
            break
        end

        if s > pos then
            table.insert(parts, { literal = template:sub(pos, s - 1) })
        end

        local part = {}

        if token == "d" then
            part.use_digits = true
        else
            part.group_index = tonumber(token)
        end

        if slice_start ~= "" and slice_end ~= "" then
            part.slice_start = tonumber(slice_start)
            part.slice_end = tonumber(slice_end)
        end

        table.insert(parts, part)
        pos = e + 1
    end

    return function(match, ...)
        local captures = { ... }
        local out = {}

        for _, part in ipairs(parts) do
            if part.literal then
                table.insert(out, part.literal)
            else
                local value

                if part.use_digits then
                    value = extract_digits(match)
                elseif part.group_index == 0 then
                    value = match
                else
                    value = captures[part.group_index] or ""
                end

                if part.slice_start and part.slice_end then
                    value = slice_value(value, part.slice_start, part.slice_end)
                end

                table.insert(out, value)
            end
        end

        return table.concat(out)
    end
end

return M

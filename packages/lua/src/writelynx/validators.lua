local M = {}

--- Returns true when all digits are the same.
--- @param digits string
--- @return boolean
local function all_same_digits(digits)
    if #digits == 0 then
        return false
    end

    local first = digits:sub(1, 1)

    for i = 2, #digits do
        if digits:sub(i, i) ~= first then
            return false
        end
    end

    return true
end

--- Validates mod11 spec.
--- @param digits string
--- @param spec table
--- @return boolean
local function validate_mod11(digits, spec)
    if #digits ~= spec.digitLength then
        return false
    end

    if spec.rejectAllSame and all_same_digits(digits) then
        return false
    end

    for _, check in ipairs(spec.checks) do
        local sum = 0

        for i, weight in ipairs(check.weights) do
            sum = sum + tonumber(digits:sub(i, i)) * weight
        end

        local remainder = sum % 11
        local expected = remainder < 2 and 0 or (11 - remainder)

        if tonumber(digits:sub(check.checkIndex + 1, check.checkIndex + 1)) ~= expected then
            return false
        end
    end

    return true
end

--- Validates luhn spec.
--- @param digits string
--- @param spec table
--- @return boolean
local function validate_luhn(digits, spec)
    if #digits ~= spec.digitLength then
        return false
    end

    local sum = 0
    local alternate = false

    for i = #digits, 1, -1 do
        local n = tonumber(digits:sub(i, i))

        if alternate then
            n = n * 2

            if n > 9 then
                n = n - 9
            end
        end

        sum = sum + n
        alternate = not alternate
    end

    return sum % 10 == 0
end

--- Compiles validator spec to predicate.
--- @param spec table
--- @return fun(digits: string): boolean
function M.compile(spec)
    if spec.type == "mod11" then
        return function(digits)
            return validate_mod11(digits, spec)
        end
    end

    return function(digits)
        return validate_luhn(digits, spec)
    end
end

--- Extracts digits from arbitrary value.
--- @param value string
--- @return string
function M.extract_digits(value)
    return (value:gsub("%D", ""))
end

return M

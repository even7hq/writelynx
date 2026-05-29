import type { ValidatorSpec } from "@writelynx/builtin-rules";

export namespace ValidatorCompiler {
    /**
     * Returns true when every digit in the string is the same.
     *
     * @param digits - Digit-only string
     * @returns Whether all digits are identical
     */
    function allSameDigits(digits: string): boolean {
        if (digits.length === 0) {
            return false;
        }

        const first = digits[0];

        for (let i = 1; i < digits.length; i++) {
            if (digits[i] !== first) {
                return false;
            }
        }

        return true;
    }

    /**
     * Runs mod11 check digit validation.
     *
     * @param digits - Digit-only input
     * @param spec - Mod11 validator specification
     * @returns Whether validation passed
     */
    function validateMod11(digits: string, spec: Extract<ValidatorSpec, { type: "mod11" }>): boolean {
        if (digits.length !== spec.digitLength) {
            return false;
        }

        if (spec.rejectAllSame && allSameDigits(digits)) {
            return false;
        }

        for (const check of spec.checks) {
            let sum = 0;

            for (let i = 0; i < check.weights.length; i++) {
                sum += Number(digits[i]) * check.weights[i];
            }

            const remainder = sum % 11;
            const expected = remainder < 2 ? 0 : 11 - remainder;

            if (Number(digits[check.checkIndex]) !== expected) {
                return false;
            }
        }

        return true;
    }

    /**
     * Runs Luhn algorithm validation.
     *
     * @param digits - Digit-only input
     * @param spec - Luhn validator specification
     * @returns Whether validation passed
     */
    function validateLuhn(digits: string, spec: Extract<ValidatorSpec, { type: "luhn" }>): boolean {
        if (digits.length !== spec.digitLength) {
            return false;
        }

        let sum = 0;
        let alternate = false;

        for (let i = digits.length - 1; i >= 0; i--) {
            let n = Number(digits[i]);

            if (alternate) {
                n *= 2;

                if (n > 9) {
                    n -= 9;
                }
            }

            sum += n;
            alternate = !alternate;
        }

        return sum % 10 === 0;
    }

    /**
     * Compiles a validator spec into a predicate over digit-only strings.
     *
     * @param spec - Validator specification from ruleset
     * @returns Predicate function
     */
    export function compile(spec: ValidatorSpec): (digits: string) => boolean {
        if (spec.type === "mod11") {
            return (digits: string) => validateMod11(digits, spec);
        }

        return (digits: string) => validateLuhn(digits, spec);
    }

    /**
     * Extracts digits from an arbitrary value string for validator input.
     *
     * @param value - Raw matched value
     * @returns Digit-only string
     */
    export function extractDigits(value: string): string {
        return value.replace(/\D/g, "");
    }
}

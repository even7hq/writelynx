export namespace TemplateEngine {
    interface TemplatePart {
        literal?: string;
        groupIndex?: number;
        useDigits?: boolean;
        sliceStart?: number;
        sliceEnd?: number;
    }

    const PLACEHOLDER_RE = /\$(\d+|d)(?:\[(-?\d*):(-?\d*)\])?/g;

    /**
     * Extracts only digit characters from a string.
     *
     * @param value - Input string
     * @returns Digits-only string
     */
    function extractDigits(value: string): string {
        return value.replace(/\D/g, "");
    }

    /**
     * Slices a string using Python-style start:end indices (end exclusive).
     *
     * @param value - Input string
     * @param start - Start index (negative counts from end)
     * @param end - End index (negative counts from end, exclusive)
     * @returns Sliced substring
     */
    function sliceValue(value: string, start: number, end: number): string {
        const len = value.length;
        const s = start < 0 ? Math.max(0, len + start) : start;
        const e = end < 0 ? Math.max(0, len + end) : end;

        if (s >= e) {
            return "";
        }

        return value.slice(s, e);
    }

    /**
     * Parses a replacement template into executable parts.
     *
     * @param template - Template string with $0, $1, $d, and optional slices
     * @returns Ordered template parts
     */
    function parseTemplate(template: string): TemplatePart[] {
        const parts: TemplatePart[] = [];
        let lastIndex = 0;

        for (const match of template.matchAll(PLACEHOLDER_RE)) {
            const index = match.index ?? 0;

            if (index > lastIndex) {
                parts.push({ literal: template.slice(lastIndex, index) });
            }

            const token = match[1];
            const sliceStartRaw = match[2];
            const sliceEndRaw = match[3];
            const sliceStart = sliceStartRaw !== undefined && sliceStartRaw !== ""
                ? Number(sliceStartRaw)
                : undefined;
            const sliceEnd = sliceEndRaw !== undefined && sliceEndRaw !== ""
                ? Number(sliceEndRaw)
                : undefined;

            if (token === "d") {
                parts.push({ useDigits: true, sliceStart, sliceEnd });
            } else {
                parts.push({
                    groupIndex: Number(token),
                    sliceStart,
                    sliceEnd
                });
            }

            lastIndex = index + match[0].length;
        }

        if (lastIndex < template.length) {
            parts.push({ literal: template.slice(lastIndex) });
        }

        return parts;
    }

    /**
     * Resolves a single template part against a match and capture groups.
     *
     * @param part - Parsed template part
     * @param fullMatch - Full regex match
     * @param captures - Regex capture groups (without full match)
     * @returns Resolved string fragment
     */
    function resolvePart(part: TemplatePart, fullMatch: string, captures: string[]): string {
        if (part.literal !== undefined) {
            return part.literal;
        }

        let value: string;

        if (part.useDigits) {
            value = extractDigits(fullMatch);
        } else if (part.groupIndex === 0) {
            value = fullMatch;
        } else {
            const idx = (part.groupIndex ?? 1) - 1;
            value = captures[idx] ?? "";
        }

        if (part.sliceStart !== undefined) {
            const end = part.sliceEnd !== undefined ? part.sliceEnd : value.length;
            return sliceValue(value, part.sliceStart, end);
        }

        return value;
    }

    /**
     * Compiles a replacement template into a replacer function.
     *
     * @param template - Template string
     * @returns Function that builds replacement from match and groups
     */
    export function compile(template: string): (match: string, ...groups: string[]) => string {
        const parts = parseTemplate(template);

        return (match: string, ...groups: string[]) => {
            return parts.map((part) => resolvePart(part, match, groups)).join("");
        };
    }
}

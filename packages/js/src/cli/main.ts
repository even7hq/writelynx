#!/usr/bin/env node
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { WriteLynxEngine } from "../WriteLynxEngine";

interface CliArgs {
    files: string[];
    rulesPaths: string[];
    onlyCategories: string[];
    validateRule?: string;
    validateValue?: string;
    dryRun: boolean;
    json: boolean;
    help: boolean;
}

/**
 * Parses command-line arguments into a structured options object.
 *
 * @param argv - process.argv slice from index 2
 * @returns Parsed CLI arguments
 */
function parseArgs(argv: string[]): CliArgs {
    const result: CliArgs = {
        files: [],
        rulesPaths: [],
        onlyCategories: [],
        dryRun: false,
        json: false,
        help: false
    };

    let i = 0;

    while (i < argv.length) {
        const arg = argv[i];

        if (arg === "--help" || arg === "-h") {
            result.help = true;
            i++;
            continue;
        }

        if (arg === "--rules" && argv[i + 1]) {
            result.rulesPaths.push(argv[i + 1]);
            i += 2;
            continue;
        }

        if (arg === "--only" && argv[i + 1]) {
            result.onlyCategories.push(
                ...argv[i + 1].split(",").map((c) => c.trim()).filter(Boolean)
            );
            i += 2;
            continue;
        }

        if (arg === "--validate" && argv[i + 1] && argv[i + 2]) {
            result.validateRule = argv[i + 1];
            result.validateValue = argv[i + 2];
            i += 3;
            continue;
        }

        if (arg === "--dry-run") {
            result.dryRun = true;
            i++;
            continue;
        }

        if (arg === "--json") {
            result.json = true;
            i++;
            continue;
        }

        result.files.push(arg);
        i++;
    }

    const envRules = process.env.WRITELYNX_RULES;

    if (envRules) {
        result.rulesPaths.push(envRules);
    }

    return result;
}

/**
 * Prints CLI usage help to stderr.
 *
 * @returns Nothing.
 */
function printHelp(): void {
    const help = `writelynx - sensitive data redaction and validation

Usage:
  cat file.log | writelynx
  writelynx [options] file.log

Options:
  --rules <path>       Custom rules JSON (repeatable)
  --only <cats>        Comma-separated categories (pii, auth, payment, ...)
  --validate <id> <v>  Validate value against rule id
  --dry-run            Report lines that would change without writing output
  --json               Parse each line as JSON, redact, emit JSON lines
  -h, --help           Show this help

Environment:
  WRITELYNX_RULES      Additional rules file path
`;

    process.stderr.write(help);
}

/**
 * Processes stdin line-by-line through the engine.
 *
 * @param engine - WriteLynx engine instance
 * @param args - CLI options
 * @returns Promise resolved when stdin ends
 */
async function processStdin(engine: WriteLynxEngine, args: CliArgs): Promise<void> {
    const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

    for await (const line of rl) {
        processLine(engine, line, args);
    }
}

/**
 * Redacts a single line and writes to stdout (or dry-run report).
 *
 * @param engine - WriteLynx engine
 * @param line - Input line
 * @param args - CLI options
 * @returns Nothing.
 */
function processLine(engine: WriteLynxEngine, line: string, args: CliArgs): void {
    if (args.dryRun) {
        if (engine.containsSensitiveData(line)) {
            process.stderr.write(`[would redact] ${line.slice(0, 80)}\n`);
        }

        return;
    }

    if (args.json) {
        try {
            const parsed = JSON.parse(line) as unknown;
            const redacted = engine.redact(parsed);
            process.stdout.write(`${JSON.stringify(redacted)}\n`);
        } catch {
            process.stdout.write(`${engine.redactString(line)}\n`);
        }

        return;
    }

    process.stdout.write(`${engine.redactString(line)}\n`);
}

/**
 * CLI entry point.
 *
 * @returns Nothing.
 */
async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    if (args.validateRule && args.validateValue !== undefined) {
        const engine = WriteLynxEngine.create({ rulesPaths: args.rulesPaths });
        const result = engine.validate(args.validateRule, args.validateValue);
        process.stdout.write(`${JSON.stringify(result)}\n`);
        process.exit(result.valid ? 0 : 1);
    }

    const engine = WriteLynxEngine.create({ rulesPaths: args.rulesPaths });

    if (args.onlyCategories.length > 0) {
        engine.setCategoryFilter(args.onlyCategories);
    }

    if (args.files.length === 0) {
        await processStdin(engine, args);
        return;
    }

    for (const file of args.files) {
        const content = readFileSync(file, "utf8");
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            processLine(engine, line, args);
        }
    }
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`writelynx: ${message}\n`);
    process.exit(1);
});

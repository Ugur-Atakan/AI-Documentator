# AI-Documentator

```
 /$$$$$$   /$$$$$$   /$$$$$$  /$$   /$$  /$$      /$$  /$$$$$$$$  /$$   /$$  /$$$$$$$$  /$$$$$$  /$$$$$$$$  /$$$$$$   /$$$$$$
| $$__  $$ /$$__  $$ /$$__  $$| $$  | $$ | $$$$  /$$$$| $$_____/ | $$$ | $$ |__  $$__//$$__  $$|__  $$__//$$__  $$ | $$__  $$
| $$  \ $$| $$  \ $$| $$  \__/| $$  | $$ | $$ $$/$$ $$| $$       | $$$$| $$    | $$  | $$  \ $$   | $$  | $$  \ $$ | $$  \ $$
| $$  | $$| $$  | $$| $$      | $$  | $$ | $$  $$$| $$| $$$$$    | $$ $$ $$    | $$  | $$$$$$$$   | $$  | $$  | $$ | $$$$$$/
| $$  | $$| $$  | $$| $$      | $$  | $$ | $$\  $ | $$| $$__/    | $$  $$$$    | $$  | $$__  $$   | $$  | $$  | $$ | $$__  $$
| $$  | $$| $$  | $$| $$    $$| $$  | $$ | $$ \/  | $$| $$       | $$\  $$$    | $$  | $$  | $$   | $$  | $$  | $$ | $$  \ $$
| $$$$$$/|  $$$$$$/|  $$$$$$/|  $$$$$$/ | $$     | $$| $$$$$$$$ | $$ \  $$    | $$  | $$  | $$   | $$  |  $$$$$$/ | $$  | $$
|_______/  \______/  \______/  \______/ |__/     |__/|________/ |__/  \__/    |__/  |__/  |__/   |__/   \______/  |__/  |__/
```

> AI-powered CLI tool that generates **DTOs** and **Swagger decorators** for NestJS projects using Gemini 2.5 Flash.

Built for large-scale NestJS projects with CASL authorization, multi-tenant architecture, and hundreds of endpoints. Tested on a 498-endpoint production codebase.

---

## What it does

Point it at a NestJS project and it will:

1. **Parse** every controller endpoint via TypeScript AST (ts-morph)
2. **Trace** service method calls to understand actual business logic
3. **Detect** auth context (`@Public`, `@UseGuards`, `@RequirePermission`, `@CurrentUser`, `@Context`, `@Roles`)
4. **Detect** existing Swagger decorators to avoid duplication
5. **Generate** typed DTOs with `class-validator` + `class-transformer` + `@nestjs/swagger`
6. **Generate** `@ApiOperation`, `@ApiBody`, `@ApiResponse` Swagger decorators
7. **Write** output files organized by module — **without touching your existing code**

---

## Installation

```bash
git clone https://github.com/Ugur-Atakan/AI-Documentator.git
cd AI-Documentator
npm install
npm link
```

Create a `.env` file:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

After `npm link`, the `documentator` command is available globally:

```bash
documentator
```

---

## Usage

### Interactive Mode (recommended)

Just run `documentator` with no arguments:

```bash
documentator
```

You'll get an interactive menu:

```
? What would you like to do?
  > Generate documentation
    Retry failed endpoints
    Parse project (inspect only)
    Create config file
    Help
```

The generate flow walks you through:
- Project path selection
- Module filtering (checkbox)
- Output directory (with smart suggestions based on your project structure)
- Mode (write / dry-run)
- Concurrency & model selection
- Confirmation before starting

### CLI Mode

For automation and CI pipelines:

```bash
# Generate all endpoints
documentator generate -p /path/to/nestjs-project -o ./output

# Generate specific modules only
documentator generate -p /path/to/project -m auth -m mailbox -o ./output

# Dry run (preview without writing files)
documentator generate -p /path/to/project --dry-run

# Retry only failed endpoints from last run
documentator retry -p /path/to/project -o ./output

# Parse and inspect endpoints (no generation)
documentator parse -p /path/to/project

# Create a .documentator.json config file
documentator init
```

#### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --project <path>` | Path to NestJS project root | — |
| `-o, --output-dir <path>` | Output directory for generated files | next to controllers |
| `-m, --module <name...>` | Filter by module name (repeatable) | all |
| `-c, --concurrency <n>` | Max parallel Gemini requests | `5` |
| `--model <name>` | Gemini model name | `gemini-2.5-flash` |
| `--dry-run` | Preview output without writing files | `false` |
| `--no-skip` | Re-generate even if files exist | `false` |
| `--retry` | Re-run only previously failed endpoints | `false` |

---

## Output Structure

When using `--output-dir`, files are organized by module:

```
output/
├── auth/
│   ├── dto/
│   │   ├── sign-in.request.dto.ts
│   │   └── sign-in.response.dto.ts
│   └── sign-in.decorators.ts
├── mailbox/
│   ├── dto/
│   │   ├── create-mailbox.request.dto.ts
│   │   ├── create-mailbox.response.dto.ts
│   │   ├── get-mailbox.response.dto.ts
│   │   └── list-mailboxes.response.dto.ts
│   ├── create-mailbox.decorators.ts
│   ├── get-mailbox.decorators.ts
│   └── list-mailboxes.decorators.ts
├── user/
│   ├── dto/
│   │   └── update-profile.request.dto.ts
│   └── update-profile.decorators.ts
└── ...
```

Module names are derived from the controller file path:
- `src/modules/mailbox/mailbox.controller.ts` → `mailbox/`
- `src/auth/auth.controller.ts` → `auth/`

When `--output-dir` is not set, files are written next to the controller:

```
src/modules/mailbox/
├── mailbox.controller.ts          ← untouched
├── dto/
│   ├── create-mailbox.request.dto.ts
│   └── create-mailbox.response.dto.ts
└── create-mailbox.decorators.ts
```

---

## Live Progress UI

During generation, you get a real-time terminal UI:

```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━  128/498  25.7%

  ✓ POST   /auth/sign-in
  ✓ GET    /mailbox/:id
  ✓ DELETE /mailbox/:id/items/:itemId

  ◐ dto    POST   /user/update-profile
  ◐ swagger GET    /admin/dashboard
  ◐ writing DELETE /location/:id

  + 367 more pending...

  ● 128 completed   ✖ 2 failed   ◌ 0 skipped
```

- Fixed-height display (no scrolling/duplication)
- Spinner animation for active tasks
- Phase indicators: `dto` → `swagger` → `writing`
- Auth badges: `PUB` / `JWT` / `CTX` / `CASL`

---

## Auth-Aware Generation

The parser detects NestJS auth decorators and adjusts generation accordingly:

| Decorator | Effect |
|-----------|--------|
| `@Public()` | No `@ApiBearerAuth`, no auth params in DTOs |
| `@UseGuards(JwtAuthGuard)` | Adds `@ApiBearerAuth`, 401 response |
| `@CurrentUser()` | Excludes `userId` from request DTO body |
| `@Context()` | Excludes `workspaceId`/`mailboxId` from body |
| `@RequirePermission()` | Adds 403 response, CASL info in description |
| `@Roles()` | Adds role-based access info |

---

## Retry Mechanism

Failed endpoints are saved to `.documentator_failed.json`. On the next run, use `--retry` or select "Retry failed endpoints" from the interactive menu to re-process only the failed ones.

---

## Config File

Create a `.documentator.json` in your project root to set defaults:

```json
{
  "project": "/path/to/nestjs-project",
  "outputDir": "./output",
  "model": "gemini-2.5-flash",
  "concurrency": 5,
  "modules": ["auth", "mailbox"],
  "skipExisting": true
}
```

CLI flags override config file values. Generate one interactively with `documentator init`.

---

## Stack

| Layer | Tool |
|-------|------|
| AST parsing | [ts-morph](https://ts-morph.com/) |
| LLM | Gemini 2.5 Flash via `@langchain/google` |
| Parallelism | `p-limit` + `Promise.allSettled` |
| Schema validation | Zod |
| CLI framework | Commander.js + @inquirer/prompts |
| Terminal UI | `log-update` + `chalk` |
| Runtime | `tsx` (no build step needed) |

---

## Architecture

```
cli.ts                          ← entry point (interactive or CLI mode)
src/
├── cli/
│   ├── commands/
│   │   ├── generate.ts         ← generate subcommand
│   │   ├── parse.ts            ← parse subcommand
│   │   └── init.ts             ← init subcommand
│   ├── interactive.ts          ← interactive menu flow
│   ├── renderer.ts             ← live terminal UI (log-update)
│   ├── ui.ts                   ← banner, config table, summary
│   ├── suggest-output.ts       ← smart output dir suggestions
│   └── config-loader.ts        ← .documentator.json loader
├── parser/
│   └── nestjs-parser.ts        ← AST parsing, auth detection, Swagger detection
├── prompts/
│   ├── dto-prompt.ts           ← DTO generation prompt (auth-aware)
│   └── swagger-prompt.ts       ← Swagger decorator prompt
├── nodes/
│   ├── dto-generator.ts        ← Gemini call for DTOs
│   ├── swagger-generator.ts    ← Gemini call for Swagger
│   └── file-writer.ts          ← module-based file output
├── executor/
│   ├── parallel-executor.ts    ← p-limit parallel orchestration
│   └── retry-store.ts          ← failed endpoint persistence
├── utils/
│   ├── response-parser.ts      ← 4-layer LLM response parser
│   ├── prisma-filter.ts        ← Prisma schema extraction
│   └── retry.ts                ← retry with backoff
├── schemas/
│   └── endpoint-schema.ts      ← Zod schemas
└── types/
    └── endpoint.ts             ← core type definitions
```

---

## Limitations

- Only handles standard NestJS controller patterns (`@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`)
- Generated code is a starting point — review before committing
- Gemini rate limits may affect large projects (tune `--concurrency`)
- Tested primarily on NestJS + Prisma + CASL projects

---

## License

MIT

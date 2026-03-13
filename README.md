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

> AI-powered CLI tool that generates **DTOs** and **Swagger decorators** for NestJS projects using a **multi-agent pipeline** powered by Gemini.

Built for large-scale NestJS projects with CASL authorization, multi-tenant architecture, and hundreds of endpoints. Tested on a 498-endpoint production codebase.

---

## What it does

Point it at a NestJS project and it will:

1. **Parse** every controller endpoint via TypeScript AST (ts-morph)
2. **Trace** service method calls to understand actual business logic
3. **Detect** auth context (`@Public`, `@UseGuards`, `@RequirePermission`, `@CurrentUser`, `@Context`, `@Roles`)
4. **Detect** existing Swagger decorators to avoid duplication
5. **Plan** DTO schemas and decorator metadata using a structured JSON plan (Planner agent)
6. **Generate** typed DTOs with `class-validator` + `class-transformer` + `@nestjs/swagger` (Writer agent)
7. **Review** generated code with rule-based validation — no LLM, pure static analysis (Reviewer agent)
8. **Write** consolidated output files per controller — **without touching your existing code**
9. **Apply** generated decorators to your controllers with conflicting decorator cleanup

---

## Multi-Agent Architecture

AI-Documentator uses a **4-agent pipeline** where each agent has a specialized role and optimal model:

```
                    ┌──────────────────────┐
                    │   Project Analyzer   │  Gemini Flash — runs once, result shared
                    │   (project context)  │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼        parallel (p-limit)
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │   Planner   │ │   Planner   │ │   Planner   │
        │ (Gemini Pro)│ │ (Gemini Pro)│ │ (Gemini Pro)│
        │             │ │             │ │             │
        │ JSON schema │ │ JSON schema │ │ JSON schema │
        └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
               ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │   Writer    │ │   Writer    │ │   Writer    │
        │(Gemini Flash│ │(Gemini Flash│ │(Gemini Flash│
        │             │ │             │ │             │
        │  TS code    │ │  TS code    │ │  TS code    │
        └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
               ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │  Reviewer   │ │  Reviewer   │ │  Reviewer   │
        │ (rule-based)│ │ (rule-based)│ │ (rule-based)│
        │  no LLM     │ │  no LLM     │ │  no LLM     │
        └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
               ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │ File Writer │ │ File Writer │ │ File Writer │
        └─────────────┘ └─────────────┘ └─────────────┘
```

### Agent Roles

| Agent | Model | Role |
|-------|-------|------|
| **Project Analyzer** | Gemini Flash | Analyzes project structure, conventions, patterns. Runs once, result cached and shared across all controllers. |
| **Planner** | Gemini Pro | Takes all endpoints for a controller, outputs a structured JSON schema describing DTO fields, validators, enums, decorator metadata. Best reasoning model for schema inference. |
| **Writer** | Gemini Flash | Takes the Planner's JSON schema and generates TypeScript code. Fast and cheap — code generation from a clear schema doesn't need deep reasoning. |
| **Reviewer** | Rule-based (no LLM) | Validates generated code: syntax, `@ApiProperty` on every field, import completeness, balanced braces, `applyDecorators` correctness. Fails → Writer retries once. |

### Why Multi-Agent?

- **Separation of concerns**: Planning (what to generate) is decoupled from writing (how to generate). This produces significantly better output than a single prompt.
- **Cost optimization**: The Planner uses a Pro model for complex reasoning, while the Writer uses Flash for straightforward code generation. ~60% of the work uses the cheaper model.
- **Per-controller grouping**: Instead of processing each endpoint separately (500 API calls for 500 endpoints), endpoints are grouped by controller. A 500-endpoint project with 50 controllers makes ~100 API calls (50 Planner + 50 Writer).
- **Deterministic review**: The Reviewer uses static analysis, not LLM — so validation is fast, free, and consistent.

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
    Apply decorators to controllers
    Parse project (inspect only)
    Create config file
    Help
```

The generate flow walks you through:
- Project path selection
- Module filtering (checkbox)
- Output directory (with smart suggestions based on your project structure)
- **Pipeline mode** (multi-agent or legacy)
- Mode (write / dry-run)
- Concurrency
- **Planner & Writer model selection** (multi-agent mode)
- Confirmation before starting

### CLI Mode

For automation and CI pipelines:

```bash
# Generate with multi-agent pipeline (default)
documentator generate -p /path/to/nestjs-project -o ./output

# Generate specific modules only
documentator generate -p /path/to/project -m auth -m mailbox -o ./output

# Use legacy per-endpoint pipeline
documentator generate -p /path/to/project -o ./output --legacy

# Custom models for planner and writer
documentator generate -p /path/to/project --planner-model gemini-2.5-pro --writer-model gemini-2.5-flash

# Dry run (preview without writing files)
documentator generate -p /path/to/project --dry-run

# Retry only failed endpoints from last run
documentator retry -p /path/to/project -o ./output

# Apply generated decorators to controllers
documentator apply -p /path/to/project --write

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
| `-c, --concurrency <n>` | Max parallel requests | `5` |
| `--model <name>` | Gemini model (legacy mode) | `gemini-2.5-flash` |
| `--planner-model <name>` | Planner model (multi-agent mode) | `gemini-2.5-pro` |
| `--writer-model <name>` | Writer model (multi-agent mode) | `gemini-2.5-flash` |
| `--dry-run` | Preview output without writing files | `false` |
| `--no-skip` | Re-generate even if files exist | `false` |
| `--retry` | Re-run only previously failed endpoints | `false` |
| `--legacy` | Use legacy per-endpoint pipeline | `false` |

---

## Output Structure

### Multi-Agent Pipeline (default — per-controller)

Files are consolidated per controller — one file per type:

```
output/
├── auth/
│   ├── dto/
│   │   ├── auth.request.dto.ts        ← all request DTOs for AuthController
│   │   ├── auth.response.dto.ts       ← all response DTOs
│   │   └── auth.enums.ts              ← shared enums (if any)
│   └── decorators/
│       └── auth.decorators.ts         ← all decorator exports
├── mailbox/
│   ├── dto/
│   │   ├── mailbox.request.dto.ts
│   │   ├── mailbox.response.dto.ts
│   │   └── mailbox.enums.ts
│   └── decorators/
│       └── mailbox.decorators.ts
└── user/
    ├── dto/
    │   ├── user.request.dto.ts
    │   └── user.response.dto.ts
    └── decorators/
        └── user.decorators.ts
```

### Legacy Pipeline (per-endpoint)

With `--legacy` flag, each endpoint gets its own files:

```
output/
├── mailbox/
│   ├── dto/
│   │   ├── create-mailbox.request.dto.ts
│   │   ├── create-mailbox.response.dto.ts
│   │   ├── get-mailbox.response.dto.ts
│   │   └── list-mailboxes.response.dto.ts
│   └── decorators/
│       ├── create-mailbox.decorators.ts
│       ├── get-mailbox.decorators.ts
│       └── list-mailboxes.decorators.ts
└── ...
```

---

## Apply Command

The `apply` command injects generated decorators and DTO types into your controllers using ts-morph AST manipulation:

```bash
# Preview changes (dry-run)
documentator apply -p /path/to/project

# Apply changes
documentator apply -p /path/to/project --write
```

What it does:
1. Scans controllers for matching generated files (supports both consolidated and legacy formats)
2. **Removes conflicting Swagger decorators** (`@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`, `@ApiBody`, `@ApiBearerAuth`)
3. Adds the consolidated `applyDecorators` import and decorator call
4. Types `@Body()` parameters with the generated request DTO
5. Cleans up unused `@nestjs/swagger` imports

---

## Live Progress UI

During generation, you get a real-time terminal UI:

### Multi-Agent Mode (controller-based)

```
  [====================----------] 67% (45s)

  ok MailboxController              done        (12 endpoints)
  ...UserController                 generating  (8 endpoints)
  ...AuthController                 planning    (5 endpoints)
     AdminController

  + 8 more

  8/12 controllers  ·  96 endpoints  ·  1 failed  ·  45s elapsed
```

Phases: `planning` → `generating` → `reviewing` → `writing` → `done`

### Legacy Mode (endpoint-based)

```
  [========----------------------] 25% (12s)

  ok GET    /auth/sign-in                        done
  ...POST   /user/update-profile                 dto
  ...GET    /admin/dashboard                     swagger

  + 367 more

  128/498 done  3 active
```

---

## Safety Guards

Every file write is checked against safety rules:

- **No database modifications**: Rejects generated code containing `prisma.*.create()`, `prisma.*.delete()`, etc.
- **No git operations**: Rejects code containing `git push`, `git commit`, etc.
- **Protected directories**: Blocks writes to `node_modules/`, `.git/`, `.env`, `dist/`

If any safety check fails, the file is not written and an error is reported.

---

## Retry & Circuit Breaker

- **Retry**: Failed endpoints saved to `.documentator_failed.json`. Use `--retry` or the interactive menu to re-process only failures.
- **Exponential backoff**: Rate-limited requests are retried with increasing delays (up to 60s).
- **Circuit breaker**: After 3 consecutive failures, all tasks pause for 30 seconds to let the API recover.

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

## Config File

Create a `.documentator.json` in your project root to set defaults:

```json
{
  "project": "/path/to/nestjs-project",
  "outputDir": "./output",
  "concurrency": 5,
  "modules": ["auth", "mailbox"],
  "skipExisting": true,
  "legacy": false,
  "models": {
    "analyzer": "gemini-2.5-flash",
    "planner": "gemini-2.5-pro",
    "writer": "gemini-2.5-flash"
  }
}
```

CLI flags override config file values. Generate one interactively with `documentator init`.

---

## Stack

| Layer | Tool |
|-------|------|
| AST parsing | [ts-morph](https://ts-morph.com/) |
| LLM | Gemini 2.5 Pro + Flash via `@langchain/google` |
| Multi-agent orchestration | LangGraph (`@langchain/langgraph`) |
| Parallelism | `p-limit` + `Promise.allSettled` |
| Schema validation | Zod |
| CLI framework | Commander.js + @inquirer/prompts |
| Terminal UI | `log-update` + `chalk` |
| Runtime | `tsx` (no build step needed) |

---

## Architecture

```
cli.ts                              ← entry point (interactive or CLI mode)
src/
├── cli/
│   ├── commands/
│   │   ├── generate.ts             ← generate subcommand (legacy + multi-agent)
│   │   ├── apply.ts                ← apply subcommand
│   │   ├── parse.ts                ← parse subcommand
│   │   └── init.ts                 ← init subcommand
│   ├── interactive.ts              ← interactive menu (pipeline + model selection)
│   ├── renderer.ts                 ← live terminal UI (endpoint + controller modes)
│   ├── ui.ts                       ← banner, config table, summary
│   ├── suggest-output.ts           ← smart output dir suggestions
│   └── config-loader.ts            ← .documentator.json + multi-model config
├── parser/
│   └── nestjs-parser.ts            ← AST parsing, auth/swagger detection, service tracing
├── graph/
│   ├── documentation-graph.ts      ← LangGraph pipeline (planner → writer → reviewer)
│   ├── state.ts                    ← pipeline state definition
│   ├── model-factory.ts            ← per-role model creation
│   └── agents/
│       ├── project-analyzer.ts     ← Agent 1: project structure analysis
│       ├── planner-agent.ts        ← Agent 2: structured JSON plan (Pro model)
│       ├── code-writer-agent.ts    ← Agent 3: TypeScript code generation (Flash model)
│       └── reviewer-agent.ts       ← Agent 4: rule-based validation (no LLM)
├── prompts/
│   ├── planner-prompt.ts           ← Planner agent prompt builder
│   ├── writer-prompt.ts            ← Writer agent prompt builder
│   ├── dto-prompt.ts               ← Legacy DTO prompt (--legacy mode)
│   └── swagger-prompt.ts           ← Legacy Swagger prompt (--legacy mode)
├── nodes/
│   ├── dto-generator.ts            ← Gemini call for DTOs (legacy)
│   ├── swagger-generator.ts        ← Gemini call for Swagger (legacy)
│   ├── file-writer.ts              ← per-endpoint + per-controller file output
│   └── task-loader.ts              ← parsed JSON → task queue
├── executor/
│   ├── parallel-executor.ts        ← endpoint + controller parallel orchestration
│   └── retry-store.ts              ← failed endpoint persistence
├── applier/
│   └── controller-applier.ts       ← decorator injection + conflict cleanup
├── utils/
│   ├── response-parser.ts          ← multi-strategy LLM response extraction
│   ├── prisma-filter.ts            ← Prisma schema extraction
│   ├── retry.ts                    ← retry with backoff + circuit breaker
│   ├── group-by-controller.ts      ← endpoint → controller grouping
│   └── safety-guard.ts             ← safety checks before file writes
├── schemas/
│   └── endpoint-schema.ts          ← Zod validation schemas
└── types/
    ├── endpoint.ts                 ← core endpoint types
    └── controller-group.ts         ← controller group + pipeline types
```

---

## Limitations

- Only handles **NestJS** controller patterns (`@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`)
- Generated code is a starting point — review before committing
- Gemini rate limits may affect large projects (tune `--concurrency`, circuit breaker helps)
- Tested primarily on NestJS + Prisma + CASL projects
- Multi-agent pipeline produces better output but costs ~2-4x more than legacy mode

---

## License

MIT

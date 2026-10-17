# Contributing to NexoBot

Thank you for your interest in contributing to NexoBot! This guide covers local setup, project conventions, and what we look for in pull requests.

## Ways to Contribute

- Bug fixes and reliability improvements
- New commands or enhancements to existing features
- Documentation updates

Before starting large features, open an issue on [GitHub](https://github.com/Robertwlt03/NexoBot/issues) so we can align on scope and avoid duplicate work.

## Getting Started

### Prerequisites

- **Node.js 20+** (Docker and CI use Node 20)
- **PostgreSQL** (recommended for development; the bot can fall back to in-memory storage if PostgreSQL is unavailable)
- A **Discord bot application** with the intents listed in [README.md](README.md#required-bot-intents)

### Local Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment file and configure it:
   ```bash
   cp .env.example .env
   ```
   At minimum, set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` for single-server development. See [README.md](README.md#umgebungsvariablen) for full configuration options.
4. Build and verify your database setup (when using PostgreSQL):
   ```bash
   npm run build
   npm run migrate:check
   ```
5. Start the bot in watch mode (runs the TypeScript sources via tsx):
   ```bash
   npm run dev
   ```
   Production-style start: `npm run build && npm start`.

Before opening a pull request, run `npm run typecheck`, `npm test` and `npm run build`.

For Docker-based setup, see [README.md](README.md#docker).

## Development Workflow

1. **Fork the repository** and create a branch from `main`.
2. **Make focused changes** — one logical change per pull request when possible.
3. **Open a pull request** with a clear description of what changed and why.

Use descriptive branch names, for example:

- `fix/ticket-panel-refresh`
- `feat/economy-shop-filter`
- `docs/contributing-guide`

## Database & Migrations

NexoBot uses PostgreSQL as its primary store. If PostgreSQL is unreachable at startup, the bot can operate in a **degraded in-memory mode** — but that mode is not suitable for production and should not be the only way you test persistence-related changes.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run migrate` | Apply migrations |
| `npm run migrate:check` | Verify schema version matches expectations |
| `npm run migrate:status` | Show current migration status |

If your change modifies the database schema, update the expected schema version in `.env.example` (`SCHEMA_VERSION`, `SCHEMA_VERSION_LABEL`) and ensure `npm run migrate:check` passes locally.

Test features that read or write guild data with **both** PostgreSQL and the memory fallback when feasible.

## Code Guidelines

- **Match existing style** — strict TypeScript (no `any`), ES modules with `.js` import specifiers, async/await, and the conventions used in neighboring files.
- **Commands** — top-level commands live in `src/commands/<Category>/`, subcommand implementations in `modules/`. Consolidated commands are built with `createRouterCommand`; moved command names go into `src/config/commands/legacyCommandMap.ts`.
- **Language** — user-facing texts are German (informal "du"); code, comments and logs are English.
- **Handle errors gracefully** — catch failures, log with context, and send user-friendly embed replies where appropriate.
- **Avoid breaking guild isolation** — guild-specific config and data must stay scoped per server (`guild:{guildId}:...` keys, `interaction.guildId`).
- **Keep changes minimal** — prefer extending existing utilities and services over duplicating logic.
- **Document user-facing behavior** — update README.md when setup steps or configuration change; mention new env vars in `.env.example`.

There is no ESLint config in this repo today; consistency with surrounding code is the main bar.

## Pull Request Checklist

In your PR description, include:

- **What** changed
- **Why** the change is needed
- **How to test** it manually (commands, config, or env vars to set)

## Reporting Issues

When reporting a bug, include:

- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs (`LOG_LEVEL=debug` can help locally)
- Whether you use PostgreSQL or memory fallback
- Bot version / commit hash if known

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers this project.

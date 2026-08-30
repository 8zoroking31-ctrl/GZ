# Changelog

Notable changes to this fork (TitanBot-REAPR_01-), deployed self-hosted for a small
Discord gaming community.

## 2026-08 — Deployment sync + `/postembed`

These changes were first applied on the running deployment and are captured here to
bring the repository in sync with the deployed reality.

### Added
- **`/postembed`** (`src/commands/Tools/postembed.js`) — post a Discord embed from
  raw JSON. Accepts **either** a pasted `json` string option **or** a `.txt`/`.json`
  file attachment (mutually exclusive; errors if neither or both are given). Handles
  both a bare embed object `{...}` and a Discohook/webhook payload
  `{"content": ..., "embeds": [...]}` (up to 10 embeds).
  - Gated by **Manage Messages** at the Discord layer *and* re-checked in code
    (server admins can override the default-member-permission, so the in-code check
    is the real backstop).
  - Mentions neutralized (`allowedMentions: { parse: [] }`) so a pasted payload can't
    become an `@everyone`/role ping.
  - Attachment path defers the reply (network I/O would blow the 3s interaction
    deadline), validates extension + size (≤100 KB), and fetches via Node 20's
    built-in `fetch`. All errors reply ephemerally.

### Removed
- **Music commands** (`src/commands/Music/`: `join`, `music`, `nowplaying`, `play`,
  `queue`) — unused by this community, removed to free slots against Discord's
  100 global-command limit. Verified no static imports referenced these files
  (`src/interactions/` loads command components via dynamic globbing with per-file
  try/catch), so removal is boot-safe; any orphaned music component handlers simply
  go dormant because nothing spawns them.

### Nuances / lessons encountered
- **ESM module contract.** This repo is ES Modules (`import` / `export default` with
  `data` + `execute`), **not** CommonJS. Generic `require()/module.exports` embed
  snippets from tutorials will silently fail to load. `category` is auto-derived from
  the folder name, so dropping a file in `src/commands/Tools/` tags it "Tools".
- **Ephemeral replies use `flags: MessageFlags.Ephemeral`**, not the deprecated
  `ephemeral: true`.
- **Global vs guild command registration.** The loader registers commands
  **globally** (`PUT /applications/{clientId}/commands`) and truncates if the total
  exceeds 100 — so freeing slots (Music removal) matters. Global commands can take
  **up to ~1 hour** to propagate on first registration; a client restart (Ctrl+R)
  usually surfaces a new command sooner. For an instant appearance during testing you
  can PUT to the guild-scoped endpoint
  (`/applications/{clientId}/guilds/{guildId}/commands`), which overrides the global
  command of the same name (no duplicate); clear it later by PUTting `[]`.
- **Slash-string length.** The `json` string option is capped at 6000 characters by
  Discord — the `.txt`/`.json` attachment path exists for larger multi-embed
  payloads.

## Deployment notes

- Runs as one Docker Compose stack (bot + PostgreSQL) in an unprivileged Proxmox LXC
  on an isolated VLAN (full outbound WAN to Discord, zero inbound, no LAN infra
  reach). Health port bound to loopback only.
- Build **from this repository**, not the upstream GHCR image referenced in the
  README (that is a different project's code).
- On a ZFS Proxmox host, Docker needs the `fuse-overlayfs` storage driver and the LXC
  `fuse=1` feature (plus `nesting=1,keyctl=1`).
- The `docker-compose.override.yml` must use `ports: !override` — Compose merges
  `ports:` lists additively, so without the tag the base `0.0.0.0:3000` mapping and
  the loopback `127.0.0.1:3000` mapping collide ("address already in use").
- Use a URL-safe Postgres password (`openssl rand -hex 24`) — a base64 password can
  contain `/`, `+`, `@`, `:` that corrupt the `postgres://...` connection string and
  silently drop the bot into in-memory degraded mode.

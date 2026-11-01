## Shippable agent skills for FunctionalScript

**Priority:** P2
**Status:** open

### Problem

An AI coding agent asked to write FunctionalScript has nothing to load that
tells it what FunctionalScript is. It sees `.f.js` / `.f.mjs` files, assumes
ordinary JavaScript, and writes code the compiler refuses: mutation, classes,
`let`, loops, imports outside the subset. It does not know that `fjs test`
runs the proofs, or that `fjs compile` exists.

The repository already writes this knowledge down, but only for its own
contributors: [AGENTS.md](../AGENTS.md) and [fjs/AGENTS.md](../fjs/AGENTS.md)
describe how to work *on* this repository, not how to work *with*
FunctionalScript in someone else's project. A downstream user gets neither.

### Proposal

Ship a small set of [agent skills](https://agentskills.io) — a folder per
skill, each with a `SKILL.md` (front matter `name` and `description`, then
instructions) — that a user installs into their agent once and that load
when the task matches. Candidates, smallest useful set first:

1. **Writing FunctionalScript.** The subset in brief: what `.f.js` means,
   what is allowed and refused, the module shape (`export default`, imports
   by relative path with an extension), and a link to [spec/](../spec/README.md)
   as the reference rather than a copy of it.
2. **Testing.** Writing a `proof.f.mjs` and running `fjs test`, pointing at
   [fjs/emergent_testing](../fjs/emergent_testing/README.md).
3. **Compiling.** `fjs compile` and its outputs, pointing at
   [the output contracts](../spec/command-line/output.md).
4. **The MCP server.** Registering `fjs mcp` with an agent client, pointing at
   [fjs/mcp/README.md](../fjs/mcp/README.md).

Each skill stays short and links to the documentation that already exists,
so the skills cannot drift from it by restating it.

### Open questions

- **Where the skills live.** A top-level `skills/` directory, or next to the
  module each one describes (`fjs/compiler/skills/…`), matching how `todo/`
  is co-located.
- **How they ship.** The npm `files` list in [package.json](../package.json)
  publishes only `.js`, `.mjs` and declaration files, so a `SKILL.md` would not
  reach users through `npm install` today. Options: widen `files`, publish
  through an agent plugin marketplace, or have the CLI install them
  (`fjs skills install <dir>`), which would also keep them versioned with the
  package.
- **Generated or handwritten.** Some content (the CLI command table, the list
  of refused constructs) already exists elsewhere; whether a skill is generated
  from it, like other committed generated files, or handwritten and checked.
- **How we know a skill works.** An agent with the skill loaded should produce
  a module that `fjs compile` accepts and a proof that `fjs test` passes,
  where the same agent without it does not. Whether that becomes a check, or
  stays a manual trial recorded in the pull request.

### Related

- [new-pl.md](./new-pl.md) — FunctionalScript as data for AI agents
- [fjs/mcp/README.md](../fjs/mcp/README.md) — the existing agent-facing surface

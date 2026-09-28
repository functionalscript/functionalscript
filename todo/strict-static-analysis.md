## Check the JavaScript side as strictly as the Rust side

**Priority:** P2
**Status:** open

### Problem

CI checks the two code bases to very different standards.

The Rust half is held hard: `cargo clippy -- -D warnings` and
`cargo clippy --release -- -D warnings` across nine targets, `cargo fmt --check`,
and `cargo test` in both profiles on every one of them.

The JavaScript half runs `tsc` and the test suites (`fjs test`,
`node --test`, `deno task cov`, `bun test --coverage`) — and nothing else. No
lint, no formatting check, no unused-code check, no package-correctness check.
`tsconfig.json` leaves four checking flags off. There is no equivalent of
`-D warnings` anywhere on this side.

That asymmetry is the gap to close, using well-known tools rather than
home-grown ones. FunctionalScript's own [`/*: type */` +
RTTI direction](../spec/todo/3360-type-annotations.md) is a long way out and
gated on the compiler; until it arrives, `tsc` and the standard JavaScript toolchain are the
checker, and they should be turned up as far as they go.

### How to add a check

The workflow is **generated**: `.github/workflows/ci.yml` is written by
`fjs/ci/` via `npm run gen`, and CI verifies the committed file matches
(`git add -A && git diff --cached --exit-code`). A new check is a change to
`fjs/ci/`, not to the YAML. Deno and Bun are already installed on every runner,
so tools shipping with them cost no extra setup step.

### Candidates

Ordered by value per unit of cost. Each entry says what it catches that the
others do not.

| Tool | Catches | Cost | Issue |
| --- | --- | --- | --- |
| `tsc` strictness flags | index access without a check, unused locals, property access from index signatures | none — already installed | [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) |
| `deno fmt --check` | formatting drift | none — Deno is on the runners and `deno.json` **already configures** `fmt` (4-space, no semicolons, single quotes, width 80); it simply is not run | this issue |
| `deno lint` | a rule set disjoint from `tsc`'s, no new dependency | none — Deno is on the runners | this issue |
| ESLint + `typescript-eslint` | type-aware rules — `no-unnecessary-type-assertion`, `no-unnecessary-condition`, `no-floating-promises` | a large dependency tree, config, and a CI step | [eslint.md](./eslint.md) |
| `knip` | unused **exports** and dependencies across modules — `noUnusedLocals` is file-local and cannot see these | one devDependency | this issue |
| `publint`, `@arethetypeswrong/cli` | broken `exports`/`types` resolution in the published package — the repo publishes `.d.mts` from `prepack`, which is exactly where these break | two devDependencies, run at pack time | this issue |
| `madge` / `dpdm` | import cycles | one devDependency | this issue |

One repo-specific check is worth listing beside them: **the emitted `.d.mts`
must not degrade to `any` or `/*elided*/`**. `fjs/AGENTS.md` records a real case
where a `@type {const}` cast made declaration emit give up and write
`/*elided*/ any` in one module, visible only to a consumer type-checking against
the published declarations. `npm run prepack` already emits them; nothing
inspects the output for this. A check has to parse the declarations — the
TypeScript compiler API, or `typescript-eslint` — rather than match text in
them, and needs approval like any other tool
([AGENTS.md §6](../AGENTS.md#6-external-tools)). The same inspection could
report an exported type that references an unexported one
([detect-unexported-types-referenced-by-exported-types](./detect-unexported-types-referenced-by-exported-types.md)).

### Proposal

1. ~~Enable the four low-cost `tsc` flags~~ — done; the remaining four are
   tracked in [tsconfig-strict-flags.md](./tsconfig-strict-flags.md).
2. Add `deno fmt --check` and `deno lint` to the generated workflow. Both are
   free in setup terms; expect one cleanup commit each.
3. Add the declaration-emit check for `any` / `/*elided*/`, with a tool that
   parses the declarations — and, from the same inspection,
   [unexported types referenced by exported ones](./detect-unexported-types-referenced-by-exported-types.md).
   If no such tool is approved, the rule stays written down and unenforced.
4. Add `knip`, then `publint` + `attw`.
5. Decide ESLint ([eslint.md](./eslint.md)) — the only entry that costs a real
   dependency tree, and the only one that reaches type-aware rules.
6. Work through the remaining `tsc` flags, `noUncheckedIndexedAccess` last,
   re-measured now that the `assert` conversions of
   [inline-type-casts.md](./inline-type-casts.md) have landed.

Each step lands as its own commit, verifiable with `tsc` and `fjs t`.

### Open question

Formatting is the one entry likely to be contentious: `deno fmt` would rewrite
the whole tree to its own idea of the configured style, and the repository has a
deliberate hand-maintained layout. It may be worth running it once to see the
size of the diff before committing to it — or scoping it to new files only.

If `deno fmt` is not the answer, the need stays: a third-party formatter — or,
failing that, one built here — that handles `.f.mjs` (and, after stage 2,
`.f.js`) correctly for everyday coding: indentation, line width, spacing.
Language-level normalization, such as rewriting JavaScript string spellings
into JSON ones, is out of scope for any formatter; it belongs to
FunctionalScript tooling itself.

### Related

- [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) — the `tsc` half, measured.
- [eslint.md](./eslint.md) — the linter decision.
- [inline-type-casts.md](./inline-type-casts.md) — the audited casts no current
  check sees.
- [detect-unexported-types-referenced-by-exported-types](./detect-unexported-types-referenced-by-exported-types.md)
  — a declaration check that needs the same parsing tool.
- [`spec/todo/3360-type-annotations.md`](../spec/todo/3360-type-annotations.md) —
  where the type layer is eventually going, and why it does not change what to
  do now.

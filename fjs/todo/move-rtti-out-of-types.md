## Move `rtti` out of `fjs/types/`

**Priority:** P4
**Status:** open

### Problem

`fjs/types/rtti/` is a subsystem filed among leaf utilities. Four things say so.

**Size.** It is 5789 lines — 38% of all of `fjs/types/` (15063), and larger than
every top-level `fjs/` directory except `types` and `media`:

| LOC | directory |
|---|---|
| 5789 | `fjs/types/rtti/` |
| 1624 | `fjs/types/btree/` |
| 1074 | `fjs/types/bit_vec/` |
| 4975 | `fjs/djs/` (for scale — a top-level peer) |

It has six modules (root, `common`, `parse`, `validate`, `data`, `ts`), a README
tree of its own, and eleven open todos. Its siblings under `types/` are single
data structures and type-level helpers.

**Nobody under `types/` uses it.** Zero imports; `types/phantom/types.ts` names
it only in a doc comment. All 64 import references come from `media` 33,
`protocol` 11, `mcp` 8, `edag` 6, `ci` 3 and `emergent_testing` 3 — every one
of them a peer of `types/`, not a member. It is simultaneously a heavily-used
module and the least-connected one in the directory that holds it.

**Consuming `types/` is not membership.** `rtti` imports `types/object`,
`types/result`, `types/list`, `types/array`, `types/ts` and `types/phantom` —
which is exactly what the rest of `fjs/` does: repo-wide, `types/list` has 82
import references from 14 top-level directories, `types/result` 78 from 10,
`types/object` 59 from 16. That is outside-consumer behaviour.

**Its outward dependency points sideways, not down.** Other `types/*` modules do
reach outside — `bigint`, `bit_vec`, `number`, `prime_field` and `string` import
`fjs/common/monoid`, `uint8array` imports `fjs/text`, and several proofs import
`media/json`'s `stringify` — but those targets sit *below* `types/`:
`fjs/common/` is the cross-cutting-algorithm bucket that `monoid` was moved out
of `types/` to create, and `text/` is the character-encoding layer under the
media formats. `rtti/ts/module.f.mjs` imports `fjs/js/keywords` at runtime,
language tooling of the same rank as `bnf` and `fsc`; `rtti`'s parse and
validate proofs import `fjs/djs/types.ts`. Those are peers, so `rtti` is not
sitting at the foundation the way the rest of `types/` is.

Positively: `fjs/rtti` beside `fjs/djs` reads as what the two are — `djs` the
data model, `rtti` the types described over it.

### Proposal

Move `fjs/types/rtti/` → `fjs/rtti/` whole: modules, proofs, `types.ts`
companions, `README.md` files, and `todo/`. No file is split and no code
changes; only import paths move.

Directory paths are the public API — the package publishes the tree with no
`exports` map — so this is a breaking change for downstream importers of
`functionalscript/fjs/types/rtti/…`, and belongs in `changelog/unreleased/`.
That argues for doing it now rather than after more consumers accumulate.

The move is its own PR, touching nothing else, per the one-move-per-PR rule in
[group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md).

Scope of the path edits:

- 30 code files outside `rtti/` import it (`media` 14, `protocol` 6, `mcp` 5,
  `ci` 2, `edag` 2, `emergent_testing` 1). Each drops the `types/` segment and
  keeps its `../` count — `../types/rtti/…` → `../rtti/…` from `edag`,
  `../../../types/rtti/…` → `../../../rtti/…` from `media/json/rtti`. Four more
  name the old path in doc comments only
  — `edag/types.ts`, `media/json/module.f.mjs`, `nanvm/types.ts`,
  `types/phantom/types.ts`.
- 58 import lines in 16 files *inside* `rtti/` re-anchor, by one rule that
  holds at every nesting depth: **a path into `types/` keeps its `../` count
  and gains a `types/` segment; a path out of `types/` loses one `../`.**
  Nesting depth is preserved either way — do not rewrite by pattern. From the
  `rtti/` root, `../object/…` → `../types/object/…` and `../../asserts` →
  `../asserts`; from a subdirectory one level down, `../../object/…` →
  `../../types/object/…` and `../../../djs` → `../../djs`. The 39 inward paths
  are `object` 12, `result` 10, `ts` 9, `array` 3, `phantom` 3, `list` 2; the
  19 outward are `asserts` 16, `djs` 2, `js` 1.
- Markdown breaks in **both** directions, in four classes. **Inventory by
  resolving paths, not by grepping `types/rtti`** — string matching misses
  every reference that reaches the subtree without spelling that segment, and
  link-syntax matching misses every path written in inline code or a fence.
  - *Into `rtti/`* — **37 links in 19 files** (`changelog/` aside), found by
    resolving every relative markdown target and asking whether it lands in
    the subtree. 36 spell `types/` and simply drop it, keeping their `../`
    count. The 37th does not: `fjs/types/todo/66d-ts-printer-tuple-readonly-fold.md`
    reaches a sibling as `../rtti/ts/module.f.mjs`, so it *gains* a `../` and
    becomes `../../rtti/ts/module.f.mjs` — the opposite direction from the
    rule covering the other 36, and invisible to both a `types/rtti` grep and
    a check confined to the moved subtree. A further 14 files name the old
    path in prose or a fence and are edited by hand.
  - *Out of `rtti/`, as links* — the moved files' own outward links break too,
    easy to miss because nothing outside the subtree changes. 15 links in 7
    files, every one leaving `types/`, so every one loses a `../`:
    `README.md` reaches `media/json/todo/rtti-parse.md` as `../../media/…` →
    `../media/…`; `data/README.md` has `../../../bnf/…` and `../../../djs/…`;
    `todo/` has four `../../../edag/module.f.mjs`, four
    `../../../../todo/…`, two `../../../../spec/todo/…`, one
    `../../../emergent_testing/…` and one `../../../AGENTS.md`. None targets a
    `types/` sibling, so none gains a `types/` segment.
  - *Out of `rtti/`, not as links* — 16 relative refs in 6 files written as
    inline code or inside fences, so no link checker sees them, each losing a
    `../` like the links: `../../../cas` in
    `todo/parse-omits-undefined-members.md`,
    `../../../media/json/schema/module.f.mjs` in `todo/identity-aware-parse.md`,
    and the `edag`/`spec`/`todo` refs across `todo/`.
  - *Self-referential* — 21 literal `fjs/types/rtti/…` paths in 4 moved todo
    files (`shared-helper-reuse.md` 6, `export-node-accessors.md` 6,
    `kindset-eliminator.md` 6, `proof-shared-asserts.md` 3), naming the very
    subtree being moved. Repo-root-absolute, so no `../` arithmetic — a plain
    substitution to `fjs/rtti/…`.
- `changelog/` entries keep the old path — all 16, not only the 9 already
  released. The 7 in `unreleased/` (1653, 1657, 1680, 1683, 1687, 1708, 1712)
  have not shipped, so "the record of what shipped" is the wrong reason for
  them. The right one is that an entry records what one pull request changed,
  against the tree as it stood then, and releasing renames `unreleased/` to
  `<version>/` "keeping the entry files exactly as they are"
  ([changelog/README.md](../../changelog/README.md#layout)) — so rewriting an
  unreleased entry's paths would make it describe a tree that never existed
  when its PR landed. What tells a reader the module moved is the move's own
  entry naming the rename, not a retroactive edit to its neighbours. If the
  maintainer prefers the 7 rewritten so a single release reads coherently,
  that is a defensible opposite call and belongs here as a decision.

`fjs/media/json/rtti/` — the JSON binding — keeps its name and its place. It is
named after what it binds, and no path collides.

### Tasks

- [ ] `git mv fjs/types/rtti fjs/rtti` (keeps history for `--follow`).
- [ ] Re-anchor the 58 external imports inside `fjs/rtti/`, by the depth rule
      above rather than by a blanket pattern substitution.
- [ ] Update the 30 importing code files, and the four doc-comment references.
- [ ] Update the 37 inbound links and the 14 prose mentions outside
      `changelog/`, including `fjs/AGENTS.md` (§3 references `types/rtti`,
      `types/rtti/parse`, `types/rtti/validate`) and the sibling link in
      `fjs/types/todo/66d-ts-printer-tuple-readonly-fold.md`, which gains a
      `../` rather than dropping a segment.
- [ ] Re-anchor the moved subtree's outward references — 15 links plus 16
      non-link refs in inline code and fences — each losing one `../`, and
      rewrite the 21 literal `fjs/types/rtti/…` self-paths.
- [ ] Check every path reference resolves, in both directions, by resolving
      targets rather than grepping for `types/rtti`, and covering inline code
      and fences as well as link syntax. Nothing here fails a test: `npx tsc`
      and `fjs test` see none of it.
- [ ] Add `changelog/unreleased/<PR>.md`, named by the move PR's own number,
      with the entry prefixed **verbatim** `**BREAKING CHANGES:**`. That marker
      is not decoration: it is the mechanical version-bump trigger — one such
      entry anywhere in `unreleased/` means the release cannot be a patch
      ([changelog/README.md](../../changelog/README.md), the table at `:98`),
      so pre-1.0 this ships as `0.47.0`, not `0.46.2`. Omit it and removing the
      published `functionalscript/fjs/types/rtti/…` path goes out under a patch
      bump. AGENTS.md pairs the prefix with updating every importer in the same
      PR, which the tasks above already do.
- [ ] `npm run update`. The move edits `fjs/ci/common/module.f.mjs`, which is
      generator source, and `ci-update` regenerates committed files that CI
      drift-checks and fails on when stale (see `fjs/nanvm/update/module.f.mjs`).
      Expect a no-op — rtti's location is not embedded in any generated output —
      and commit whatever it does write.
- [ ] `npx tsc`, `fjs test`, `npm run cov` — proofs and 100% coverage unchanged.
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.
      The move touches no Rust — nothing under `nanvm-lib/` references rtti —
      but that governs only whether running them locally is worth the time,
      not whether they gate the PR: `.github/workflows/ci.yml` runs all three
      on every pull request with no path filter (24 `cargo clippy` invocations
      across the platform jobs, `cargo fmt -- --check` at `:312`), so
      AGENTS.md's "only if you touched Rust" is advice for the local loop and
      CI is the enforcer. Expect them untouched; they become a real check only
      if `npm run update` regenerates the Rust operator tests.
- [ ] Delete this file, and close out the umbrella entry. `git mv` moves only the
      rtti subtree, so this issue would survive its own completion, and
      `todo/README.md` requires the fixing PR to delete its issue, capturing any
      design decision in a `README.md` first — here the membership argument, why
      `rtti` is a peer of `djs` rather than a member of `types/`, which belongs
      in the moved `fjs/rtti/README.md` and should outlive this file. Turn the
      `Later candidates` bullet in
      [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
      into a done entry, the way its item 1 records the `basen` move.

### Related

- **Merge-order hazard with the RTTI epic**
  ([#1719](https://github.com/functionalscript/functionalscript/pull/1719)),
  in two facets, neither visible to any inventory run on this branch.
  - `todo/rtti-type-system.md` exists only on that branch and is dense in
    `types/rtti` path references — 45 at its head `f736b79`, 43 a few commits
    earlier. **Treat any figure here as a snapshot**: that branch is active, so
    re-measure at merge time rather than trusting this line.
  - It also adds files *inside* `fjs/types/rtti/todo/` — one at `f736b79`
    (`data-validate-admits-non-djs-values.md`) — which the move would itself
    relocate, so the two changes collide on the subtree as well as on
    references to it.

  Whichever lands second rewrites paths the other just wrote. Cheapest order:
  land the epic first, then re-run this plan's inventory over the merged tree —
  the epic is prose about rtti, while this move is what invalidates paths.
- [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
  — the umbrella reorg. This is the same shape as its item 2, which moved
  `monoid` out of `types/` on the rule that `types/` admits data structures and
  type-level utilities, not cross-cutting subsystems.

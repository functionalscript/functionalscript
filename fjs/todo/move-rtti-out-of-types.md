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
it only in a doc comment. All 63 import references come from `media` 33,
`protocol` 11, `mcp` 8, `edag` 5, `ci` 3 and `emergent_testing` 3 — every one
of them a peer of `types/`, not a member. It is simultaneously a heavily-used
module and the least-connected one in the directory that holds it.

**Consuming `types/` is not membership.** `rtti` imports `types/object`,
`types/result`, `types/list`, `types/array`, `types/ts` and `types/phantom` —
which is exactly what the rest of `fjs/` does: repo-wide, `types/list` has 81
import references from 14 top-level directories, `types/result` 74 from 10,
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
- Markdown breaks in **both** directions, and the same rule settles both.
  - *Into `rtti/`*: 32 files outside it (`changelog/` aside) name the old path
    — 18 carry 36 relative links, which drop the `types/` segment and keep
    their `../` count; the other 14 mention it in prose or a code fence and
    are edited by hand.
  - *Out of `rtti/`*: the moved files' own outward links break too, and this
    is easy to miss because nothing outside the subtree changes. 15 links in
    7 files, every one leaving `types/`, so every one loses a `../`:
    `README.md` reaches `media/json/todo/rtti-parse.md` as `../../media/…` →
    `../media/…`; `data/README.md` has `../../../bnf/…` and `../../../djs/…`;
    `todo/` has four `../../../edag/module.f.mjs`, four
    `../../../../todo/…`, two `../../../../spec/todo/…`, one
    `../../../emergent_testing/…` and one `../../../AGENTS.md`. No outward
    markdown link targets a `types/` sibling, so none gains a `types/`
    segment.
- Historical `changelog/` entries keep the old path. They are the record of
  what shipped; leave them.

`fjs/media/json/rtti/` — the JSON binding — keeps its name and its place. It is
named after what it binds, and no path collides.

### Tasks

- [ ] `git mv fjs/types/rtti fjs/rtti` (keeps history for `--follow`).
- [ ] Re-anchor the 58 external imports inside `fjs/rtti/`, by the depth rule
      above rather than by a blanket pattern substitution.
- [ ] Update the 30 importing code files, and the four doc-comment references.
- [ ] Update the 36 inbound markdown links and the 14 prose mentions outside
      `changelog/`, including `fjs/AGENTS.md` (§3 references `types/rtti`,
      `types/rtti/parse`, `types/rtti/validate`).
- [ ] Re-anchor the 15 outbound links in the moved `README.md` and `todo/`
      files — each loses one `../`.
- [ ] Check every relative link in the moved subtree resolves, in both
      directions; a broken markdown link fails no test.
- [ ] Add `changelog/unreleased/` entry noting the breaking path change.
- [ ] `npm run update`. The move edits `fjs/ci/common/module.f.mjs`, which is
      generator source, and `ci-update` regenerates committed files that CI
      drift-checks and fails on when stale (see `fjs/nanvm/update/module.f.mjs`).
      Expect a no-op — rtti's location is not embedded in any generated output —
      and commit whatever it does write.
- [ ] `npx tsc`, `fjs test`, `npm run cov` — proofs and 100% coverage unchanged.
      No Rust file references rtti, so `cargo test`/`clippy`/`fmt` stay out of
      scope under AGENTS.md's "only if you touched Rust"; they come back in only
      if the step above regenerates the Rust operator tests.
- [ ] Delete this file, and close out the umbrella entry. `git mv` moves only the
      rtti subtree, so this issue would survive its own completion, and
      `todo/README.md` requires the fixing PR to delete its issue — capturing any
      design decision in a `README.md` first. Turn the `Later candidates` bullet
      in [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
      into a done entry, the way its item 1 records the `basen` move.

### Related

- [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
  — the umbrella reorg. This is the same shape as its item 2, which moved
  `monoid` out of `types/` on the rule that `types/` admits data structures and
  type-level utilities, not cross-cutting subsystems.

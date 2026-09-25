## Group `fjs/` subdirectories by concern

**Priority:** P4
**Status:** open

### Problem

`fjs/` mixes foundational data structures, encoders, language tooling, storage
and project infrastructure in one flat list of top-level directories. It is
being regrouped by concern incrementally — one move per PR, not a big-bang
reorg — because directory paths are the public API (there is no `exports`
map), so every move is a breaking change, and every cross-module import is a
relative `.f.mjs` path.

The moves agreed so far have landed: the base-N codecs and their factory under
[`fjs/basen/`](../basen/module.f.mjs), `monoid` under `fjs/common/`, the `fjs`
bin promoted to `fjs/module.f.mjs`, `rtti` promoted from `fjs/types/` to
`fjs/rtti/`, and the content formats under `fjs/media/` — whose membership,
dialect and cycle rules are now in [`fjs/media/README.md`](../media/README.md).

Two things remain.

**Later candidates.** A storage bucket for `cas` + `sul`, and a testing bucket
for `asserts` + `emergent_testing`. There is no `fjs/grammar/` bucket: the
migration that built [`fjs/ebnf/`](../ebnf/README.md) put the grammar machinery
inside it, and its README settles that `fsc` and `js` stay out as consumers.

**The first `exports` map.** `deno.json` has no `exports` map today, so
nothing restricts which modules a consumer can reach. When a map is first
introduced it must enumerate every `module.f.mjs` then present — a partial map
silently restricts a package that is unrestricted today. Modules proposed
meanwhile are counting on this: `fjs/effects/{all,sandbox,console,test}`
([node-module-layering](../effects/todo/node-module-layering.md)) records that
its registration lands here rather than in its own change.

### Tasks

- [ ] Decide the storage and testing buckets, one move per PR, or drop them.
- [ ] Whichever change first introduces a `deno.json` `exports` map enumerates
      every `module.f.mjs` present at that point, then runs
      `npm run lock-update`.

### Related

- [`fjs/media/README.md`](../media/README.md) — the `fjs/media/` bucket's
  membership, dialect and cycle rules.
- [node-module-layering](../effects/todo/node-module-layering.md) — the same
  regroup-by-concern exercise inside `fjs/effects`, and a dependent of the
  `exports` map rule.

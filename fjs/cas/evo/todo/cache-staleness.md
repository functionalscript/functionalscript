## Refresh the Evo cache against concurrent CAS writers

**Priority:** P2
**Status:** open

### Problem

The Evo cache (`fjs/cas/evo/module.f.ts`) is built once at server startup
(`initEvo` → `buildCache`) and afterwards is only ever updated by writes that
go *through this same running process*: `evo_add` (`addRevision`) and a
`cas_add` that happens to store a `vnd.fjs.revision` blob (`syncRevision`,
see `fjs/cas/mcp`). Nothing else refreshes it.

But `~/.cas/` is an ordinary directory on disk, and the CAS store itself has
no notion of "the" server — the `cas` CLI, a completely different MCP server
process, or any other tool can `cas add` a revision blob directly, bypassing
this server's cache entirely. Once that happens, this server's `evo_list`/
`evo_head` silently disagree with the actual contents of the store until the
process restarts (which rebuilds the cache from scratch via `buildCache`).

This is a different problem from the one already documented in
[`fjs/cas/evo/README.md`](../README.md)'s "In-memory cache is per process"
section: that section is about *multiple server processes* each holding
their own cache. This issue is about a *single* running server's cache going
stale because of writes it didn't perform itself, even with only one server
process active.

### Requirements

Whichever option(s) are implemented, the update **must be incremental**: it
only examines and decodes hashes the cache has not already folded in, never
the whole store from scratch. `cas.list()` (or equivalent) is cheap to call
repeatedly and may be used to discover the current hash set each time, but
every hash already known to the cache is skipped — not re-read, not
re-decoded, not re-validated. This is not a performance nice-to-have; a
"refresh" that silently redoes full-store work on every call (every `list`
call, every timer tick, every explicit `refresh`) does not scale with store
size and defeats the purpose of caching in the first place.

### Proposal

Three options, not mutually exclusive:

1. **Periodic rescan.** The server periodically re-lists the store (or diffs
   against the last known hash set) and folds any newly-found revisions into
   the cache, on a timer independent of any tool call. Simple, bounded
   staleness window, but wastes work when nothing changed and still leaves a
   window where a client can observe stale data right after an external
   write.
2. **Explicit refresh operation.** Add a `refresh` function to the `Evo<O>`
   API that re-scans the store and merges findings into the existing cache,
   callable on demand. Expose it through a single, cache-agnostic MCP tool
   (e.g. `refresh` or `cache_refresh`) rather than an `evo_refresh` — more
   in-memory caches beyond Evo's are planned, and a one-tool-per-cache naming
   scheme doesn't scale; a generic tool that refreshes every cache the
   running server currently maintains fits that future instead. Puts the
   client in control of the staleness/cost tradeoff, but requires the client
   to know to call it — an agent that doesn't know external writes are
   happening has no reason to.
3. **Refresh-on-read for `cas_list`/`evo_list`.** Have the list-shaped
   operations refresh (or at least check for new hashes) before answering,
   since those are exactly the calls that enumerate the whole store and are
   most likely to be used to discover what changed. `evo_head`/`cas_get`
   could opt out (cheaper, targeted lookups) or also refresh, depending on
   how strong a consistency guarantee is wanted.

Whatever is chosen needs to reuse `buildCache`'s fold rather than
duplicating it (see `addRevisionToCache`'s "any order converges to the same
result" property in the module doc): a refresh is `buildCache`'s fold seeded
from the current cache instead of `emptyCache`, applied only to the hashes
not already known (see Requirements above) — never a re-fold over the whole
store.

### Tasks

- [ ] Decide which option(s) to implement (a periodic timer, an explicit
      generic `refresh` tool, refresh-on-`list`, or some combination).
- [ ] If a `refresh` tool is chosen, design it as a single, cache-agnostic
      entry point that refreshes every in-memory cache the running server
      currently maintains, not one tool per cache (more caches beyond Evo's
      are planned).
- [ ] Design how the set of "hashes not already known" is computed on each
      refresh (a `cas.list()` diff against the cache's known hashes is the
      obvious baseline) — the diff itself may cost O(store size), but only
      the previously-unseen hashes it finds may be read/decoded/folded in
      (see Requirements above; this is not optional). Consider whether the
      store should expose something cheaper than a full `list()` for finding
      new hashes (e.g. a last-modified marker), as a further optimization.
- [ ] Decide whether a periodic timer fits the current effect model
      (`fjs/effects`) — is there already a precedent for scheduled/background
      work, or does this need new effect primitives?
- [ ] Implement the chosen option(s) with proof coverage.
- [ ] Update `fjs/cas/evo/README.md` and `fjs/cas/evo/mcp/README.md` to
      describe the staleness/consistency guarantees once decided.

### Related

- [`fjs/cas/evo/README.md`](../README.md) — "In-memory cache is per process":
  the adjacent (but distinct) multi-process cache-sharing problem.
- `fjs/cas/todo/66j-cas-periodic-stage-recovery.md` — an existing precedent
  for periodic/best-effort background maintenance in this same store.
- `fjs/cas/todo/web-api-server.md` — a shared HTTP(S) server would have one
  cache read by many clients, raising the same staleness question from the
  other direction (many readers, is the one cache ever stale relative to
  writes the server itself performed — not the concern here, but adjacent).

## Return a subject's full revision history

**Priority:** P3
**Status:** open

### Problem

`Evo<O>` (`fs/cas/evo/module.f.ts`) only exposes `head(subject)` — the
current head hashes — and `list()` — all known subjects. There is no way to
retrieve a subject's *history*: the revisions that led up to its current
head(s). A client that wants to render history, walk past merges, or
reconstruct an earlier state of the subject has to `head(subject)` and then
walk parent links itself, one `cas_get` at a time — there is no single call
for "everything belonging to this subject".

The history is not a simple sequence: `vnd.fjs.revision` (`fs/media/revision`)
is a DAG (multiple parents on a merge, and a subject can have multiple
concurrent heads), so whatever shape this returns has to represent branching
and merging, not just a linear list.

### Proposal

No design has been chosen yet. Candidate shapes, roughly in order of how
much new format they invent:

1. **Just the node set.** `Evo<O>` already tracks, per subject,
   `SubjectState.hashes` — every revision hash ever added for that subject
   (`fs/cas/evo/module.f.ts`). With the cross-subject-parent check
   (`validateParentSubjects`) now in place, every parent of a subject's
   revision is guaranteed to belong to the same subject, so this set is
   already exactly the DAG's node set — closed under "is a parent of". A
   `history(subject)` that just returns this array (already-cached, free to
   compute) needs no new serialization: each revision blob already embeds
   its own `parents`, so a client that wants edges fetches each hash via the
   existing `cas_get`/`decodeRevisionBlob` and reconstructs the DAG itself.
   Cheapest to implement and to reason about; costs the client N additional
   fetches to see any structure.
2. **Edge list.** `readonly (readonly [hash: Hash, parents: readonly Hash[]])[]`
   — one entry per revision, pairing its hash with its parent hashes,
   embedding the edges without inventing an object-keyed format. Order
   independent, trivial to fold into a client-side adjacency map, and (unlike
   option 3) never uses a hash as an object *key*, so it can't run into the
   own-property-lookup class of bug the Evo cache itself had to fix
   (`fs/cas/evo/module.f.ts` `at`) — a hash colliding with `toString`/
   `constructor` is astronomically unlikely but not the kind of thing worth
   relying on when a plain array sidesteps it entirely.
3. **Adjacency map keyed by hash**, as originally sketched:
   ```json
   {
     "headRevisionHash": ["parent0Hash", "parent1Hash"],
     "parent0Hash": ["..."]
   }
   ```
   Reads naturally as "the DAG", but every key is a hash used as a plain
   object property — the same shape of risk `at` (own-property lookup) was
   added to guard against for subjects; hashes aren't attacker-controlled
   arbitrary strings the way subjects are, so this is a much smaller concern
   here, but a consumer indexing this object should still look up by own
   property, not bare `obj[hash]`.
4. **Flattened left-branch sequence**, modeled on Git: the *left* (first-
   listed) parent is the mainline — the branch this history is "of" — and
   any further (*right*) parents are other branches that merged into it, the
   way Git's first-parent link marks the branch a merge commit landed on.
   Rendered history tools (`git log --first-parent`) walk exactly this link
   and treat the rest as detail; this format encodes that same asymmetry
   instead of treating all parents as interchangeable.

   A flat array is the mainline: each element is normally a bare hash,
   continuing to that hash's own mainline parent as the next element. A
   node that is *also* a merge (has more than one parent) replaces its bare
   entry with a binary bracket `[node, mergedParent]`, where `mergedParent`
   is the (recursively encoded) branch that merged in. The mainline then
   continues as usual: if this node has a predecessor already extending a
   flat array, its own mainline parent becomes the *next* element of that
   same array; if the node is the value's own starting point (no
   predecessor to continue from), its mainline parent has nowhere else to
   go and is wrapped in too, as the outermost element of the same bracket.

   Worked examples:
   - `['a', 'b', 'c']` — no merges, pure mainline: `a`'s parent is `b`,
     `b`'s parent is `c`.
   - `['a', ['b', 'd'], 'c', 'd']` — `a`'s mainline parent is `b`; `b` is a
     merge (bracket `['b', 'd']`: `b`'s merged-in parent is `d`); `b`'s own
     mainline parent, `c`, continues the *outer* array (there was already
     one to continue, from `a`); `c`'s parent is `d`. Edges: `a→b`, `b→d`,
     `b→c`, `c→d`.
   - `[[[a, d], c], b]` — `a` is a three-way merge (`a → b, c, d`) and is
     itself the sequence's starting point, so *all three* parents end up
     wrapped: innermost `[a, d]` pairs `a` with its last-listed parent `d`;
     wrapping with `c` adds the next; wrapping with `b` (outermost) adds the
     mainline parent last, because there's no enclosing array for `b` to
     continue instead. Edges: `a→b`, `a→c`, `a→d`.

   Three-or-more-parent merges are expected to be extremely rare (as in
   Git), so the format doesn't need a flat "list of siblings" shape for
   them — nesting one binary bracket per extra parent, as above, is an
   acceptable fallback for a case this uncommon, in exchange for keeping the
   common one-merged-parent case (`[node, mergedParent]`) simple.

   More compact than option 3 for a mostly-linear history (no hash is
   repeated as a key), and the grammar is recursive (a merged parent is
   itself encoded the same way, so it can carry its own further history)
   rather than limited to one level of branching.

   Still open: a subject can have more than one *current* head at once (see
   `head(subject)`'s return type, `readonly Hash[]`), but every worked
   example above starts from a single head. Does `history` take/return one
   sequence per head, or does the grammar need a way to start several
   left-branch chains in one value?

Whatever is chosen should also settle:

- **Archived revisions** (`archived: true`) — included in history or not?
  History is presumably meant to include them (that's what "history" means),
  but worth stating explicitly.
- **Size.** A long-lived subject's history can be arbitrarily large; does
  `history` need pagination, a depth limit, or a "since generation X" cursor,
  or is returning everything acceptable for a first version?
- **Staleness.** Same cache-staleness concern as
  [`todo/cache-staleness.md`](cache-staleness.md) — history is served from
  the in-memory cache like everything else in `Evo<O>`.
- **MCP surface.** Presumably a new `evo_history` tool
  (`fs/cas/evo/mcp/module.f.ts`) alongside `evo_list`/`evo_head`/`evo_add` —
  unlike the generic refresh tool in `cache-staleness.md`, this one is
  Evo-specific (a subject's revision history isn't a concept any other
  planned cache would share), so a dedicated tool name is fine here.

### Tasks

- [ ] Pick a history representation (one of the above, or something else)
      and write out its exact shape and reconstruction algorithm.
- [ ] Decide the open questions above (archived revisions, size/pagination,
      staleness, MCP tool name/shape).
- [ ] Implement `history(subject)` on `Evo<O>` with proof coverage,
      including a subject with a merge (multiple parents) and one with
      multiple concurrent heads.
- [ ] Expose it through MCP (`fs/cas/evo/mcp`) and document it in
      `fs/cas/evo/README.md` / `fs/cas/evo/mcp/README.md`.

### Related

- [`todo/cache-staleness.md`](cache-staleness.md) — history is read from the
  same in-memory cache, so it inherits that staleness question.
- `fs/media/revision/README.md` — the `vnd.fjs.revision` DAG shape
  (`parents`, merges, concurrent heads) this history has to represent.

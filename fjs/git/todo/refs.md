## Refs: `HEAD`, `refs/`, and `packed-refs`, as plumbing

**Priority:** P3
**Status:** open

### Problem

An object is reached by id, and a repository is entered through its
refs: `HEAD`, the heads under `refs/`, the tags. Nothing here reads a
ref, so a caller must be handed an id and cannot find one.

What a ref is *for* in DISOT is settled and narrow, and this issue must
not widen it. [git-name-resolution](../../../todo/git-name-resolution.md)
makes Git refs retention roots and nothing else: a ref keeps commits
reachable so Git does not prune them, and a ref's *name* carries no
DISOT meaning — not a name, not an identity, not authority, not a signal
of rename or archive, not a way to choose among heads. DISOT semantics
come from `.disot.*` files, authority and timestamp evidence, and
ancestry. So a reader of refs here is plumbing: it answers which ids a
repository keeps reachable, and where a walk may start, and it is never
the step that resolves a DISOT name.

### Proposal

Three files, all text, all delimiter-framed and so grammars over the byte
alphabet like the objects:

- `HEAD`, and any symbolic ref: `ref: <name> LF`, or a bare hex id.
- `refs/<name>`: a hex id and LF, one file per loose ref.
- `packed-refs`: an optional `# pack-refs with:` header line, then
  `<hex> SP <name> LF` per ref, a `^<hex>` line after a tag naming what it
  points to.

Two functions over the effects:

- `roots()`: every ref the repository holds, as `(name, id)` pairs, one
  per name — the retention roots, and the set of ids a candidate-commit
  search may start from. A name may sit in both places, since
  `pack-refs` leaves the loose file until it is safe to drop and a later
  update writes the loose file and leaves the packed line stale, and Git
  reads the loose file first: a loose ref shadows the packed one of the
  same name, and only the effective value is a root. The names come
  along because the files hold them, not because they mean anything; a
  consumer that reads meaning into one is outside this design. The id a
  ref names is not always a commit's: a tag ref names an annotated tag
  object, and a tag may name another tag, so a candidate-commit search
  peels before it reads — it follows the tag's `object` through
  [`fjs/git/tag`](../tag/module.f.mjs) until what it reaches is not a tag,
  and starts from that if it is a commit and from nothing if it is a tree
  or a blob. `packed-refs` may carry a `^<hex>` peeled line under a tag,
  which is a shortcut and never the rule, since a loose tag ref has no
  such line; the search peels through the object store either way.
- `tryResolve(ref)`: the id one ref names — its loose file, or its
  `packed-refs` line where there is no loose file — a symbolic ref
  followed to a bounded depth, or `null`.
  Two names need reading specially here, and only here: `FETCH_HEAD` and
  `MERGE_HEAD` may each hold more than one record, so Git reads them straight
  from the file rather than through a ref backend. That makes a symbolic ref
  pointing at either one resolve when the file exists and fail when it does
  not, measured on Git 2.43.0, where `ORIG_HEAD` resolves either way. The
  grammars cannot decide it, since it is a fact about the repository and not
  about one file's bytes, so they accept both as targets and this function
  owes the check. For plumbing that has a ref in hand —
  `HEAD` for a checkout, a ref a person typed at a command line — and
  for nothing that resolves a DISOT name.

A ref name that is no ref name is refused by the rules
[`fjs/git/refname`](../refname/module.f.mjs) holds, which is where they now
live: `fjs/git/tag` held them first, because a tag's `tag` header is a ref
name and its reader was the first thing that had to judge one, and they are
not a fact about tags. A `packed-refs` name and a symbolic ref's target each
need one rule more, and it is the one that module's `isWholeName` holds: the
name rule plus a refusal of `@` alone, which is
`git check-ref-format --allow-onelevel`.

One level is enough, and an earlier draft of this paragraph said otherwise —
that a target must be `refs/` and then a name, stricter than
`check-ref-format`. That was wrong, from measuring `HEAD` alone and reading
its error as a refusal of the *name*. Writing `ref: a/b` into `.git/HEAD`
makes Git stop treating the directory as a repository, which is a rule about
what `HEAD` may say; the same target in `refs/heads/sym` resolves, and
`git show-ref` reads a packed line naming `master` or `a/b`. So `refs/`
belongs to a `HEAD` reader and not to these two, and a `roots` or
`tryResolve` built on the old sentence would reinstate a restriction the
grammars deliberately do not have.

Reading is through `readFile` and `readdir`; writing a ref, with the lock
file Git takes, is a later task, and so is the reflog, which expires and is
no retention.

### Tasks

- [x] Grammars for the three files, and their readers.
- [x] The ref-name rules shared with the tag module.
- [ ] `roots` and `tryResolve`, over the effects, with the virtual
      filesystem as their proof.

### Related

- [git-name-resolution](../../../todo/git-name-resolution.md) — "Git refs
  exist only for reachability / GC protection", the rule this issue is
  bound by.
- [`fjs/git/README.md`](../README.md) — the objects a ref keeps.
- [object-store.md](./object-store.md) — from an id to the object.

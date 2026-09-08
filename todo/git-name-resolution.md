## Git names and relative name resolution

**Priority:** P3
**Status:** open

### Problem

Content hashes are universal immutable addresses, but they are not the names
people use to collaborate. A module, document, website, dataset, or other
evolving object needs a human-readable name whose meaning is relative to a
trust namespace rather than to a globally allocated DNS-like namespace.

The convention must work for **any programming language, hypertext format, or
other content**. Git is only the immutable history/transport container; the
naming model must not depend on JavaScript, Python, HTML, a package manager, or
a particular Git hosting service.

The DISOT architecture already describes paths such as:

```text
~/Alice/Bob/plan.md
/<identity>/Alice/Bob/plan.md
```

where every hop is authenticated and `~` is relative to a trust anchor.

The design must keep three things separate:

1. **name** — human-readable and contextual;
2. **namespace** — the identity whose namespace gives the name meaning;
3. **hash** — the final immutable revision/content selected by resolution.

A commit signer is deliberately **not** the namespace. A contributor may sign
a new commit without changing the logical identity of the content or silently
reinterpreting its relative references.

### Put DISOT metadata in the tree, not custom Git headers

Do **not** add `name` or `namespace` as custom Git commit headers.

A custom header is preserved while the exact commit object is transported, but
ordinary Git operations that create a new commit — for example rebase,
cherry-pick, squash, or a normal `git commit` — do not know that the custom
header must be copied. The metadata can therefore disappear when a user works
with standard Git tooling.

Instead, keep it as an ordinary file in the commit tree. Standard Git tooling
then treats the metadata exactly like the source/content it describes: a new
commit normally inherits it unless the tree is intentionally changed.

The initial canonical filenames are:

```text
.disot.json
.disot.data.js
```

They are two serializations of **one logical DISOT metadata value**:

- `.disot.json` — JSON;
- `.disot.data.js` — DataJS.

A tree SHOULD contain at most one recognized `.disot.*` metadata file. If more
than one recognized encoding is present, a resolver MUST reject the ambiguity
rather than choose one by filename priority or trust that their values happen
to agree.

The leading dot makes the file infrastructure metadata rather than ordinary
user content, while the `disot` namespace makes accidental collision much less
likely than generic names such as `manifest.json`, `.meta.json`, or
`package.json`.

### Shape

Conceptually:

```json
{
  "namespace": "<identity>",
  "name": "parser",
  "lock": {
    "json": "<immutable-hash>"
  }
}
```

The exact lock-map schema may reuse/evolve the existing recursive lock-map
work. The important semantics are:

- `namespace` — the namespace in which this named object and its otherwise
  unresolved relative references are interpreted;
- `name` — this object's name inside that namespace;
- `lock` — optional exact immutable resolutions for relative dependencies,
  including nested/scoped choices where one flat map is insufficient.

The logical object identity is therefore:

```text
(namespace, name)
```

For example:

```text
namespace = DID:Alice
name      = parser

=> DID:Alice/parser
```

The Git repository containing the commit is not part of that identity. The same
commit/tree copied to another repository still describes the same object.

### Why `namespace`, not `root`

`namespace` states what the value actually is and avoids overloading `root` with
filesystem, repository, trust-root, and dependency-root meanings.

It also gives relative resolution a language-independent base. For example,
content containing a relative reference conceptually equivalent to:

```text
./json
```

resolves, when not already locked, as:

```text
DID:Alice/json
```

for an object whose `.disot.*` says:

```text
namespace = DID:Alice
```

The resolver does not need to understand whether the source spelling was an
ECMAScript `import`, Python import, HTML URL, CSS URL, Markdown link, or a
reference in some future language. Language-specific tooling discovers the
relative name; DISOT resolves that name.

### Relative paths

The human-facing path syntax has two root forms:

```text
~/Alice/parser
/<identity>/Alice/parser
```

`~` is the current user's/trust context at the point an **unresolved** path is
entered. Once a concrete object is selected, its `.disot.*` supplies the
`namespace` used to interpret that object's own relative names, and exact lock
bindings override mutable resolution.

Resolution is hop-by-hop. Conceptually:

```text
(current trust context, "Alice")
    -> authenticated Alice namespace
(Alice, "parser")
    -> authenticated named history
    -> selected commit
    -> tree containing .disot.*
    -> immutable content
```

Discovery may use Git refs, local indexes, signed directories, CAS/DISOT
indexes, or network services. Those are lookup mechanisms, not identity.

### Forks and contributions

**Signing a fork does not change `namespace` or `name`.**

Suppose Alice has:

```text
.disot.json:
    namespace = DID:Alice
    name      = parser
```

Bob checks out Alice's commit, changes the source, and creates a new commit on
top signed by Bob. Unless Bob intentionally edits `.disot.json`, the new tree
still says:

```text
namespace = DID:Alice
name      = parser
```

Therefore existing relative references still resolve in Alice's namespace.
This is exactly what is wanted for a contribution intended to go back to
Alice: Bob's signature authenticates Bob's revision; it does not rename or
re-root Alice's object.

If Bob intentionally creates his own independent object, changing identity is
an ordinary, reviewable tree change:

```diff
- "namespace": "DID:Alice",
- "name": "parser",
+ "namespace": "DID:Bob",
+ "name": "my-parser",
```

Changing `namespace` may change the fallback meaning of relative references
that are not pinned by `lock`. A tool performing this operation should resolve
and update the lock explicitly so the semantic effect is visible rather than
silently caused by the signer changing.

### Lock semantics

The lock is a reproducibility record, not merely a cache.

For each applicable relative dependency:

```text
relative name
    -> namespace/name
    -> exact immutable hash
```

an exact lock binding wins over mutable name resolution. A locked hash is
terminal for resolution: it is not reinterpreted as another mutable name.

This also solves the fork case without parsing unknown source languages. If a
tree already has `.disot.*`, standard Git carries the namespace and lock
forward. If a tree has no DISOT metadata and a DISOT-aware tool wants to turn it
into a named/signed object, the tool creates the metadata file before signing
the resulting commit.

The tool does not need to discover every import/reference merely to preserve the
namespace context: `namespace` covers unknown relative references, while lock
entries pin the ones whose immutable resolution has been recorded.

### Heads, forks, and ambiguity

A name may have many commits. Given known commits whose trees describe the same
`(namespace, name)`, a resolver considers ancestry rather than timestamps or
arrival order:

- an ancestor is an older revision, not a competing head;
- one maximal descendant is the current unambiguous head;
- several incomparable maximal commits are forks/concurrent heads;
- a merge commit descending from those heads can make the history unambiguous
  again.

A resolver MUST NOT choose among incomparable heads merely by commit time,
lexicographic hash order, network arrival order, or which server answered
first. It either applies an explicit caller trust/policy rule or reports the
ambiguity. An exact lock binding removes the ambiguity for that dependency.

### Git refs are projections

Git branches/refs are useful mutable indexes, but they are not authoritative
object identity.

A tool may reconstruct a convenient branch such as:

```text
refs/heads/parser
```

from commits whose trees say:

```text
namespace = <expected namespace>
name      = parser
```

and whose ancestry/trust policy yields one unambiguous head. If several maximal
heads remain, reconstruction reports a fork rather than silently choosing one.

This keeps a repository a storage/replication container. Moving commits between
repositories or changing ref layout does not rename the objects inside them.

### Interaction with signatures and trusted timestamps

The `.disot.*` file is part of the Git tree, and the tree hash is part of the
commit payload. Therefore a DID signature over the commit (`gpgsig2` in the
companion prototype), a trusted timestamp (`tstsig`), and a final conventional
Git signature transitively authenticate the exact DISOT metadata without any
additional Git header.

A resolver must distinguish:

- **described as** — `(namespace, name)` from `.disot.*`;
- **signed by** — identities that authenticated this exact commit;
- **anchored at** — trusted timestamp evidence, if present;
- **locked to** — immutable hashes selected for dependencies.

These values may intentionally involve different identities.

### Future encodings — P5

**Priority:** P5

The filename is a small encoding registry:

```text
.disot.<encoding>
```

The initial specification supports only:

```text
.disot.json
.disot.data.js
```

Later, if there is real demand, add other lossless encodings of the same
logical metadata value, for example:

```text
.disot.yml
.disot.toml
```

Adding an encoding MUST NOT add semantics. Every supported representation must
round-trip the same data model, validation rules, name/namespace meaning, and
lock behavior. In particular, an encoding whose native data model cannot
represent the canonical DISOT value without ambiguity or loss should not be
added merely because the syntax is popular.

Multiple recognized `.disot.*` files in one tree remain an error even after
more encodings are introduced.

### Prototype tasks

- [ ] Define the canonical logical `.disot` schema with required `namespace`
      and `name`, plus the recursive optional `lock`.
- [ ] Define canonical `.disot.json` serialization and parsing.
- [ ] Define canonical `.disot.data.js` serialization and parsing with exactly
      the same logical value and validation semantics.
- [ ] Reject a tree containing more than one recognized `.disot.*` file.
- [ ] Define the identity representation shared with DID signatures.
- [ ] Define the exact textual domain of `name` and namespace path segments.
- [ ] Implement relative-name resolution using the object's `namespace` as the
      default base and exact lock bindings as overrides.
- [ ] Implement ancestry-based head detection and explicit ambiguity on
      incomparable forks.
- [ ] Enforce the fork rule: a new signer never implicitly changes
      `.disot.*`; namespace/name changes are explicit tree edits.
- [ ] When namespace/name are intentionally changed, resolve/update the lock so
      changed dependency meaning is explicit and reviewable.
- [ ] Specify discovery/fetch mechanics separately from semantic resolution so
      Git refs, CAS indexes, or network services can be swapped.
- [ ] Test source-identical commits signed by different DIDs and prove their
      identity and relative-resolution context stay unchanged while `.disot.*`
      is unchanged.
- [ ] Test ambiguous same-name forks, a later merge that removes the ambiguity,
      and locks that deliberately pin either fork.
- [ ] Test ordinary Git rebase, cherry-pick, merge, squash, clone/fetch/push,
      pack/unpack, and garbage collection to establish exactly when tree-carried
      DISOT metadata is retained or intentionally changed.
- [ ] P5: evaluate `.disot.yml` and `.disot.toml` only after the JSON/DataJS
      model is stable and a consumer actually needs another encoding.

### Related

- [DISOT architecture](./plan/architecture.md) — global hashes and
  trust-root-relative human-readable paths.
- [DISOT vision](./plan/vision.md) — the `~/Alice/...` web-of-trust namespace.
- [Evo product materialization](../fjs/cas/evo/todo/product-materialization.md)
  — consumes a resolved dependency graph and must not rewrite source objects.
- [`vnd.fjs.revision`](../fjs/media/revision/README.md) — current revision and
  recursive lock-map model; resolution policy is deliberately outside the
  format.
- [`vnd.fjs.lock`](../fjs/media/lock/README.md) — current shared lock-map value;
  the future source/content convention moves the identity/resolution metadata
  into `.disot.*` files in the Git tree.
- [Git trusted timestamp signatures](./git-trusted-timestamp-signatures.md) —
  companion proposal for DID signatures and trusted timestamps inside standard
  Git commits.

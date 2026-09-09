## Git names and relative name resolution

**Priority:** P3
**Status:** open

### Problem

Content hashes are universal immutable addresses, but they are not the names
people use to collaborate. A module, document, website, dataset, or other
evolving object needs a human-readable name without depending on a globally
allocated DNS-like namespace.

The convention must work for **any programming language, hypertext format, or
other content**. Git is only an immutable history/transport container. DISOT
semantics must not depend on JavaScript, Python, HTML, a package manager, a Git
branch name, or a particular Git hosting service.

Keep these concepts separate:

1. **DISOT name** — a human-readable path identifying an evolving entity;
2. **hash** — an immutable revision/content address;
3. **authority attestation / trust** — who is allowed to establish, advance,
   rename, or relinquish a name;
4. **trusted timestamp evidence** — when an authenticated revision/history is
   proven to have existed;
5. **Git ancestry** — causal evolution, forks, merges, renames, and archival
   markers;
6. **Git refs** — reachability roots used only to keep Git objects from becoming
   unreachable and eligible for garbage collection.

### Put DISOT metadata in the tree, not custom Git naming headers

Do **not** put the DISOT name in a custom Git commit header.

A custom header is preserved while the exact commit object is transported.
However, many common Git operations that synthesize new commits — including a
normal `git commit`, rebase, cherry-pick, and squash — do not preserve arbitrary
custom headers. Some operations, such as `git commit --amend`, may preserve them.
Therefore DISOT semantic metadata cannot rely on custom headers surviving
ordinary Git workflows.

Instead, keep naming/resolution metadata as an ordinary file in the commit tree.
Standard Git tooling then treats it like the source/content it describes and
normally carries it forward when creating a descendant commit.

The initial canonical filenames are:

```text
.disot.json
.disot.data.js
```

They are two serializations of **one logical DISOT metadata value**:

- `.disot.json` — JSON;
- `.disot.data.js` — DataJS.

### Metadata lookup boundary

DISOT metadata is recognized **only at the root of the Git commit tree**.
Resolvers inspect only direct root entries for recognized `.disot.*` filenames.
They MUST NOT recursively scan nested trees for metadata.

For example:

```text
.disot.json                 # recognized for this commit/entity
src/.disot.json             # ordinary content
vendor/x/.disot.data.js     # ordinary content
```

A nested subtree can be treated as a separate DISOT entity only when it is
independently committed/resolved as such.

The commit root SHOULD contain at most one recognized `.disot.*` metadata file.
If more than one recognized encoding is present at the root, a resolver MUST
reject the ambiguity rather than choose one by filename priority.

### One path-valued `name`

Use one path-valued `name` instead of a separate `namespace` + local-name pair.

Preferred form:

```json
{
  "name": "/secp256k1:23a/coolJsModule"
}
```

The namespace is already part of the absolute path, so a separate field would
only split a value that the resolver immediately recombines.

The initial P3 schema keeps `name` singular. Multiple names may be added later,
but only after authority and relative-resolution semantics are defined for that
case. Aliases/redirects can provide additional names without making the entity
itself multi-named.

### Relative self-names

A DISOT metadata file MAY use a relative self-name:

```json
{
  "name": "./coolJsModule"
}
```

A relative self-name is a convenience for a personal namespace. When the entity
is first established, `./name` expands using the **unique cryptographically
authenticated author DID for that revision**. The author DID comes from
authorship evidence for the revision; it is not inferred from the set of
identities that later authorize, endorse, or otherwise attest to the same
revision, and it is never derived from the textual Git `author` name/email.

Conceptually:

```text
authenticated author DID = secp256k1:23a
name                     = ./coolJsModule

=> /secp256k1:23a/coolJsModule
```

If more than one distinct DID is accepted specifically as an author of the same
first revision, `./name` is ambiguous and MUST NOT establish a name. The author
must use an explicit absolute name instead:

```text
authenticated author DIDs = Alice, Bob
name                      = ./parser

=> ERROR: ambiguous relative self-name
```

Authority is evaluated separately after the relative name is expanded. For
example, a Bob attestation may authorize or endorse a revision authored by Alice
only if the applicable policy permits Bob to act for `/Alice/...`; it does not
change the name base from Alice to Bob.

Later authority/trust/timestamp attestations may accumulate evidence for the
same immutable revision without reinterpreting its effective name. An unchanged
`./name` remains relative to its authenticated author DID even when later
evidence arrives from other identities.

Relative self-names SHOULD be discouraged, especially for shared,
organizational, transferable, or multi-controller entities. Shared entities
SHOULD use an explicit absolute name whose namespace represents the shared
entity/project rather than one contributor:

```json
{
  "name": "/<project-or-shared-DID>/coolJsModule"
}
```

### Shape

Conceptually:

```json
{
  "name": "/DID:Alice/parser",
  "lock": {
    "json": "<immutable-hash>"
  }
}
```

The exact lock-map schema may reuse/evolve the existing recursive lock-map work.
The important semantics are:

- `name` — the entity's DISOT path, absolute in the preferred form and relative
  only under the rules above;
- `lock` — optional exact immutable resolutions for relative dependencies,
  including nested/scoped choices where one flat map is insufficient.

The Git repository containing the commit and every Git ref pointing at it are
not part of the entity identity.

### Authority attestations are representation-independent

A root `.disot.*` file is only bytes in a Git tree until accepted authority
attestation(s) adopt it. Its presence MUST NOT by itself establish a name, lock,
or any other DISOT semantics.

The naming layer MUST NOT require one particular signature encoding. It consumes
verified **authority attestations**: evidence that an identity cryptographically
authenticated the semantic Git revision and is authorized by the resolver's
trust policy for the relevant operation.

At least two encodings can provide such evidence:

1. **detached DISOT provenance/signature blocks**, for example a CAS object that
   references the exact stored object hash and carries a signature + signer DID;
2. **Git-native embedded signatures**, such as the companion `didsig`
   prototype, whose own specification defines the signed projection/payload.

These forms are interoperable at the naming layer but are not required to have
the same wire representation or target hash. The signature verifier for each
encoding decides whether the attestation authenticates the semantic revision;
this naming design only consumes the verified result.

Detached attestations remain important because independent parties can add
trust later without rewriting the Git commit. Embedded `didsig` is therefore a
Git-native attestation encoding, not a replacement for detached DISOT
provenance.

The same representation-independence applies to timestamp evidence: an embedded
`tstsig` may be one encoding, while detached DISOT timestamp/provenance blocks
may provide another. Naming semantics depend on accepted evidence, not the
container used to carry it.

### Late evidence may adopt the exact immutable revision

Authority/trust is evaluated from the evidence currently known to the resolver.
Detached authority or timestamp evidence may arrive **after** the Git commit it
targets. If later evidence directly authenticates that exact immutable revision
and satisfies the applicable authority/timestamp policy, the same existing
revision may become authoritative without creating a new Git commit.

For example:

```text
C1  adds .disot.json
    no accepted authority/timestamp evidence
    -> provisional / not authoritative

later:
    detached authority attestation -> exact C1
    trusted timestamp evidence      -> exact C1

    -> C1 becomes eligible as an authoritative shared revision
```

This does not mutate `C1`, change its hash, or rewrite history. Only the
resolver's evidence set has changed.

For a relative self-name, late evidence does not recompute the author DID. The
authenticated author is a property of the revision's authorship evidence, while
later authority, endorsement, and timestamp evidence is evaluated separately.

A later descendant can instead adopt unchanged metadata at its own revision:

```text
C1  adds .disot.json     no accepted authority attestation
 |
C2  same .disot.json     accepted authority/timestamp evidence for C2
                         -> metadata adopted at C2
```

Evidence for `C2` does **not** automatically authenticate `C1`. Evidence affects
exactly the revision/projection it authenticates. A timestamped descendant may
anchor the existence time of an ancestor only under the separate ancestry-based
timestamp rules.

Trust is subjective and policy-driven. Delegation, key rotation, multiple
controllers, or community trust rules may authorize attestations.

### Trusted timestamps are required for shared authoritative history

This proposal follows the DISOT architecture rule that content shared outside
its author's process must be **both authenticated and timestamped** before it is
trusted.

A locally authenticated revision MAY be provisional/local state before trusted
timestamp evidence exists. It MUST NOT become an authoritative shared DISOT
revision for another process merely because an authority attestation verifies.

For externally shared resolution, accepting a semantic revision therefore
requires both:

1. accepted authority attestation(s) for the relevant operation; and
2. accepted trusted-timestamp evidence.

Timestamp evidence may be direct or may come from an accepted timestamped
descendant/merge that cryptographically commits to the exact ancestor through
Git parent hashes, when allowed by the timestamp specification.

Thus:

```text
accepted authority attestation only
    -> authenticated/provisional revision

accepted authority attestation + accepted timestamp evidence
    -> eligible authoritative shared revision
```

The rule applies to establishment, advancement, rename, relinquishment/archive,
and semantic merges.

### Git-backed names vs signed DISOT directories

The older DISOT architecture describes names as signed directory mappings from a
path segment to a hash. This Git-backed naming model deliberately changes the
**final binding rule for Git-backed named entities**.

For a Git-backed entity, an authoritative revision is established by:

```text
root .disot.* self-name
+ accepted authority attestation(s)
+ required trusted timestamp evidence
+ Git ancestry
```

A signed DISOT directory MUST NOT independently override that Git history by
mapping the same final name to some other commit hash.

Signed directories remain useful for:

- trust-path traversal such as `~/Alice/...`;
- aliases and redirects;
- discovering candidate Git histories/commits;
- non-Git DISOT objects that still use the directory-to-hash model.

For a Git-backed final entity name, a directory mapping is therefore a discovery
hint/index, not the authoritative revision selector. A candidate discovered
through a directory MUST still be validated against its root `.disot.*`,
authority evidence, timestamp evidence, and ancestry. If the directory points to
a commit that does not validate for the requested name, the mapping does not win.

This proposal therefore supersedes the old directory-to-hash final-binding rule
**only for Git-backed named entities**. `todo/plan/architecture.md` should be
updated when this design is adopted so both documents describe the same model.

### Relative references

The namespace portion of the entity's **effective absolute name** supplies the
default namespace for otherwise-unlocked relative references in its content.

```text
entity              = /DID:Alice/parser
relative dependency = ./json

=> /DID:Alice/json
```

If metadata used `./parser`, establishment first expands it to an effective
absolute name. Later signers do not change that base.

The resolver does not need to know whether the source spelling is an ECMAScript
`import`, Python import, HTML URL, CSS URL, Markdown link, or a reference in a
future language. Language/hypertext-specific tooling discovers the relative
reference; DISOT resolves the DISOT name.

### Lock semantics

The lock is a reproducibility record, not merely a cache.

```text
relative name
    -> effective DISOT name
    -> exact immutable hash
```

An exact applicable lock binding wins over mutable name resolution. A locked
hash is terminal for resolution and is not reinterpreted as another mutable
name.

Changing the namespace component of an entity name may change the fallback
meaning of relative references that are not pinned by `lock`. Tools performing
an authorized rename/transfer should resolve/update the lock explicitly so the
semantic effect is reviewable.

### Forks and contributions

Attesting to a descendant does not automatically rename the entity.

Suppose Alice has an authoritative history whose metadata says:

```json
{
  "name": "/DID:Alice/parser"
}
```

Bob changes the source and creates/attests a descendant. Unless an authorized
operation changes `.disot.*`, the tree still describes `/DID:Alice/parser`.
Bob's attestation says who authenticated Bob's revision; whether Bob is trusted
to advance Alice's authoritative history is a separate policy decision.

### A name change is two independent operations

Changing `.disot.*` from one effective name to another contains two independent
assertions:

1. **relinquish/archive the old name**; and
2. **establish the new name**.

Each assertion is evaluated under the authority policy of the name it affects.

```text
C1  name = /DID:Alice/parser
 |
C2  name = /DID:Bob/my-parser
```

Effects:

- authorized for both old and new names -> rename/transfer;
- authorized only for the new name -> new/forked entity; old name remains
  active on any unrelinquished lineage;
- authorized only for the old name -> old lineage is relinquished; new name is
  not established;
- authorized for neither -> no authoritative naming effect.

There is **no implicit redirect**. Redirects/aliases require an explicit
authorized representation in the namespace that owns the alias.

### Removing `.disot.*` relinquishes the inherited name

Removing the recognized root `.disot.*` from an established semantic lineage is
the no-new-name form of relinquishment.

```text
C1  .disot.json = { name: /DID:Alice/parser }   authoritative
 |
C2  .disot.json unchanged                      authoritative
 |
C3  root .disot.* removed                      authorized + timestamped
```

`C3` relinquishes the inherited name **only for the lineage(s) it causally
descends from**.

An unauthenticated, unauthorized, or insufficiently timestamped removal has no
authoritative archival effect.

Archiving does not delete history. Earlier revisions remain immutable and
addressable by hash.

### Archival is ancestry-scoped, not global

Relinquishment/tombstones are causal. They do not globally erase incomparable
authoritative forks merely because they use the same DISOT name.

Example:

```text
      H1 ---- T      # T relinquishes .disot.*
     /
A ---
     \
      H2             # incomparable authoritative head
```

`T` archives/relinquishes the lineage through `H1`, but it does **not** archive
`H2`. `H2` remains an active authoritative head.

To relinquish all currently known authoritative heads with one tombstone, the
tombstone must causally descend from all of them, normally through a semantic
merge:

```text
H1 ---\
       M --- T
H2 ---/
```

Alternatively each fork can be relinquished independently.

Therefore the correct rule is:

> A relinquishment terminates only the active head(s) in its ancestry. It has no
> semantic effect on incomparable authoritative heads.

If a previously unknown incomparable authoritative fork is discovered later, it
may make the name active/ambiguous again under the resolver's trust policy. DISOT
does not invent a total order from timestamps, ref names, or arrival order to
hide that causal fact.

The same ancestry scope applies to the old-name side of a rename. A rename
commit descending from only one of several old-name heads cannot retire the
other incomparable heads.

### Heads, forks, renames, and archival

For one effective DISOT name, consider accepted semantic revisions and
relinquishment markers by ancestry:

- an ancestor is an older revision, not a competing head;
- one maximal active descendant is an unambiguous active head;
- several incomparable maximal active commits are forks/concurrent heads;
- an authorized semantic merge descending from those heads may restore one
  unambiguous head;
- an accepted relinquishment makes only the active heads in its ancestry
  inactive for that name.

A resolver MUST NOT choose among incomparable heads merely by commit time,
lexicographic hash order, Git branch name, network arrival order, or which
server answered first. It either applies explicit caller trust/policy or reports
ambiguity. An exact lock binding removes ambiguity for that dependency.

### Git refs exist only for reachability / GC protection

DISOT does **not** use Git branch/ref names as names, identities, authority,
rename signals, archive signals, discovery semantics, or semantic head
selection.

Their sole role in this Git-backed design is pragmatic: ordinary Git may prune
unreachable objects. Commits that must remain available therefore need to stay
reachable from persistent refs unless another storage layer guarantees
retention.

```text
.disot.* + authority/timestamp evidence + ancestry = DISOT semantics
Git refs                                            = retention roots only
```

A ref name may be arbitrary. Renaming a ref changes nothing. Deleting a ref does
not archive an entity; it is safe only when required commits remain reachable
elsewhere.

Reflogs are not sufficient because they expire.

Live incomparable heads may temporarily require multiple reachability refs.
Those refs still have no naming semantics.

### Archive-retention compaction — open optimization question

One possible Git-only retention optimization is to merge terminal archived
lineages into a common archive branch so individual retention refs can be
deleted. This could reduce the number of long-lived refs.

However, the current semantic format does **not** define a durable way to
distinguish such a synthetic retention merge from a metadata-free semantic
relinquishment/merge after the commit is transported independently of its ref.
Adding a `type`, `retention`, dedicated marker file, or other protocol surface
would be premature before we know this optimization is needed.

Therefore this optimization is **not part of the P3 semantic contract**. No
`.disot.*` field, filename, or commit-header marker is reserved for it now.
Implementations should keep whatever refs are required for GC safety, or use a
storage layer with its own retention guarantees.

If archive-ref compaction becomes necessary later, first answer:

- Do we need to distinguish retention-only commits from semantic no-metadata
  commits after arbitrary transport?
- Can another invariant or storage layer eliminate the need for synthetic
  retention commits entirely?
- If a durable distinction is necessary, what is the smallest representation
  that does not unnecessarily expand the permanent DISOT format?

The optimization may be dropped entirely if experience shows it is unnecessary.

### Open questions

- **Archive-retention classification:** Is a synthetic archive branch needed at
  all? If yes, define a durable, transport-independent classification rule
  before implementing it. Do not reserve a schema field or marker yet.

### Future encodings — P5

**Priority:** P5

Treat the filename as a small encoding registry:

```text
.disot.<encoding>
```

The initial specification supports only:

```text
.disot.json
.disot.data.js
```

Later, if there is real demand, add other lossless encodings of the same logical
metadata value, for example:

```text
.disot.yml
.disot.toml
```

Adding an encoding MUST NOT add semantics. Every supported representation must
round-trip the same data model, validation rules, name meaning, and lock
behavior. Multiple recognized `.disot.*` files at the commit root remain an
error. Nested files with those basenames remain ordinary content.

### Prototype tasks

- [ ] Define the canonical logical `.disot` schema with one required path-valued
      `name` and an optional recursive `lock`.
- [ ] Define canonical `.disot.json` and `.disot.data.js` encodings with the
      same logical semantics.
- [ ] Recognize `.disot.*` only at the commit-tree root and reject multiple
      recognized root encodings.
- [ ] Specify canonical absolute names `/<identity>/<path...>` and relative
      self-names such as `./name`.
- [ ] Require one unique cryptographically authenticated author DID for
      `./name`; reject ambiguous multi-author authorship and require an absolute
      name.
- [ ] Keep authorship separate from later authority/trust attestations; prove
      late co-attestations do not reinterpret an already-established relative
      self-name.
- [ ] Discourage `./name` for shared/transferable/multi-controller entities.
- [ ] Keep multiple `name` values out of P3 until authority/resolution semantics
      are defined.
- [ ] Define a representation-independent authority-attestation interface used
      by naming resolution.
- [ ] Support detached DISOT provenance/signature blocks without rewriting Git
      commits; treat `didsig` as an optional Git-native attestation encoding.
- [ ] Define representation-independent trusted timestamp evidence; keep `tstsig`
      as one optional Git-native encoding.
- [ ] Define late-evidence adoption: detached authority/timestamp evidence may
      make the exact immutable revision it targets authoritative without a new
      Git commit.
- [ ] Prove evidence for a descendant does not automatically authenticate its
      ancestors; ancestry-based timestamp anchoring remains a separate rule.
- [ ] Require accepted authority evidence + accepted trusted timestamp evidence
      for externally shared authoritative semantic revisions.
- [ ] Specify/test direct and ancestry-based timestamp anchoring according to
      the companion timestamp design.
- [ ] Define Git-backed final-name authority as root `.disot.*` + accepted
      authority/timestamp evidence + ancestry; signed directories are discovery,
      alias/trust-path, or non-Git naming mechanisms and cannot override it.
- [ ] Update `todo/plan/architecture.md` when this model is adopted so the old
      directory-to-hash final-binding rule excludes Git-backed named entities.
- [ ] Implement relative-reference resolution from the effective absolute name,
      with exact lock bindings as terminal overrides.
- [ ] Define name changes as independent old-name relinquishment and new-name
      establishment assertions.
- [ ] Prove authority for only the new name cannot archive the old name, and
      authority for only the old name cannot establish the new one.
- [ ] Define no implicit redirect on rename.
- [ ] Define root `.disot.*` removal as no-new-name relinquishment.
- [ ] Make relinquishment ancestry-scoped: it affects only active heads in its
      ancestry and never incomparable authoritative heads.
- [ ] Test a tombstone on one fork, tombstones/merge covering all forks, and a
      later-discovered incomparable fork.
- [ ] Implement ancestry-based active-head detection and explicit ambiguity on
      incomparable authoritative forks.
- [ ] Ensure Git ref names are never semantic inputs; use persistent refs only
      for reachability/GC protection.
- [ ] Keep archive-retention compaction out of P3. If it proves necessary,
      define a durable classification rule before implementing synthetic archive
      merges; otherwise drop the optimization.
- [ ] Test custom-header behavior across ordinary commit-producing operations,
      including normal descendant commits, rebase, cherry-pick, squash, and
      `git commit --amend`; do not rely on either universal preservation or
      universal dropping of unknown headers.
- [ ] Test branch rename/deletion, clone/fetch/push, pack/unpack, and garbage
      collection.
- [ ] P5: evaluate `.disot.yml` and `.disot.toml` only after JSON/DataJS are
      stable and a consumer actually needs another encoding.

### Related

- [DISOT architecture](./plan/architecture.md) — global hashes, trust-relative
  human-readable paths, signed/timestamped trust, and the older signed-directory
  final-binding model that this Git-specific design partially supersedes.
- [DISOT vision](./plan/vision.md) — detached CAS provenance/signature blocks and
  the `~/Alice/...` web-of-trust namespace.
- [Evo product materialization — PR #1902](https://github.com/functionalscript/functionalscript/pull/1902)
  — companion TODO for consuming resolved dependency graphs without rewriting
  source objects.
- [`vnd.fjs.revision`](../fjs/media/revision/README.md) — current revision and
  recursive lock-map model.
- [`vnd.fjs.lock`](../fjs/media/lock/README.md) — current shared lock-map value;
  the future source/content convention carries naming/resolution metadata in
  root `.disot.*` files.
- [Git trusted timestamp signatures](./git-trusted-timestamp-signatures.md) —
  optional Git-native `didsig` / `tstsig` encodings; naming semantics remain
  representation-independent.
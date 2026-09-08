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

The DISOT architecture already describes paths such as:

```text
~/Alice/Bob/plan.md
/<identity>/Alice/Bob/plan.md
```

where every hop is authenticated and `~` is relative to a trust context.

Keep these concepts separate:

1. **DISOT name** — a human-readable path identifying an evolving entity;
2. **hash** — an immutable revision/content address;
3. **signature/trust** — who is allowed to establish, advance, rename, or
   archive a name;
4. **trusted timestamp evidence** — when an authenticated revision/history is
   proven to have existed;
5. **Git ancestry** — evolution, forks, merges, renames, and archival markers;
6. **Git refs** — reachability roots used only to keep Git objects from becoming
   unreachable and eligible for garbage collection.

### Put DISOT metadata in the tree, not custom Git headers

Do **not** put the DISOT name in a custom Git commit header.

A custom header is preserved while the exact commit object is transported, but
ordinary Git operations that create a new commit — for example rebase,
cherry-pick, squash, or a normal `git commit` — do not know that an unknown
header must be copied. The metadata can therefore disappear when a user works
with standard Git tooling.

Instead, keep it as an ordinary file in the commit tree. Standard Git tooling
then treats it like the source/content it describes and normally carries it
forward when creating a descendant commit.

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

This keeps one Git commit history from accidentally acquiring several DISOT
entities merely because vendored, generated, archived, or arbitrary content
contains a file with a recognized basename. A nested subtree can be treated as a
separate DISOT entity only when it is independently committed/resolved as such.

The commit root SHOULD contain at most one recognized `.disot.*` metadata file.
If more than one recognized encoding is present at the root, a resolver MUST
reject the ambiguity rather than choose one by filename priority or assume that
equivalent-looking files have the same semantics.

The leading dot marks infrastructure metadata, while the `disot` namespace
makes accidental collision much less likely than generic names such as
`manifest.json`, `.meta.json`, or `package.json`.

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

The same DISOT name type can then be used consistently in metadata, redirects,
resolver APIs, logs, indexes, and user interfaces.

The initial P3 schema keeps `name` singular. Supporting several names for the
same entity is a useful possible extension, for example:

```json
{
  "name": [
    "/secp256k1:23a/coolJsModule",
    "/secp256k2:456/alsoCool"
  ]
}
```

but this is deliberately **not** part of the initial format. Names in different
namespaces may require independent authority, and multiple names need an
unambiguous rule for which namespace supplies the base for relative references.
Aliases/redirects can provide additional names without making the entity itself
multi-named. Revisit a `name` array only after those authority and resolution
rules are specified.

### Relative self-names

A DISOT metadata file MAY use a relative self-name:

```json
{
  "name": "./coolJsModule"
}
```

When an authorized commit first establishes such a relative self-name, the
relative name is expanded using the cryptographically authenticated DID of the
trusted author/controller accepted for that operation. It is **not** the textual
name or email in Git's `author` header.

Conceptually:

```text
trusted establishing author = secp256k1:23a
name                        = ./coolJsModule

=> /secp256k1:23a/coolJsModule
```

The resulting effective absolute name belongs to the trusted history. A later
commit by another signer that merely carries the unchanged `.disot.*` file MUST
NOT reinterpret `./coolJsModule` relative to the later signer. Otherwise an
ordinary contribution would silently rename the entity.

Relative self-names SHOULD be discouraged. They couple initial naming to the
identity that happened to establish the entity and become especially awkward
for shared, organizational, transferable, or multi-controller entities.
Shared entities SHOULD use an explicit absolute name whose namespace represents
the shared entity/project rather than one contributor:

```json
{
  "name": "/<project-or-shared-DID>/coolJsModule"
}
```

Tools MAY make `./name` convenient for personal entities while warning before
using it for an entity intended to have shared or transferable control.

### Trust establishes metadata; presence does not

A root `.disot.*` file is only bytes in a Git tree until authenticated trust
adopts it. Its presence MUST NOT by itself establish a name, lock, or any other
DISOT semantics.

A commit that introduces `.disot.*` is eligible to establish the claimed name
only when its cryptographic signature is accepted by the resolver's trust policy
as authorized for that operation.

For example, an unsigned or untrusted commit cannot claim Alice's namespace by
writing:

```json
{
  "name": "/DID:Alice/parser"
}
```

The same principle applies to later metadata changes. Changing `name` or lock
data does not become authoritative merely because Git accepted the commit. The
resolver evaluates signatures and trust policy before accepting the change into
the trusted named history.

An untrusted commit may introduce `.disot.*`, and a later trusted descendant may
leave the file unchanged and sign the new commit. Because the later signature
covers the complete tree, that trusted descendant **adopts** the metadata at
that point. The earlier untrusted commit does not become trusted retroactively.

```text
C0  no .disot.*
 |
C1  adds .disot.json     unsigned / untrusted   -> not authoritative
 |
C2  same .disot.json     authorized signature   -> metadata adopted here
```

Trust is subjective and policy-driven. A trusted party does not necessarily
mean one hard-coded signer equal to the namespace DID: delegation, key rotation,
multiple controllers, or community trust rules may authorize signatures.

### Trusted timestamps are required for shared authoritative history

This proposal follows the DISOT architecture rule that content shared outside
its author's process must be **both signed and timestamped** before it is
trusted.

A locally created signed commit MAY be treated as provisional/local state by its
author before timestamp evidence exists. It MUST NOT become an authoritative
shared DISOT revision for another process merely because its signature verifies.

For externally shared resolution, accepting a commit as an authoritative
semantic revision therefore requires both:

1. an accepted signature authorizing the relevant operation; and
2. accepted trusted-timestamp evidence proving the authenticated commit/history
   existed no later than the trusted time.

Timestamp evidence may be **direct** (for example, a valid `tstsig` on the
commit) or **ancestral** when the trusted-timestamp specification allows a later
trusted timestamped descendant/merge to anchor the exact ancestor through Git
parent hashes. A descendant can anchor an ancestor only when its cryptographic
ancestry commits to that exact ancestor object; timestamp policy remains defined
by the companion trusted-timestamp specification.

Thus:

```text
valid authorized signature only
    -> authenticated/provisional revision

valid authorized signature + accepted timestamp evidence
    -> eligible authoritative shared revision
```

The timestamp rule applies equally to establishment, advancement, rename,
relinquishment/archive, and trusted merges. Synthetic retention-only commits are
not semantic DISOT revisions and therefore do not need semantic signatures or
timestamps.

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
not part of the entity identity. Copying the exact history to another repository
or changing the ref layout changes no DISOT semantics.

### Relative references

The namespace portion of the entity's **effective absolute name** supplies the
default namespace for otherwise-unlocked relative references in its content.
For example:

```text
entity = /DID:Alice/parser
relative dependency = ./json

=> /DID:Alice/json
```

If the metadata used `./parser`, the trusted establishment step first expands it
to `/DID:Alice/parser`; subsequent dependency resolution uses that effective
absolute name rather than the signer of each later commit.

The resolver does not need to understand whether a relative reference was
spelled as an ECMAScript `import`, Python import, HTML URL, CSS URL, Markdown
link, or a reference in some future language. Language/hypertext-specific
tooling discovers the relative reference; DISOT resolves the DISOT name.

The human-facing namespace syntax may also include trust-context paths such as:

```text
~/Alice/parser
/<identity>/Alice/parser
```

Discovery may use local indexes, signed directories, CAS/DISOT indexes, or
network services. Git branch names are not a naming or discovery primitive in
the DISOT model defined here.

### Forks and contributions

Signing a descendant does not rename the entity.

Suppose Alice has an authoritative history whose metadata says:

```json
{
  "name": "/DID:Alice/parser"
}
```

Bob checks it out, changes source, and creates a commit signed by Bob. Unless an
authorized operation changes `.disot.*`, the new tree still describes
`/DID:Alice/parser`. Bob's signature authenticates Bob's revision; whether Bob
is trusted to advance Alice's authoritative named history is a separate trust
policy decision. For shared authoritative use, the timestamp requirement above
also applies.

### A name change is two independent operations

Changing `.disot.*` from one effective name to another is not automatically a
single privileged "rename" operation. Semantically it contains two independent
assertions:

1. **relinquish/archive the old name**; and
2. **establish the new name**.

Each assertion is evaluated under the authority/trust policy of the name it
affects.

For example:

```text
C1  name = /DID:Alice/parser
 |
C2  name = /DID:Bob/my-parser
```

The effects are:

- if C2 is authorized for both Alice's old name and Bob's new name, C2 is a
  rename/transfer: `/DID:Alice/parser` becomes archived and
  `/DID:Bob/my-parser` becomes active;
- if C2 is authorized only for Bob's new name, it establishes a new/forked
  entity at `/DID:Bob/my-parser`, while `/DID:Alice/parser` remains active at
  its last authoritative head;
- if C2 is authorized only to relinquish Alice's old name, the old name becomes
  archived but the new Bob name is not authoritatively established;
- if C2 is authorized for neither assertion, it has no authoritative naming
  effect.

For shared authoritative resolution, each accepted assertion also requires the
trusted timestamp evidence described above.

There is **no implicit redirect** from the old name to the new name. If a
redirect/alias is desired, it must be established explicitly under the authority
of the namespace that owns the alias.

A same-namespace rename follows the same rule; it is simply common for one
controller to be authorized for both names.

Changing the namespace component may change the fallback meaning of relative
references that are not pinned by `lock`. A tool performing an authorized rename
or transfer should resolve/update the lock explicitly so the semantic effect is
visible.

This model also prevents a fork signer from retiring somebody else's name by
merely editing `.disot.*` in a descendant commit.

### Lock semantics

The lock is a reproducibility record, not merely a cache.

For each applicable relative dependency:

```text
relative name
    -> effective DISOT name
    -> exact immutable hash
```

an exact lock binding wins over mutable name resolution. A locked hash is
terminal for resolution: it is not reinterpreted as another mutable name.

If a tree already has `.disot.*`, standard Git normally carries the naming and
lock context forward. If a tree has no DISOT metadata and a DISOT-aware tool
wants to turn it into a named entity, the tool creates `.disot.*` before signing
and timestamping/adopting the resulting commit according to trust policy.

### Removing `.disot.*` archives the entity

Removing the recognized root `.disot.*` file from an established semantic
history is the special case of a name transition with **no new name**.

Once a trusted history has established a DISOT name, a later authorized semantic
descendant whose root no longer contains recognized `.disot.*` relinquishes and
archives that old name when the required trust and timestamp evidence are
accepted.

```text
C1  .disot.json = { name: /DID:Alice/parser }   authoritative
 |
C2  .disot.json unchanged                      authoritative
 |
C3  root .disot.* removed                      authorized + timestamped
     -> /DID:Alice/parser is archived
```

The archived identity comes from trusted ancestry. An unsigned/untrusted removal
or a removal lacking the required shared timestamp evidence has no authoritative
archival effect.

Here "author" means a cryptographically authenticated identity accepted by the
trust policy to control/advance/relinquish the entity, not the textual Git
`author` field.

Archiving does not delete history. Earlier revisions remain immutable and
addressable by hash. Archival only means that mutable name resolution has no
active authoritative head after the tombstone unless a later authorized
operation explicitly re-establishes the entity.

### Heads, forks, renames, and archival

For one effective DISOT name, consider known authoritative semantic revisions,
name-transition assertions, and tombstones by ancestry rather than commit
timestamps, ref names, or arrival order:

- an ancestor is an older revision, not a competing head;
- one maximal active descendant is an unambiguous active head;
- several incomparable maximal active commits are forks/concurrent heads;
- an authorized trusted merge descending from those heads may restore one
  unambiguous head;
- an accepted relinquishment caused by either a name change or `.disot.*`
  removal terminates the old name and acts as an archive marker for it.

A resolver MUST NOT choose among incomparable heads merely by commit time,
lexicographic hash order, Git branch name, network arrival order, or which
server answered first. It either applies an explicit trust/policy rule or
reports ambiguity. An exact lock binding removes ambiguity for that dependency.

An unauthenticated, unauthorized, or insufficiently timestamped shared
descendant is not automatically an authoritative head, rename, or archive
marker. It may be retained as a contribution/candidate but has no authoritative
shared DISOT semantic effect until adopted according to policy.

### Git refs exist only for reachability / GC protection

DISOT does **not** use Git branch/ref names as names, identities, authority,
rename signals, archive signals, discovery semantics, or semantic head
selection.

Their sole role in this Git-backed design is pragmatic: ordinary Git may prune
unreachable objects. A DISOT implementation therefore keeps commits that must
remain available reachable from persistent Git refs so they are not merely
detached/unreachable objects eligible for garbage collection.

Conceptually:

```text
.disot.* + trusted signed/timestamped ancestry  = DISOT semantics
Git refs                                        = Git object retention roots only
```

A ref name may be arbitrary. Renaming a ref changes nothing. Deleting a ref does
not archive an entity; it is safe only when the commits that must be retained
remain reachable through another ref or another storage layer provides the
retention guarantee.

Reflogs are not the DISOT retention mechanism because they are temporary and may
expire. Persistent refs provide the ordinary Git-native reachability roots.

Live incomparable heads that must all remain available may temporarily require
multiple reachability refs. These refs still have no naming semantics.

### One archive ref for many archived entities

Keeping one branch/ref forever for every archived entity would accumulate
unnecessary refs. Once an entity has a valid authoritative tombstone or other
accepted relinquishment marker, DISOT may merge that terminal commit into a
single synthetic **archive retention branch**.

For example:

```text
Alice/foo --- A4        # A4: trusted tombstone / relinquishment
                \
archive-0 ------ R1
                  \
Bob/bar ------- B7 \
                   R2  -> refs/heads/archive
```

A simpler implementation can extend the archive branch one terminal history at
a time:

```text
R0
 |
R1 ---- archived-A-terminal
 |
R2 ---- archived-B-terminal
 |
R3 ---- archived-C-terminal
 ^
 refs/heads/archive
```

Each synthetic archive commit uses the previous archive commit and one archived
entity's terminal commit as parents. Its tree contains **no recognized root
`.disot.*`**. After the merge, the individual archived-entity ref may be deleted
because the terminal commit and its full ancestry remain reachable from the
common archive ref.

This gives a strict separation:

```text
authorized/timestamped relinquishment in entity history
    = semantic archival

synthetic merge into archive branch
    = Git reachability/retention only
```

Archive-retention commits MUST NOT be interpreted as entities, renames,
reactivations, or new archive operations. They may have parents from unrelated
DISOT histories. Their lack of `.disot.*` is not itself a semantic tombstone,
because they are outside the semantic continuation of any one entity and exist
only to retain their ancestors.

Consequently, a generic rule such as "any merge without `.disot.*` archives its
parents" would be wrong. A relinquishment/tombstone is established in the
trusted semantic history of a particular entity first; arbitrary later
no-metadata merges are retention topology only.

The archive retention commits themselves do not need semantic signatures or
trusted timestamps because they assert nothing about DISOT. The authoritative
terminal commits in their ancestry carry the archival semantics.

If another storage layer such as CAS/DISOT guarantees retention independently of
Git reachability, these Git retention refs may become unnecessary.

### Interaction with signatures and trusted timestamps

The root `.disot.*` file is part of the Git tree, and the tree hash is part of
the commit payload. A DID signature over the commit (`gpgsig2` in the companion
prototype) therefore authenticates the exact DISOT metadata without an
additional Git naming header.

Trusted timestamps are not merely optional metadata for shared DISOT trust.
Following the architecture rule, externally shared semantic history requires
accepted timestamp evidence in addition to accepted signatures. A direct
`tstsig` is one form; an accepted timestamped descendant/merge may also anchor
an ancestor when the trusted-timestamp specification permits it.

The same applies to relinquishment/archive: the authority signature authenticates
the transition, while trusted timestamp evidence establishes its time for shared
trust.

A resolver must distinguish:

- **described as** — the `name` from root `.disot.*`, expanded to an effective
  absolute name when necessary;
- **signed by** — identities that authenticated the exact commit;
- **trusted as** — whether those signatures are authorized by policy to
  establish, advance, rename, or archive the entity;
- **anchored at** — accepted trusted timestamp evidence, direct or ancestral;
- **locked to** — exact immutable hashes selected for dependencies;
- **kept reachable by** — Git refs, which have no DISOT semantics.

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
behavior. An encoding whose native data model cannot represent the canonical
DISOT value without ambiguity or loss should not be added merely because its
syntax is popular.

Multiple recognized `.disot.*` files at the commit root remain an error even
after more encodings are introduced. Nested files with those basenames remain
ordinary content.

### Prototype tasks

- [ ] Define the canonical logical `.disot` schema with one required path-valued
      `name` and an optional recursive `lock`.
- [ ] Define canonical `.disot.json` serialization and parsing.
- [ ] Define canonical `.disot.data.js` serialization and parsing with exactly
      the same logical value and validation semantics.
- [ ] Inspect recognized `.disot.*` only at the commit-tree root; prove nested
      files with those basenames are ordinary content.
- [ ] Reject a commit root containing more than one recognized `.disot.*` file.
- [ ] Specify the canonical absolute-name grammar `/<identity>/<path...>` and
      relative self-name grammar such as `./name`.
- [ ] Define how a newly introduced `./name` expands using the trusted
      cryptographic author's DID and ensure later signers do not reinterpret an
      unchanged relative self-name.
- [ ] Make absolute names the recommended form and discourage `./name`,
      especially for shared/transferable/multi-controller entities.
- [ ] Keep multiple `name` values out of P3; separately specify authority and
      relative-resolution semantics before considering a `name` array.
- [ ] Treat root `.disot.*` as untrusted data until the containing commit's
      signature is accepted by the resolver's trust policy.
- [ ] Require trusted adoption to establish an authoritative `.disot.*` value;
      prove that an unsigned/untrusted introduction establishes no identity.
- [ ] Require accepted trusted-timestamp evidence in addition to an accepted
      signature before an externally shared semantic revision is authoritative.
- [ ] Specify/test direct timestamp evidence and ancestry-based timestamp
      anchoring through exact Git parent hashes according to the companion
      timestamp design.
- [ ] Prove a later trusted descendant can adopt unchanged metadata without
      retroactively trusting the earlier commit.
- [ ] Apply the same trust/timestamp rules to advancement, name changes, trusted
      merges, and relinquishment/archive.
- [ ] Define a name change as independent old-name relinquishment and new-name
      establishment assertions, each checked under its own authority policy.
- [ ] Prove a signer authorized only for the new name cannot archive the old
      name, and a signer authorized only for the old name cannot establish the
      new one.
- [ ] Define no implicit redirect on rename; redirects/aliases require their own
      explicit authorized representation.
- [ ] Implement relative-reference resolution from the namespace portion of the
      entity's effective absolute name, with exact lock bindings as overrides.
- [ ] Implement ancestry-based active-head detection and explicit ambiguity on
      incomparable authoritative forks.
- [ ] Define root `.disot.*` removal as the no-new-name form of authorized
      relinquishment/archive.
- [ ] Ensure Git ref names are never inputs to DISOT identity, rename, archival,
      authority, discovery, or semantic head-selection logic.
- [ ] Use persistent Git refs only as reachability roots for commits that must
      survive ordinary Git garbage collection.
- [ ] Implement/test a single synthetic archive retention branch that merges
      terminal commits from many unrelated archived entities, then permits
      removal of their individual retention refs.
- [ ] Prove archive-retention commits containing no root `.disot.*` have no
      DISOT entity semantics and cannot accidentally archive/merge unrelated
      names.
- [ ] Test branch rename/deletion and prove neither changes entity semantics when
      required commits remain reachable elsewhere.
- [ ] Test ambiguous authoritative forks, a later trusted semantic merge,
      authorized renames/transfers, tombstones, archive-retention merges, and
      locks pinning historical/forked revisions.
- [ ] Test ordinary Git rebase, cherry-pick, merge, squash, clone/fetch/push,
      pack/unpack, and garbage collection to establish exactly when tree-carried
      DISOT metadata and retained history survive ordinary Git workflows.
- [ ] P5: evaluate `.disot.yml` and `.disot.toml` only after JSON/DataJS are
      stable and a consumer actually needs another encoding.

### Related

- [DISOT architecture](./plan/architecture.md) — global hashes, trust-relative
  human-readable paths, and the signed + timestamped trust requirement.
- [DISOT vision](./plan/vision.md) — the `~/Alice/...` web-of-trust namespace.
- [Evo product materialization — PR #1902](https://github.com/functionalscript/functionalscript/pull/1902)
  — companion TODO for consuming resolved dependency graphs without rewriting
  source objects; link to the PR until its file is present on `main`.
- [`vnd.fjs.revision`](../fjs/media/revision/README.md) — current revision and
  recursive lock-map model; resolution policy is deliberately outside the
  format.
- [`vnd.fjs.lock`](../fjs/media/lock/README.md) — current shared lock-map value;
  the future source/content convention carries naming/resolution metadata in
  root `.disot.*` files in the Git tree.
- [Git trusted timestamp signatures — PR #1903](https://github.com/functionalscript/functionalscript/pull/1903)
  — companion proposal for DID signatures and trusted timestamps inside standard
  Git commits; link to the PR until its file is present on `main`.

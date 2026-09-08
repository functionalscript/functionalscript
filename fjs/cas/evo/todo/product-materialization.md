## Materialize an Evo graph as a self-contained product

**Priority:** P3
**Status:** open

### Problem

Evo revisions identify immutable snapshots and may carry lock data that binds
relative names to immutable snapshot/content hashes, but there is no convention
or operation for turning one resolved Evo object into an ordinary runnable
product.

The target is a self-contained directory tree that conventional runtimes can
consume without knowing anything about CAS, Evo, locks, or custom module
resolution. A root object may depend on other independently versioned objects,
and diamond dependencies may resolve the same name to different immutable
contents.

For example, a JavaScript product rooted at `a` may materialize as:

```text
a/
├── module.f.js
├── b/
│   ├── module.f.js
│   └── d/
│       └── module.f.js
└── c/
    ├── module.f.js
    └── d/
        └── module.f.js
```

where `a -> b -> d` and `a -> c -> d`; the two `d` directories may contain
different snapshots/content if the effective lock scopes resolve them
differently.

### Core invariant: never rewrite source objects

Product generation MUST NOT modify source content.

A source object stored in CAS is materialized byte-for-byte. Resolution changes
which object is placed at a relative path; it never rewrites imports, URLs,
package names, or any other source text. This preserves the source object's CAS
identity in the generated product.

The source format must therefore use references compatible with the product
layout from the beginning, for example:

- ECMAScript / FunctionalScript: `./b/module.f.js`;
- Python packages: package-relative imports such as `from .b.module import x`;
- HTML/CSS: relative URLs.

The product builder may add product infrastructure that is not part of a source
object (for example empty Python `__init__.py` files when required), but it must
not transform a source object itself.

### Resolution and materialization

Starting from one selected Evo revision:

1. Resolve the root revision's `snapshot` to immutable content.
2. Read its lock value, if any. A hash in the outer `lock` field names a shared
   `vnd.fjs.lock` blob; a direct hash inside a lock map selects immutable
   snapshot/content, like `snapshot`, and is **not** an Evo revision hash.
3. Resolve every referenced name according to the resolver's dependency,
   precedence, fallback, and scoped-lock rules. Nested lock maps preserve local
   choices for incompatible diamonds; the materializer consumes the resulting
   path -> immutable-content bindings and does not infer history from a lock
   entry.
4. Materialize every resolved source object at its corresponding path.

Conceptually:

```text
Evo revision + snapshot + lock bindings
                 ↓
          resolved content graph
                 ↓
          directory-tree product
```

The resolver and the product materializer should remain separate. Evo already
stores and exposes lock data without following it; dependency-resolution
semantics belong to the resolver, while materialization consumes the resolved
graph. Revision history may participate in resolver policies such as mutable-head
fallback or ancestry inspection, but a direct lock value itself is always
immutable content, not a revision to traverse.

### Immutable deduplication

The materialized logical tree is independent of its physical-storage
optimization. After resolution, a generic deduplication pass may operate only on
files and directories; it does not need to know about CAS, Evo, subjects, or
locks.

Because products are immutable:

- identical files may be represented as hard links;
- reflinks may be used as a filesystem-specific optimization;
- ordinary copies remain the portability fallback;
- identical complete directory subtrees may be represented as symbolic links
  only when aliasing the subtree is known not to change runtime-visible module
  identity or path semantics.

A directory symlink is **not** a purely physical optimization for every runtime.
For example, Node normally resolves ECMAScript modules through real paths, so two
logical paths symlinked to one subtree can become one module identity and expose
the canonical path through `import.meta.url`. A conventional ECMAScript product
that must preserve distinct logical module URLs therefore must use a non-aliasing
representation (hard-linked/reflinked/copied files in distinct directories)
rather than subtree symlinks.

Even where subtree symlinks are allowed, the complete directory tree must be
identical. Equality of only `module.f.js`, or equality of only a lock object, is
not sufficient.

### Archive product

TAR/pax is the preferred archive representation because it can preserve hard
links and symbolic links. The archive must be self-contained: every link must
resolve within the extracted product and must never reference the external CAS
store.

A conforming extraction on a filesystem with link support should reconstruct the
same sharing relationships. An implementation may define whether unsupported
links are a hard error or fall back to copies. Products whose runtime semantics
require distinct module identities must not introduce subtree symlinks merely
for archive deduplication; hard-linked files preserve the logical paths.

### Web product

The same resolved tree can be published as static URLs.

HTTP redirects can deduplicate identical complete subtrees by mapping multiple
logical URL prefixes to one canonical subtree. Import maps may similarly map
module specifiers to canonical URLs.

Both mechanisms change the effective URL used as the base for relative module
resolution and can also collapse module identity onto the canonical URL.
Therefore an individual non-leaf module must not be redirected or mapped in
isolation unless its dependencies are valid at the canonical location. Whole
identical subtrees are the safe structural unit, but canonicalization is still a
semantic choice: use it only when sharing module identity between those logical
locations is intended.

Web publication should preserve immutable URLs and may use long-lived cache
headers for content-addressed resources.

### Language-independent convention

The core convention is deliberately not JavaScript-specific:

> A product is a materialized snapshot of a resolved graph of independently
> versioned immutable objects. Relative references determine positions in the
> product tree; lock bindings determine which immutable snapshot/content objects
> occupy those positions.

This allows the same Evo/CAS model to produce, without source rewriting:

- FunctionalScript / ECMAScript programs;
- Python packages and programs;
- static websites;
- self-contained filesystem or TAR products.

### Tasks

- [ ] Specify the representation of a resolved dependency graph independently
      of filesystem materialization, with bindings to immutable content rather
      than revisions.
- [ ] Define the relative-name and effective-lock resolution rules needed to
      build that graph from an Evo revision, including the distinction between
      an outer shared-lock hash and direct content hashes inside a lock map.
- [ ] Implement a filesystem materializer that preserves every source object's
      bytes exactly.
- [ ] Add proof coverage for diamond dependencies that resolve the same name to
      both the same and different immutable contents.
- [ ] Add generic immutable-tree deduplication: hard-link identical files and
      allow subtree symlinks only behind an explicit module/path-identity-safe
      policy.
- [ ] Add a self-contained TAR/pax exporter preserving hard links and any
      intentionally present symlinks.
- [ ] Define static-Web publication rules, including whole-subtree redirects,
      module-identity effects, and the relative-URL consequence of
      redirects/import-map mappings.
- [ ] Document language conventions for ECMAScript, Python, and HTML relative
      references without source rewriting.
- [ ] Reference this product-materialization convention from the Evo and lock
      documentation once the resolution rules are defined.

### Related

- [../README.md](../README.md) — Evo API and the current rule that Evo stores and
  reads lock references but does not itself follow them.
- `fjs/media/revision/README.md` — revision snapshots and lock field, including
  the rule that direct lock-map values select immutable content rather than
  revisions.
- `fjs/media/lock/README.md` — lock-map representation.
- `fjs/emergent_testing/todo/65z-singleton-effect.md` — runtime module identity
  consequences of resolving multiple paths to one module.

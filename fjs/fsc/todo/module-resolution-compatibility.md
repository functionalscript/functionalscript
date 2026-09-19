## Preserve module-resolution semantics

**Priority:** P1
**Status:** open

### Problem

A JavaScript module specifier is not a filesystem path.
The original [`transpiler`](../transpiler/module.f.mjs) and
[EDAG linker](../edag/module.f.mjs) joined and normalized filesystem paths. At
`1b4d0218ab93f2abc812b5e79f7fe4cb8d91b3d7`, neither path decodes URL escapes
before filesystem loading. Create three sibling files:

```js
// main.mjs
import value from "./%64ep.mjs";
export default value;
```

```js
// dep.mjs
export default 1;
```

```js
// %64ep.mjs — the filename contains a literal percent sign
export default 2;
```

Native Node ESM resolves the import to `dep.mjs` and returns `1`. The original
filesystem resolver selected the literal `%64ep.mjs`, which contains `2`.
The first implementation slice now percent-decodes UTF-8 URL-path segments
before filesystem normalization in both compiler paths, with the reproducer
pinned in their FJS proofs. The broader identity/package contract below remains
open.

The shared import-record boundary now reports invalid specifiers through
`Result`/`ParseError` in both compiler paths, before dependency loading.
Literal text uses URL scalar-value conversion (a lone surrogate becomes
U+FFFD); percent-encoded bytes still require valid UTF-8. The generic text
decoder does not choose this URL-specific replacement policy.

URL dot-segment processing now happens before percent-decoding or validating
surviving filesystem components. `./bad%/../dep.mjs` names `dep.mjs`, as do
canceled `%ff`, `%2F`, `%5C` and `%00` components. All URL dot spellings are
recognized case-insensitively (`.`, `%2e`, `..`, `.%2e`, `%2e.`, `%2e%2e`).
Empty components survive until dot processing: `bad%//../dep.mjs` still has
an invalid `bad%` component. Double-encoded dots are ordinary filename data,
not another normalization pass.

**Current portable-segment limit:** surviving decoded slashes, backslashes,
NUL and `:` are refused. Literal colons and backslashes remain unsupported
URL syntax and are rejected before dot processing, so cancellation cannot
hide a raw Windows drive or alter the separator grammar.
In particular, `./C%3A/x.f.js` must not turn into `C:/x.f.js` after joining.
Colon-bearing names, including names valid on POSIX, remain unsupported until
host-specific resolution can preserve them without drive/stream reinterpretation.
This is a refusal boundary, not a claim that every host prohibits colons.

**Current URL-syntax limit:** raw `?` and `#` in specifiers are refused before
path splitting or dot processing, including empty query/fragment markers.
For example, `./dep.mjs?x=%64` must not load a file named `dep.mjs?x=d`, and
`./ignored#x=/../dep.mjs` must not collapse to `dep.mjs`. Stripping the suffix
would also be wrong: distinct module identities would share a path-keyed cache.
Supporting those identities remains part of the resolver work below.

To name literal filename characters, percent-encode them in the specifier:
`%3F` for `?`, `%23` for `#`, and `%25` for `%`. Decoding happens once, so a
literal file named `%64ep.mjs` is now imported as `./%2564ep.mjs`, not
`./%64ep.mjs` (which names `dep.mjs`). These filename spellings are distinct
from URL query/fragment syntax; no new filename ban is introduced for `?`/`#`.

### Proposal

Give all compiler paths one module-resolution contract that separates:

```text
source specifier → resolved module identity → filesystem loading location
```

Use the declared host's URL/package rules. Derive module-cache keys from the
same resolved identity. Convert URLs to paths only at the filesystem boundary;
do not add a `%64` replacement or ban this particular filename. Explicitly
refuse unsupported specifier classes rather than reinterpret them as relative
filesystem paths. Host choice is explicit: Node package resolution and browser
import maps are different environments, not interchangeable defaults.

### Current specifier admission

Both compiler paths now share `_importSources`, which classifies original import
strings before decoding, normalizing or loading them. Imports starting with
`./`, `../` or `/` are admitted to host resolution. Bare package
names/subpaths, `#` aliases and scheme-based URLs are explicitly refused until
their host resolution is implemented; they never fall back to sibling files.
This is a resolution restriction, not a JavaScript grammar restriction or a
restriction on CLI input filenames. Package and other URL schemes remain open.

Literal `?` and `#` in a path-like import are also refused by `_importSources`
before percent decoding. They delimit URL query/fragment components, not
filename characters. Stripping them would incorrectly merge module identities;
passing them to the filesystem would load a different file. Percent-encoded
`%3F` and `%23` remain filename characters after decoding (where the filesystem
supports them), and CLI entry paths are unaffected by this refusal.
Query/fragment support remains a separate step: it must retain those components
in module identity while omitting them from the loading path.

### File-module host boundary

Both compiler paths now request `resolveFileModule(name, parent)` for the entry
and its dependencies. `parent: null` means a literal filesystem entry path;
otherwise `name` is the original admitted specifier and `parent` is the resolved
importer identity. The result is `{ id, path }`; the compiler adds the existing
JSON attribute and uses `id` for reuse and cycles, `path` for reads/diagnostics.

The Node runner implements the **default Node file-module profile**: entry
`pathToFileURL`, relative WHATWG URL resolution, `fileURLToPath`, `realpath`, then
`pathToFileURL` for the canonical identity. Symlink targets determine identity
and the base for subsequent imports. This profile always canonicalizes symlinks;
Node's optional preserve-symlinks flags are not a second supported profile.
Bare imports, other schemes, query/fragment components and the existing portable
segment restrictions remain refused. Filesystem proofs exercise that profile in
both compiler paths on Node, Deno and Bun. Only Node's native ESM loader is a
comparison oracle: Deno and Bun have different native resolution/cache semantics.
The common graph traversal also has proofs where identity differs from loading
location.

Each filesystem proof creates its fixtures in a unique temporary directory and
removes that tree in `finally`, including after failures. Literal spaces, `#`
and `%` remain covered without storing those host-only inputs in the repository
or Cloudflare asset manifest. Deno's test tasks grant write permission for this
fixture lifecycle.

The virtual runner retains its explicitly **lexical path profile**. Its fixture
filesystem has no working directory or symlinks; its identities are normalized
portable paths. It is a traversal test host, not evidence of Node URL semantics.
The old decoder is shared in `fjs/path/import`: admission uses its portable
segment check, and the virtual host uses its lexical resolution. The Node host
receives original specifiers and uses its URL implementation.

Custom compiler effect runners must implement `resolveFileModule` as well as
`readFile`. An absent resolver returns a normal `ParseError`; the compiler never
falls back to interpreting an unsupported host's specifiers as paths.

### Tasks

- [x] Separate module identity (`id`) from loading location (`path`) in the
      shared source record and both compiler paths. Reuse, import identity and
      cycle tracking consume `id`; loading and source diagnostics consume `path`.
      The first refactor preserved path-based keys; the host boundary above now
      supplies identities for both CLI roots and imported modules.
- [x] Share a host resolution effect between value compilation and EDAG linking;
      implement canonical file URL identities in the Node profile for entries and
      supported file imports. Keep query/fragment support separate.
- [x] Decode valid UTF-8 percent escapes in relative/file URL-path segments in
      both value compilation and EDAG linking; pin the escaped-filename
      reproducer in both FJS proofs.
- [x] Process raw URL dot segments before decoding/validating the remaining
      components; test canceled invalid components and surviving refusals in
      both compiler paths.
- [x] Refuse unsupported query/fragment syntax before path decoding in both
      compiler paths; preserve percent-encoded filename delimiters and prove
      single decoding, normal diagnostics and no compiler output on refusal.
- [x] Refuse unsupported non-path specifiers through a shared `ParseError`
      result in value compilation and EDAG linking. Prove misleading local
      targets cannot be loaded, raw spelling is classified before decoding,
      and explicit relative controls still work; retain package resolution
      and URL identity as future work.
- [x] Refuse literal query/fragment delimiters before decoding through the shared
      compiler error channel; preserve encoded filename characters. Cover both
      compilation paths, unused imports, misleading files and CLI no-output
      behavior. Actual query/fragment module identities remain future work.
- [x] Add native ESM comparisons for escaped filenames, equivalent
      spellings and diamond sharing in both compiler paths.
- [ ] Extend differential coverage as new specifier classes are supported.
- [ ] Cover equivalent URL spellings, escaped filenames, query/fragment
      identities, relative paths, bare specifiers and module types/import
      attributes. Accepted classes agree with the host; other classes are
      explicitly refused until supported.
- [ ] Check warm/cold caches and repeated imports against the same identity
      rules. Run the repository's required compiler, test and coverage checks.

### Related

- [URL path processing](https://url.spec.whatwg.org/#path-state) — dot segments
  are recognized before percent-decoding filesystem components.

- [Compatibility epic](../../../todo/fjs-javascript-compatibility.md) — the
  P1 invariant; implementation ownership lives here.
- [Node resolution and loading](https://nodejs.org/api/esm.html#resolution-and-loading-algorithm)
  — reference for the Node profile.

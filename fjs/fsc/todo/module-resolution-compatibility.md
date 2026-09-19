## Preserve module-resolution semantics

**Priority:** P1
**Status:** open

### Problem

A JavaScript module specifier is not a filesystem path.
[`transpiler`](../transpiler/module.f.mjs)'s `_importPath` joins and normalizes
filesystem paths; the [EDAG linker](../edag/module.f.mjs) reuses it. At
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
`./`, `../` or `/` continue through the existing path resolver. Bare package
names/subpaths, `#` aliases and scheme-based URLs are explicitly refused until
their host resolution is implemented; they never fall back to sibling files.
This is a resolution restriction, not a JavaScript grammar restriction or a
restriction on CLI input filenames. It does not complete URL identity handling.

Literal `?` and `#` in a path-like import are also refused by `_importSources`
before percent decoding. They delimit URL query/fragment components, not
filename characters. Stripping them would incorrectly merge module identities;
passing them to the filesystem would load a different file. Percent-encoded
`%3F` and `%23` remain filename characters after decoding (where the filesystem
supports them), and CLI entry paths are unaffected. Query/fragment support must
wait for the resolved-identity/loading-location separation, not a suffix-removal
patch. This refusal does not claim that URL identity handling is complete.

### Tasks

- [ ] Specify and share the resolution contract between value compilation and
      EDAG linking, including cache identity and loading boundaries.
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
- [ ] Add the shared differential FJS/native-ESM compatibility harness; the
      current proofs pin the FJS side while Node is the external oracle.
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

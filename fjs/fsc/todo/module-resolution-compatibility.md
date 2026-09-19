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

**Current portable-segment limit:** decoded slashes, backslashes, NUL and `:`
are refused.
In particular, `./C%3A/x.f.js` must not turn into `C:/x.f.js` after joining.
Colon-bearing names, including names valid on POSIX, remain unsupported until
host-specific resolution can preserve them without drive/stream reinterpretation.
This is a refusal boundary, not a claim that every host prohibits colons.

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

### Tasks

- [ ] Specify and share the resolution contract between value compilation and
      EDAG linking, including cache identity and loading boundaries.
- [x] Decode valid UTF-8 percent escapes in relative/file URL-path segments in
      both value compilation and EDAG linking; pin the escaped-filename
      reproducer in both FJS proofs.
- [ ] Add the shared differential FJS/native-ESM compatibility harness; the
      current proofs pin the FJS side while Node is the external oracle.
- [ ] Cover equivalent URL spellings, escaped filenames, query/fragment
      identities, relative paths, bare specifiers and module types/import
      attributes. Accepted classes agree with the host; other classes are
      explicitly refused until supported.
- [ ] Check warm/cold caches and repeated imports against the same identity
      rules. Run the repository's required compiler, test and coverage checks.

### Related

- [Compatibility epic](../../../todo/fjs-javascript-compatibility.md) — the
  P1 invariant; implementation ownership lives here.
- [Node resolution and loading](https://nodejs.org/api/esm.html#resolution-and-loading-algorithm)
  — reference for the Node profile.

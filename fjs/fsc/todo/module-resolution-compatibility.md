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

Native Node ESM resolves the import to `dep.mjs` and returns `1`; the current
filesystem resolution selects the literal `%64ep.mjs`, which contains `2`.
The FJS mismatch is source-inspected, not a claimed completed FJS end-to-end
regression. It violates successful-result agreement even though both paths
can succeed.

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
- [ ] Add the real FJS/native-ESM escaped-filename regression above.
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

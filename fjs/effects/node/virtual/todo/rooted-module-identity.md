## rooted-module-identity. One file reached by `/x` and `x` is two modules

**Priority:** P3
**Status:** open

### Problem

This runner's root is its working directory: `readFile('/lib/d.mjs')` and
`readFile('lib/d.mjs')` read the same stored file. Its module identity does not
agree. `resolveFileModule` answers with
[`lexicalFileModule`](../../module.f.mjs), whose identity is the resolved path
normalized *as written*, leading `/` included, so an import of `/lib/d.mjs`
and one of `./lib/d.mjs` are the identities `/lib/d.mjs` and `lib/d.mjs`. The
compiler's module walk caches a module by its identity, so it loads and
initializes the one file twice, as two modules.

A program sees it as lost sharing. With `lib/d.mjs` holding
`export default {};`, the main module

```js
import a from "./lib/d.mjs";
import b from "/lib/d.mjs";
export default [a, b];
```

compiles to `.js` as `export default [{},{}];`, two objects, where the same
import spelled twice gives `const $0={};export default [$0,$0];`. On a host the
two specifiers name two files, `/lib/d.mjs` at the root of the disk and
`lib/d.mjs` under the working directory, so two identities are right there;
here they name one file, and one identity is.

The compiler's demo page links programs over this runner, and its
[import-linking design](../../../../compiler/todo/import-linking-demo.md) shows
one box for the file and says, under the boxes, that the compiler loads it as
two modules, until this is fixed.

### Proposal

Make a module's identity the path the runner reads it from: drop the leading
`/` of a rooted path before normalizing, since the root is the working
directory, so `/lib/d.mjs` and `lib/d.mjs` are one identity, as they are one
file. `lexicalFileModule` is shared with the SpiderMonkey host, which anchors a
root `name` to its working directory first, so the change belongs to the
virtual host's `resolveFileModule`, or to a parameter of the shared function,
not to the shared rule unconditionally.

Check what depends on the current identities first: a proof or a diagnostic
that prints a rooted identity (`/lib/d.mjs:1:1 - error: …`) would then print
it without its `/`.

### Tasks

- [ ] Give the virtual host's `resolveFileModule` one identity per stored file.
- [ ] Prove that `./lib/d.mjs` and `/lib/d.mjs` link as one module, shared in
      the compiler's `.js` output.
- [ ] Re-run the suite for proofs and diagnostics that print a rooted identity.
- [ ] Drop the compiler demo's note about two modules for one file.

### Related

- [lexical-path-resolution](./lexical-path-resolution.md) — the other gap
  between a path as this runner spells it and the file it names.
- [import-linking-demo](../../../../compiler/todo/import-linking-demo.md) — the
  page that shows the lost sharing, and says so.

# Namespace Import

**Priority:** P1
**Status:** open

## Runtime namespaces

Implement JavaScript namespace imports for runtime exports:

```js
import * as A from "./a.f.js";
export default A.default;
```

This is planned syntax, not a claim that the current compiler supports it.
Preserve JavaScript's module-namespace and dependency semantics; a namespace
is not a substitute for a type-only import or an arbitrary plain object.

## Types are tooling, not runtime imports

The former plan to accept and erase `import type` and `export type` is
withdrawn. It violates the [original-source compatibility rule](../README.md#principles).
FunctionalScript has no TypeScript source dialect or type-stripping mode;
the [language roadmap](./README.md#typescript-boundary) records this boundary
for all constructs, not just imports.

Use JSDoc for type references in JavaScript. This module has no runtime import:

```js
/** @type {import("./types.ts").Value} */
const value = [5];
export default value;
```

A separate `types.ts` companion can define `Value` for the external TypeScript
checker; it is not FunctionalScript source and is not a runtime dependency:

```ts
export type Value = readonly [number];
```

Both JavaScript's JSDoc references and TypeScript's `import type` declarations
name the same real `types.ts` source file, following the
[shared module policy](../../fjs/fsc/README.md). Do not introduce a `types.js`
runtime module or rely on extension substitution for these source references.
FJS treats the JSDoc as a comment; it neither loads that companion nor gains a
TypeScript grammar.
Do not erase a real JavaScript import because its binding is mentioned only in
an annotation: the import still has JavaScript dependency semantics.

## Tasks

- [x] **P1:** withdraw TypeScript-only import/export syntax and the erasure path;
      keep ordinary namespace imports separate from comment-only type references.
- [ ] Implement runtime namespace imports through the JavaScript-subset AST and
      checked EDAG compilation, preserving admitted module observations.
- [ ] Extend the source-compatibility corpus with TypeScript-only syntax
      refusals and JSDoc/type-companion examples. Check original module source
      without a type stripper; keep type-tooling checks separate from FJS tests.
      Verify both JSDoc and TypeScript type references against the actual
      `types.ts` companion without a `types.js` file; incorrect values must
      fail checking, while the JavaScript runs without the companion.

## Related

- [Import](../README.md#importing-other-modules).
- [Named imports](../README.md#importing-other-modules) — implemented selection of
  exported bindings; namespace imports are not its prerequisite.
- [Standard type annotations](../../todo/blocked/js-extension-type-annotations.md)
  — blocked until ECMAScript standardizes the syntax and declared runtimes support it.
- [ECMAScript namespace imports](https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#prod-NameSpaceImport).

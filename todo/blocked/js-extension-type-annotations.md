## Reconsider standardized type annotations

**Priority:** P3
**Status:** blocked
**Blocked by:** ECMAScript standardization and runtime support

### Problem

FunctionalScript accepts JavaScript source, not TypeScript source repaired by
stripping or transpilation. Inline type syntax is outside the active language
plan. The [roadmap's TypeScript boundary](../../spec/todo/README.md#typescript-boundary)
applies now; this blocked task neither directs nor blocks current development.

The earlier `.f.ts`-to-`.f.js` migration premise is obsolete: JSDoc comments
and external type companions already allow JavaScript to be checked without
putting TypeScript-only syntax in its runtime source. This is no longer a
filename-migration task. TypeScript checking and declaration tooling remain
independent of FJS syntax admission.

### Trigger

The relevant TC39 type-annotation syntax reaches Stage 4 and is incorporated
into ECMAScript, and the declared execution environment accepts the unchanged
JavaScript module source with the standardized erased/ignored-type semantics.
A Node, Deno or Bun TypeScript loader, a stripping flag, or a TypeScript emit
option alone does not satisfy this trigger.

Then propose a supported subset of that exact standard syntax and move the
implementation work out of `todo/blocked/`. This is not automatic approval of
TypeScript as a whole: each type import/export, assertion or declaration form
must actually be standardized and compatible before FJS may admit it.
No FJS-specific preprocessing exception is authorized.

### Related

- [TC39 Type Annotations](https://github.com/tc39/proposal-type-annotations).
- [Namespace imports](../../spec/todo/2220-namespace-import.md) — runtime
  namespaces and JavaScript-valid JSDoc type references are separate.
- [RTTI comment annotations](../../spec/todo/3360-type-annotations.md) — an
  independent JavaScript-comment design, not blocked on this proposal.
- [new-pl.md § Type Annotations](../new-pl.md#type-annotations) — separate-language
  research, not a definition of current FunctionalScript syntax.

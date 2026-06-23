# Switch back to `.js` extension when Type Annotations lands

**Priority:** P3
**Status:** blocked

### Problem

FunctionalScript modules use the `.f.ts` extension because TypeScript requires it to apply
type checking. If ECMAScript natively supports type annotations, `.f.ts` could revert to
`.f.js`, removing the TypeScript build dependency for type-annotated modules.

### Trigger

Unblocked when the TC39 Type Annotations proposal reaches Stage 4 and TypeScript supports
emitting `.js` files with inline type annotations that engines ignore.

### Related

- https://github.com/tc39/proposal-type-annotations

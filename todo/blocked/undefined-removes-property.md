# Assigning `undefined` to a property removes it

**Priority:** P3
**Status:** blocked

### Problem

In JavaScript, `{ a: undefined }` creates an object with an `a` key present but `undefined`.
FunctionalScript's purely functional model would benefit from `undefined` meaning absence, so
`{ a: undefined }` is equivalent to `{}`.

### Trigger

Most likely, ECMAScript would never fix it because of compatibility reasons.

### Related

- [new-pl.md § Assigning](../new-pl.md#assigning) — a from-scratch PL isn't bound by ECMAScript's compatibility constraint and adopts the behavior directly.

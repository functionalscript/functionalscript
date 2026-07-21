# Assigning `undefined` to a property removes it

**Priority:** P3
**Status:** blocked

### Problem

In JavaScript, `{ a: undefined }` creates an object with an `a` key present but `undefined`.
FunctionalScript's purely functional model would benefit from `undefined` meaning absence, so
`{ a: undefined }` is equivalent to `{}`.

### Trigger

Unblocked when ECMAScript specifies that assigning `undefined` to an object property removes the key, or a TC39 proposal reaches Stage 4 providing this semantics.

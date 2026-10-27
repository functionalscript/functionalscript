## Error fields without `in`

**Priority:** P3
**Status:** open

### Problem

`fields` in [`../module.f.mjs`](../module.f.mjs) asks
`'message' in value || 'stack' in value` before reading an error's fields.
The compiler refuses `in` by design
([2346](../../../../spec/todo/2346-in-operator.md)), so the module stops
there once its other refusals are gone.

`hasEntry` is not a replacement: an `Error`'s `message` and `stack` are own
but non-enumerable, so `hasEntry` answers `false` for every real error and
the reporter would describe each one by its text alone. The question is about
a host value, not FunctionalScript data, and the module comment notes that
asking it consults a proxy as reading does.

### Proposal

State what the code wants to know: whether reading the fields gives anything.
Read `message` and `stack` once and test the values for `undefined`, which
keeps one user-observable attempt per field and needs no presence test; or
move `fields` into a host `.mjs` adapter, since it inspects host objects.

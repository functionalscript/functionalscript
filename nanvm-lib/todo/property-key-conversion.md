## property-key-conversion. A property key that is not a number or a string is not converted

**Priority:** P3
**Status:** open

### Problem

`Object::member_access` answers `undefined` for a key that is neither a
number nor a string. JavaScript converts the key with `ToPropertyKey`, so
`o[{}]` reads `o["[object Object]"]`, and `o[f]` for a function reads the
property named by the function's text. It is the conversion
[to-primitive.md](./to-primitive.md) implements, at a different entry.

### Proposal

Convert a key through `ToPrimitive` with the string hint, then `ToString`,
before the lookup, refusing what `ToPrimitive` refuses. Add corpus cases for
an object key, an array key and a function key.

### Tasks

- [ ] `ToPropertyKey` in member access, with unit tests and corpus cases.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`, `fjs test`.

### Related

- [to-primitive.md](./to-primitive.md): Related, not covered here.
- [member-functions.md](./member-functions.md): the `Function` checklist's
  last item.

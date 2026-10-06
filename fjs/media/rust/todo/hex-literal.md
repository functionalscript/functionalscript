## hex-literal. A zero-padded `0x` literal is spelled three times

**Priority:** P5
**Status:** open

### Problem

Three exports of [`module.f.mjs`](../module.f.mjs) render a number as a
Rust hexadecimal literal, each with its own `toString(16).padStart`, and
two of them wrap the result in a Rust slice literal, each with its own
`&[…]` and `join(', ')`:

```js
// utf16Literal
`&[${[...Array(v.length).keys()].map(i => `0x${v.charCodeAt(i).toString(16).padStart(4, '0')}`).join(', ')}]`
// f64Bits
`0x${bitsOf(v).toString(16).padStart(16, '0')}`
// u64Words
`&[${words(a).map(w => `0x${w.toString(16).padStart(16, '0')}`).join(', ')}]`
```

### Proposal

Two locals, `hexLiteral(digits)(n)` and `sliceLiteral(items)`; the three
exports become one line each and share one spelling rule.

### Tasks

- [ ] The two locals; the exports through them.
- [ ] `tsc`, `fjs test`, `npm run gen` leaves the generated Rust
      unchanged.

### Related

- [let-bindings-owner](../../../edag/rust/todo/let-bindings-owner.md) —
  the other Rust-text owner question, one layer up.

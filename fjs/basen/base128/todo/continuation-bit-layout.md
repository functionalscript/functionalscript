## continuation-bit-layout. Name the continuation-bit layout once for the encode/decode pair

**Priority:** P4
**Status:** open

### Problem

`base128`'s varint layout — 7 payload bits, `0x80` continuation flag — is
hardcoded in both halves of an exact-inverse pair, five literals with no name
and no comment tying them together:

```js
// fjs/basen/base128/module.f.mjs:25-28 (encode)
const item = uint & 0x7Fn
const flag = result === empty ? 0n : 0x80n
...
uint >>= 7n

// fjs/basen/base128/module.f.mjs:45-47 (decode)
result = (result << 7n) | (byte & 0x7Fn)
if (byte < 0x80n) { return [result, rest] }
```

`encode` and `decode` must agree bit-for-bit, but nothing states the layout
they agree on. This is the same shape as the accepted
`fjs/text/utf8/todo/error-tag-layout-constants.md` — two exact-inverse
functions sharing an unnamed bit layout.

### Proposal

```js
// One statement of the layout, at module top:
const payloadBits = 7n
const payloadMask = 0x7fn          // mask(payloadBits)
const continuationFlag = 0x80n     // 1n << payloadBits
```

Express both functions through the names. Pure rename — the emitted bytes are
unchanged.

### Tasks

- [ ] Add the three constants with a doc comment stating the varint layout;
      rewrite `encode`/`decode` through them.
- [ ] `npx tsc`, `fjs t` — base128 proofs pass unchanged.

### Related

- `fjs/text/utf8/todo/error-tag-layout-constants.md` — the precedent.
- `fjs/basen/todo/basen-padding-strategy.md` — explicitly leaves `base128`
  out of scope; no overlap.

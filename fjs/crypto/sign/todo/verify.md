## `verify`: ECDSA signature verification

**Priority:** P3
**Status:** wip

### Problem

[`fjs/crypto/sign`](../module.f.mjs) exports `sign`, which produces an RFC 6979
deterministic ECDSA `(r, s)` pair, but nothing checks one. The module's
[README](../README.md) writes out the verification equations, yet no code
implements them, so a consumer that receives a signature — a demo, a Git
signed-object reader — has no way to accept or refuse it.

### Proposal

Export `verify` from the same module, shaped like `sign`:

```js
/** @type {(c: Curve) => (hf: Sha2) => (u: Point) => (m: Vec) => (sig: _Signature) => boolean} */
```

`u` is the public key `xG`. `verify` refuses `r` or `s` outside `[1, q-1]`,
then computes `h = bits2int(H(m)) mod q`, `w = 1/s`, `X = (h·w)G + (r·w)U`,
and accepts when `X` is not the point at infinity and `X.x mod q = r`.

`sign` and `verify` share the message-to-integer step, so it becomes one
private helper rather than two copies.

### Tasks

- [ ] `verify` in `module.f.mjs`, with its proof: a sign-then-verify round trip
      over the RFC 6979 A.2 vectors, and refusals of a tampered message, a
      tampered `r` or `s`, the wrong public key, and `r` or `s` out of range.
- [ ] A website demo of signing and verifying.

## `sign`: select a new `k` when `r` or `s` is zero

**Priority:** P3
**Status:** open

### Problem

RFC 6979 §2.4 calls a signature with `r = 0` or `s = 0` invalid, and has the
signer select a new `k`. `sign` in [`fjs/crypto/sign`](../module.f.mjs) does
not select again: it refuses with an assertion, `r === 0` or `s === 0`. A
valid request then aborts instead of returning a signature.

On the named curves either case has probability about 2⁻¹²⁸. On small curves
they are reachable, and the `sign` proof's `throw` tests name two:

- `r = 0`: `y² = x³ + x + 1` over 7, `G = (0, 1)`, `n = 5`, private key `1`,
  SHA-256, message `"0"` — the first `k` gives `kG = G`, whose `x` is `0`.
- `s = 0`: `y² = x³ + x + 4` over 7, `G = (4, 3)`, `n = 5`, private key `1`,
  SHA-256, message `"14"` — `h + x·r = 0 mod n`.

### Proposal

RFC 6979 §3.2 step h.3 already describes selecting again: `K = HMAC_K(V ||
0x00)`, `V = HMAC_K(V)`, and generate the next candidate `k`.
`computeKFromDigest` runs that loop for a `k` outside `[1, q-1]`; it needs to
continue it for a `k` whose `r` or `s` is zero as well, as the `TODO` in
`sign` notes: a validity predicate passed in, or the generator's state
returned so `sign` can resume it.

### Tasks

- [ ] `sign` selects a new `k` for a zero `r` or `s`; the two inputs above
      sign instead of throwing, and their signatures verify.

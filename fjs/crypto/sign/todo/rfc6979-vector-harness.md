## rfc6979-vector-harness. The RFC 6979 test-vector walker is written twice in `proof.f.mjs`

**Priority:** P4
**Status:** open

### Problem

`fjs/crypto/sign/proof.f.mjs` carries the "two messages × four SHA-2 variants"
vector harness twice — `a2` (`:127-153`) checks the deterministic `k`, `a2s`
(`:369-410`) checks full `{k, r, s}` signatures — with identical structure:

```js
// :137-152 (a2)                                  // :385-401 (a2s)
const check = ({ q, x, msg0, msg1 }) => {         const check = ({ q, x, msg0, msg1 }) => {
    const a = all(q)                                  const a = all(q.nf.p)   // <-- not fromCurve
    const check = (sha, expected, m) => { ... }       const check = (sha, { k, r, s }, m) => { ... }
    const check4 = (m, h) => {                        const check4 = (m, h) => {
        check(sha224, h[0], m)                            check(sha224, h[0], m)
        check(sha256, h[1], m)                            check(sha256, h[1], m)
        check(sha384, h[2], m)                            check(sha384, h[2], m)
        check(sha512, h[3], m)                            check(sha512, h[3], m)
    }                                                 }
    check4(sample, msg0)                              check4(sample, msg0)
    check4(test, msg1)                                check4(test, msg1)
}                                                 }
```

Only the per-`(sha, expected, message)` assertion body differs. Adding a curve
or hash variant means editing two nested walkers that must stay in sync.

`a2s`'s `all(q.nf.p)` (`:386`) is also a third site of the `fromCurve` bypass
that `fjs/crypto/todo/666-crypto-sign-fromcurve.md` files for
`sign/module.f.mjs` — the proof re-derives the RFC 6979 helpers from the raw
prime instead of the curve.

### Proposal

One vector driver, parameterized by the assertion:

```js
/** @type {(assert: (a: _All) => (sha: Sha2, expected: _E, m: Vec) => void)
 *  => (v: _Vector) => void} */
const forEachVector = assert => ({ q, x, msg0, msg1 }) => {
    const check = assert(all(q))
    const check4 = (m, h) => { check(sha224, h[0], m); check(sha256, h[1], m); ... }
    check4(sample, msg0)
    check4(test, msg1)
}
```

`a2` and `a2s` each supply only their assertion body; `:386` becomes `all(q)`
(or `fromCurve(q)` once 666-crypto-sign-fromcurve lands).

### Tasks

- [ ] Extract the shared driver; rewrite `a2` and `a2s` through it.
- [ ] Replace `all(q.nf.p)` with the curve-based call.
- [ ] `fjs t` — the sign proofs pass unchanged.

### Related

- `fjs/crypto/todo/666-crypto-sign-fromcurve.md` — the module-side bypass;
  this issue adds the proof-side site.

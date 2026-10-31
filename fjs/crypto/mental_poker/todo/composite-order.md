## Refuse a secret with no inverse mod a composite order

**Priority:** P4
**Status:** open

### Problem

`mentalPoker(c).key(secret)` admits any `secret` in `1..n-1`, where `n` is the
curve's order, and builds `unlock` from `secret`'s inverse mod `n`. Every named
curve has a prime `n`, where each such `secret` has an inverse. The generic
`curve` constructor in `fjs/crypto/secp` accepts a composite `n` too: with
`n = 4`, `key(2n)` reaches `reciprocal(2n)`, and 2 has no inverse mod 4, so
it throws a `RangeError` instead of returning `null`.

The JSDoc of `mentalPoker` states the contract: `n` must be prime. This issue
is for the input that breaks it, so that it is refused rather than thrown on.

### Proposal

`key` returns `null` for a `secret` whose greatest common divisor with `n` is
not 1, which on a prime `n` is no `secret` in `1..n-1`. The repository has no
`gcd` yet; one belongs in `fjs/types/bigint`.

### Related

- [mental-poker.md](../../todo/mental-poker.md) — the game this module is the first step of
- [functionalscript/functionalscript#3458](https://github.com/functionalscript/functionalscript/pull/3458#discussion_r4432414941) — the review that found the input

# `randomInt` is not cryptographically secure

`randomInt` of `fjs/effects/node/types.ts` answers an integer from 0 up to, not
including, 2^32. The Node runner answers it with `crypto.randomInt(2 ** 32)`,
which is cryptographically secure. This host does not.

## What this host does

Rust's `std` has no public function that answers random numbers. It does seed
`std::hash::RandomState`, the hasher behind `HashMap`, from the operating
system. `common::random_int` builds a new `RandomState` for every call, hashes
nothing with it, and takes the top 32 bits of the result:

```rust
(RandomState::new().build_hasher().finish() >> 32) as u32
```

The operating system seeds the keys of a `RandomState` once per thread, and each
`RandomState::new()` after the first adds one to a counter in them. So every call
hashes under a different key, and the answers vary and are spread evenly enough
for anything that wants a number picked at random.

## What it does not promise

- **No cryptographic strength.** `std` documents `RandomState` as protection
  against hash-flooding, not as a source of secrets. The key of the next call
  follows from the key of this one by adding one, so a program that sees the
  answers can recover the hasher's state and predict later answers. Do not derive
  a key, a token, a nonce or a password from `randomInt` on this host.
- **No guarantee across Rust versions.** What `std` does inside `RandomState` is
  its own business, and may change.
- **No numbers at all on `wasm32-unknown-unknown`.** That target has no source of
  randomness, and `std` seeds `RandomState` there with a constant, so every run
  would answer the same numbers. The host refuses `randomInt` there as not
  implemented (`['error', ['notImplemented', 'randomInt']]`) rather than answer
  numbers that look random and are not. WASI targets have a source, and answer.

## Why not a crate

A source with cryptographic strength, such as the `getrandom` crate, would be a
dependency for a guarantee the contract does not ask for: `RandomInt` is
`() => number`, and its users in this repository want a number, not a secret. If
a program needs a secret from this host, add that source then and change
`random_u32` in `src/common.rs`; nothing else reads it.

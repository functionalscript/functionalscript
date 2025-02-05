# Elliptic Curves

## Discrete Logarithm Problem

We have a [monoid](https://en.wikipedia.org/wiki/Monoid) on the finite set `S` with an operation `*` and an identity `O`. We can apply the operation `*` `N` times on any object `s` from `S` using only `O(log(N))` calls by using the [exponentiation by squaring](https://en.wikipedia.org/wiki/Exponentiation_by_squaring) algorithm. At the same time, if some one knows `s` and `s^N` but doesn't know `N`, it's very hard to find `N` for some monoids, for example for [elliptic curves](https://en.wikipedia.org/wiki/Elliptic-curve_cryptography). For `N ~ 2^256` we need about `256` operations, so `N` can be too big to find for a brute force algorithm.

See also [discrete logarithm](https://en.wikipedia.org/wiki/Discrete_logarithm).

If the `monoid` allows to find `M` from `N` such that `a^(N*M) = a` then we can build a commutative encryption `((a^N)^S)^M=a^S`

## Benchmarks

```
Bun:
    192r1: 2273
    256k1: 4695
    256r1: 4647
Deno2:
    192r1: 1946
    256k1: 3834
    256r1: 3796
Deno1:
    192r1: 1902
    256k1: 3776
    256r1: 3700
Node23:
    192r1: 2316
    256k1: 4656
    256r1: 4525
Node16:
    192r1: 2976
    256k1: 5839
    256r1: 5746
```

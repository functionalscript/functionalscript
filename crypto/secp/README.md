# Elliptic Curves

## Discrete Logarithm Problem

We have a [monoid](https://en.wikipedia.org/wiki/Monoid) on the finite set `S` with an operation `*` and an identity `O`. We can apply the operation `*` `N` times on any object `s` from `S` using only `O(log(N))` operations by using the [exponentiation by squaring](https://en.wikipedia.org/wiki/Exponentiation_by_squaring) algorithm. At the same time, if some one knows `s` and `s^N` but doesn't know `N`, it's very hard to find `N` for some monoids, for example for [elliptic curves](https://en.wikipedia.org/wiki/Elliptic-curve_cryptography). For `N ~ 2^256` we need about `256` operations to compute `s^N`, but we need about `2^256` operations to find `N` from `s^N` using a brute force algorithm. This's is called a discrete logarithm problem. See [discrete logarithm](https://en.wikipedia.org/wiki/Discrete_logarithm).

If the `monoid` allows to find `M` from `N` such that `a^(N*M) = a` then we can build a commutative encryption `((a^N)^S)^M=a^S`.

## Elliptic Curves

Operation mapping:

|elliptic curves                                          |DLP and monoid                                    |
|---------------------------------------------------------|--------------------------------------------------|
|`a + b`, add two points, `a+b = b+a`, `(a+b)+c = a+(b+c)`|`a * b`, multiplication                           |
|`O`, a point on infinity. `a + O = O + a = a`            |`O`, an identity                                  |
|`a * n`, scalar multiplication                           |`a ^ n`, exponent (using the fast exponent method)|
|find `n` for specific `a` and `b`, such that `a * n = b` |`n = log(a, a ^ n)`                               |
|for any `n` there is `k = 1/n` such that `a * n * k = a` |`a ^ n ^ k = a`                                   |

The scalar multiplier `n` is defined on a prime `N` field. We can `k` such that `(k * n)%N = 1`. The function that returns `/n` is called `reciprocal`, see [../prime_field/module.f.ts](../prime_field/module.f.ts#L35) and it uses [Euclidean division](https://en.wikipedia.org/wiki/Euclidean_division).

`G` is a base point on the elliptic curve. It has `x` and `y`, or a compressed representation has `x` and a boolean.

## Private And Public Keys

A private key `d` is a random number in the range `(0; n)`.

A public key is a point on a curve `Q = G * d`.

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

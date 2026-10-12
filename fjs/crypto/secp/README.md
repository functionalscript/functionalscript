# Elliptic Curves

## Discrete Logarithm Problem

We have a [monoid](https://en.wikipedia.org/wiki/Monoid) on the finite set `S` with an operation `*` and an identity `O`. We can apply the operation `*` `N` times on any object `s` from `S` using only `O(log(N))` operations by using the [exponentiation by squaring](https://en.wikipedia.org/wiki/Exponentiation_by_squaring) algorithm. At the same time, if some one knows `s` and `s^N` but doesn't know `N`, it's very hard to find `N` for some monoids, for example for [elliptic curves](https://en.wikipedia.org/wiki/Elliptic-curve_cryptography). For `N ~ 2^256` we need about `256` operations to compute `s^N`, but we need about `2^256` operations to find `N` from `s^N` using a brute force algorithm. This's is called a discrete logarithm problem (DLP for short). See [discrete logarithm](https://en.wikipedia.org/wiki/Discrete_logarithm).

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

The scalar multiplier `n` is defined on a prime `N` field. We can `k` such that `(k * n)%N = 1`. The function that returns `1/n` is called `reciprocal`, see [`fjs/types/prime_field`](../../types/prime_field/module.f.mjs) and it uses [Euclidean division](https://en.wikipedia.org/wiki/Euclidean_division).

`G` is a base point on the elliptic curve. It has `x` and `y`, or a compressed representation has `x` and a boolean.

## Private And Public Keys

A private key `d` is a random number in the range `(0; n)`.

A public key is a point on a curve `Q = G * d`.

A public key received from elsewhere is only a pair of numbers until
`isPublicKey` validates it (SEC 1 §3.2.2.1): not the point at infinity,
coordinates in `[0, p-1]`, on the curve, and `Q * n = O`. The curve formulas
compute over any pair, but only these give results that mean anything.

`Q * n = O` puts `Q` in the subgroup `G` generates only if no other point of
order `n` exists. For a prime `n`, as ECDSA requires, that holds when
`n^2 > p + 1 + 2√p`, which bounds the number of points on the curve (Hasse);
a composite `n` gives no such guarantee, and is not tested for. Every named
curve here has a prime `n` and cofactor 1, and meets the bound; `isPublicKey`
refuses every key on a curve that does not.

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

## Elliptic Curve Playground

The module page discovers `demo.f.mjs` automatically. Build with
`npm run website`, serve the repository root, and open `/fjs/crypto/secp/`.

- **Finite Field View** plots all 28 finite points of
  `y² = x³ + x + 4 mod 23`. Select addition, doubling, negation, or `kG`;
  use the grid or point selectors, then Previous/Next or Play/Pause.
  The inline P/Q radios choose which input a graph click sets.
  The default `3G` is `(11,9)`. Scalars 0 and 29 illustrate infinity, which
  is `null` in the module and has no plotted coordinates. Show Math explains
  substituted modular calculations and each repeated-addition frame.
- **Geometric View** uses the distinct real curve `y² = x³ − x + 1`.
  Drag inputs horizontally along their branch or use the sliders and branch
  radios (Upper/Lower). Step through secant/tangent, third intersection, and reflection.
  Vertical lines give infinity; unstable constructions are refused and
  off-screen results are reported rather than squeezed into the graph.
  This is an analogy, not a continuous picture of finite-field arithmetic.
- **Real Curves** derives and SEC 1 validates `dG` for all five named curves.
  Enter a demo-only decimal scalar in `1 ≤ d < n`, then Generate Public Key
  and copy the padded hexadecimal coordinates. Everything stays client-side;
  never enter real wallet keys or private secrets.

Input changes reset playback. Reduced-motion preferences disable automatic
playback while preserving manual steps. SVG point controls have keyboard and
native selector equivalents; geometry sliders support keyboard and touch input.
The pure calculation helpers and their proofs live in [`website/demo/secp`](../../website/demo/secp/); the
shared website runtime owns DOM events, pointer capture, and delayed turns.

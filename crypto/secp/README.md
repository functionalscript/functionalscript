# Elliptic Curves

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

## Mental Poker

Notes:

1. users should NOT know a multiplier between different cards. For example, if a user know that a card # `0` multiplied by a number `N` becomes a card # `1` then they can find a card number # `1`.

See also https://github.com/kripod/mental-poker/blob/master/specs/thesis.pdf

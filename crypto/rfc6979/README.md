# RFC 6979. Deterministic Usage of the Digital Signature Algorithm (DSA) and Elliptic Curve Digital Signature Algorithm (ECDSA)

https://www.rfc-editor.org/rfc/rfc6979

## 1. Introduction

- `k` - a fresh random value for signature generation.

### 2.1. Key Parameters

- `E` - an elliptic curve.
- `q` - a sufficiently large prime number that is divisor of the curve.
- `G` - a point of `E`, of order `q`. `G` is such that `qG = 0`.

Compute `jG`, where `j` ranges from `0` to `q-1`.

### 2.2. Key Pairs

- `x` is a private key taken module `q`. `x` shall not be `0`; hence `x` is an integer in the range `[1, q-1]`.
- `U` is a public key. `U = xG`.

### 2.3. Integer Conversion

- `qlen` is the binary length of `q`.
- `rlen` is equal to `qlen`, rounded up to the next multiple of `8`. See `roundUp8` function. Unrelated to `r`.
- `blen` is the length (in bits) of an input sequence.

#### 2.3.1. Bits and Octets

MSB first.

#### 2.3.2. Bit String to Integer

The `bits2int` transform takes as input a sequence of `blen` bits and outputs a non-negative integer that is less than `2^qlen`. An alternative name is `vec2Uint`.

```ts
const bits2int: (qlen: bigint) => (b: Vec) => bigint
```

#### 2.3.3. Integer to Octet String

```ts
const int2octets: (qlen: bigint) => (x: bigint) => Vec
```

#### 2.3.4. Bit String to Octet String

```ts
const bits2octets: (q: bigint) => (b: Vec) => Vec
```

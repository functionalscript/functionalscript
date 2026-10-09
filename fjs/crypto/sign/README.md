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

### 2.4. Signature Generation

- `H` is a cryptographic hash function, which returns a bit vector of length `hlen`.
- `m` is an input message. `H(m)`.

1. `h = bits2int(H(m)) mod q`.
2. `k` is a random value module `q`. It shall not be `0`.
3. `r = (kG).x mod q`: the `X` coordinate of `kG` (a member of the field over which `E` is defined), reduced modulo `q`.
   If `r` is `0`, select new `k`.
4. `s = (h+x*r)/k mod q`

The pair `(r, s)` is the signature.

## 3. Deterministic ECDSA

### 3.1. Building Blocks

#### 3.1.1. HMAC

`HMAC_K(V)` is `HMAC` with the key `K` over data `V`, which returns a sequence of bits of length `hlen`.

### 3.2. Generation of `k`

a. `h1 = H(m)`
b. `V = 0x01 0x01 ... 0x01` such that the length of `V` is equal to `8*ceil(hlen/8)`.
c. `K = 0x00 0x00 ... 0x00` such that the length of K, in bits, is equal to `8*ceil(hlen/8)`.
d. `K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1))`.
e. `V = HMAC_K(V)`.
h. Apply the following algorithm until a proper value is for `k`:
   1. Set `T` to the empty sequence, so `tlen = 0`.
   2. while `tlen < qlen` do:
      - `V = HMAC_K(V)`
      - `T = T || V`
   3. Compute `k = bits2int(T)`. If `k` is not in `[1, q-1]` or `kG = 0` then
      - `K = HMAC_K(V || 0x00)`
      - `V = HMAC_K(V)`
      and loop (try to generate a new `T`, and so on). Return to step `1`.

## Digital Signature

We use elliptic curves for digital signatures.

`z` is a hash of a message.

`k` is a unique for each `z` and secret.

`R = G * k`.

`r = R.x mod q`.

`s = ((z + r * d) / k) mod q`.

If `r` or `s` is `0`, the signature is invalid and `k` must be selected again;
`sign` does not select again yet, and refuses instead.

The signature is `(r, s)`.

### Verifying a signature

`verify` checks `(r, s)` against the public key `Q = G * d`. All arithmetic on
scalars is modulo `q`.

1. If `Q` is not a valid public key, or `r` or `s` is not in `[1, q-1]`, the
   signature is invalid. A valid public key is not the point at infinity, has
   coordinates in `[0, p-1]`, lies on the curve, and satisfies `Q * q = 0`
   (SEC 1 §3.2.2.1, `isPublicKey` in `../secp`, which also requires
   `q^2 > p + 1 + 2√p`, so that `Q * q = 0` puts `Q` in the subgroup of `G`).
2. `w = 1/s`
3. `u1 = z * w` and `u2 = r * w`
4. `X = G * u1 + Q * u2`
5. If `X` is the point at infinity, the signature is invalid: it has no `x`.
6. `v = X.x mod q`

The signature is valid if `v = r`.

### Proof

1. `X = G * (z * 1/s) + Q * (r * 1/s)`
2. `X = G * z * 1/s + G * d * r * 1/s`
3. `G * z * 1/s + d * r * 1/s = G * k`
4. `z * 1/s + d * r * 1/s) = k`
5. `z + d * r = k * s`
6. `z + d * r = k * (z + r * d) / k`
7. `z + d * r = z + r * d`

# SUL Id

## Motivation

Literal alphabet sizes grow via **tetration** (iterated exponentiation). Starting from $n_0 = 2$:

| Level | Alphabet size $n$ |
|-------|-------------------|
| 0 | $2$ |
| 1 | $5$ |
| 2 | $129$ |
| 3 | $\approx 2^{136}$ |
| 4 | $\approx 2^{2^{136}}$ |

Level 4 alone would require $\approx 2^{136}$ bits just to index a single symbol — far beyond any practical storage or computation.

This module sidesteps that explosion by giving every value a fixed-size **256-bit identifier**, regardless of how deeply nested or large the underlying data is. Two identifiers are merged into a single new identifier; the result can itself be used as an input to the next merge. This enables:

- **Content-addressed storage**: the identifier of a value is determined solely by its content.
- **Unbounded recursion**: any pair of 256-bit identifiers can be combined into a new 256-bit identifier.
- **Compact references**: large or frequently-repeated sub-trees are referenced by identifier rather than inlined.

## Symbol Structure

Every value is a 256-bit unsigned integer. The top bits form a discriminator prefix:

| Prefix bits | Value (bits) | Meaning                                           |
|-------------|--------------|---------------------------------------------------|
| `00`        | 254          | Level 3 literal symbol (inline, no prefix needed) |
| `01`        | 254          | Raw bit vector, up to 253 bits of payload         |
| `1`         | 255          | 255-bit SHA2 hash                                 |

### Level 3 Symbol (`00…`)

A Level 3 literal symbol fits entirely below $2^{254}$, so no prefix bits need to be added — the identity function is the encoding. There are $f(f(f(2))) = 2^{136}+1$ possible Level 3 symbols, all well within this range.

### Raw Bit Vector (`01…`)

A raw vector encodes an arbitrary bit sequence of at most 253 bits inline. The layout within the 256-bit value is:

| bit 255 | bit 254 | bits 253…0                            |
|---------|---------|---------------------------------------|
| `0`     | `1`     | sentinel `1` followed by payload bits |

The sentinel `1` bit at position equal to the payload length encodes the length implicitly. Maximum payload length is 253 bits.

### Hash (`1…`)

A hash identifier has bit 255 always set to `1`, leaving 255 bits of hash data. It is produced by the SHA2-based merge:

```
hashId(a, b) = (2^255) | SHA2_compress(IV, a ∥ b)
```

where `a ∥ b` is the 512-bit concatenation of two 256-bit values.

The merge is applied whenever inline storage would exceed 253 bits or when either input is already a hash.

## Initial Vector (IV)

```
325d5666_573eb118_f32191de_20d17f64_33392ba3_291ae46c_1474a5ed_a5383f25
```

This is the x-coordinate of a point on **secp256r1** (NIST P-256), used as the IV for the SHA2-32 word compress function.

## How the IV Is Computed

1. **Seed string** — a 32-byte (256-bit) ASCII/UTF-8 string:
   ```
   "Synthetic Universal Language 001"
   ```
   Chosen to be exactly 32 bytes so it fills one 256-bit block with no padding.

2. **Scalar** — interpret the UTF-8 bytes as a big-endian 256-bit integer:
   ```
   scalar = uint(utf8("Synthetic Universal Language 001"))
   ```

3. **Elliptic curve point** — multiply the secp256r1 base point $G$ by the scalar:
   ```
   P = scalar × G   (on secp256r1)
   ```

4. **IV** — take the x-coordinate of $P$:
   ```
   IV = P.x = 0x325d5666_573eb118_f32191de_20d17f64_33392ba3_291ae46c_1474a5ed_a5383f25
   ```

Using an elliptic curve operation over a public, standardised curve ensures the IV is a **nothing-up-my-sleeve number**: anyone can reproduce it from the seed string and verify no trapdoor was introduced. The seed string encodes the purpose of this IV, making it domain-separated from any other use of secp256r1 or SHA2.

# Signed Vector of Bits

A **vector of bits** represented by a signed `bigint`. The most-significant bit is
always normalised to `1`, even when the underlying unsigned value would start with
`0`. When the unsigned bits already have their top bit set the stored value remains
positive; otherwise the value is negated after toggling the leading bit to `1`.
This guarantees a unique representation for every combination of length and data.

## Key Characteristics

- The **sign bit** acts as the **stop bit**, marking the boundary of the vector.
- The **`length`** is the count of meaningful bits, computed from the absolute value
  of the stored `bigint`.
- An **empty vector** is represented by `0n`.

## Example

| Vector          | Stored Value (`bigint`) | `length` | Unsigned Bits (`uint`) |
|-----------------|-------------------------|----------|------------------------|
| `vec(4n)(0n)`   | `-0b1000n`              | 4        | `0b0000n`              |
| `vec(4n)(5n)`   | `-0b1101n`              | 4        | `0b0101n`              |
| `vec(4n)(0xDn)` | `0b1101n`               | 4        | `0b1101n`              |
| `vec(8n)(0xFn)` | `-0b1000_1111n`         | 8        | `0b0000_1111n`         |
| `empty`         | `0n`                    | 0        | (none)                 |

# Data Identity Format

1. a symbol of level 3 (137 bit max) Note: we need it since we can't store all possible bit vectors of level 3 in # 2.
2. a bit vector (more is better). In theory, we can use only #1 and #3 but it means that we will need to call a hash function for really short sequences, about 16 bits.
3. a hash (256 bit min?).

## Option # 1. First Bits

Cut the first bits from a data identity.

- `00`: a symbol of the level 3
- `01`: a bit vector (max length is 253 bits)
- `1`: 255 hash

## Option # 2. Different IVs

Disadvantage: we still need to store the bits so it breaks byte alignment.






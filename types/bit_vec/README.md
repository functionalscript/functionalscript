# Vector of Bits

A **vector of bits** is represented as a `bigint`. The value is always positive, and an **empty vector** is denoted by `1n`.

## Key Characteristics

- The **most significant bit** with a value of `1` is called the **`stop bit`**.
- The **`stop bit`** marks the boundary of the vector.
- The **`length`** of a vector represents the number of meaningful bits (excluding the **`stop bit`**).
- An **empty vector** is represented by `1n`, with the implicit **`stop bit`** as the only bit.

## Example

| Vector        | Binary Representation | `length` | Vector Items |
|---------------|-----------------------|----------|--------------|
| `0b1001n`     | `0b1001n`             | 3        | `001`        |
| `0x1FF`       | `0b111111111`         | 8        | `11111111`   |
| `1n` (empty)  | `0b1`                 | 0        | (none)       |

# Decode: First-Symbol Estimation

Given an output symbol `i`, the first input symbol `s0` of the original word is estimated
from the upper bits of `j = i + (n-2)`:

```ts
const shift = n - 2n
const d     = (n - 1n) << 1n   // = 2^(e+1)
const j      = i + shift
const r      = log2(j / d)      // estimate: r ∈ {s0-1, s0}
const s0     = sum(r) > i ? r : r + 1n
```

The offset `n-2` is chosen so that `j / d` always falls in `[2^(s0-1), 2^s0)`, keeping
the estimate within 1 of the true value. A single comparison then corrects the off-by-one
case.

Once `s0` is known, the remaining symbols are recovered by subtracting the group base
`sum(s0 - 1)` from `i` to obtain the offset within the `s0`-group, then applying the same
estimation recursively on that offset until the word is fully decoded.

In the tables below each **row** corresponds to one value of `floor(j / d)` and each
**column** to one value of `j mod d`. The **`r`** column gives `floor(log2(floor(j/d)))` —
the first-symbol estimate before the off-by-one correction. Symbols marked **`+`** are
those where `r = s0` directly (no correction needed — they sit at the tail of their group
where `j / d` has crossed the next power of 2). **Empty cells** are `j` values with no
valid symbol.

## Level 1

- Shift: `0`, divisor: `2`

| `floor(j/2)` | `r`  | `0`   | `1`   |
|--------------|------|-------|-------|
| `0`          | `-1` | `00`  | `01`  |
| ---          |      |       |       |
| `1`          | `0`  | `100` | `101` |
| `2`          | `1`  | `11`+ |       |

## Level 2

- Shift: `3`, divisor: `8`

| `floor(j/8)` | `r`  | `000`    | `001`    | `010`    | `011`    | `100`    | `101`    | `110`    | `111`    |
|--------------|------|----------|----------|----------|----------|----------|----------|----------|----------|
| `0000_0`     | `-1` |          |          |          | `00`     | `01`     | `02`     | `03`     | `04`     |
| ---          |      |          |          |          |          |          |          |          |          |
| `0000_1`     | `0`  | `100`    | `101`    | `102`    | `103`    | `104`    | `11`     | `12`     | `13`     |
| ---          |      |          |          |          |          |          |          |          |          |
| `0001_0`     | `1`  | `14`+    | `200`    | `201`    | `202`    | `203`    | `204`    | `2100`   | `2101`   |
| `0001_1`     | `1`  | `2102`   | `2103`   | `2104`   | `211`    | `212`    | `213`    | `214`    | `22`     |
| ---          |      |          |          |          |          |          |          |          |          |
| `0010_0`     | `2`  | `23`+    | `24`+    | `300`    | `301`    | `302`    | `303`    | `304`    | `3100`   |
| `0010_1`     | `2`  | `3101`   | `3102`   | `3103`   | `3104`   | `311`    | `312`    | `313`    | `314`    |
| `0011_0`     | `2`  | `3200`   | `3201`   | `3202`   | `3203`   | `3204`   | `32100`  | `32101`  | `32102`  |
| `0011_1`     | `2`  | `32103`  | `32104`  | `3211`   | `3212`   | `3213`   | `3214`   | `322`    | `323`    |
| ---          |      |          |          |          |          |          |          |          |          |
| `0100_0`     | `3`  | `324`+   | `33`+    | `34`+    | `400`    | `401`    | `402`    | `403`    | `404`    |
| `0100_1`     | `3`  | `4100`   | `4101`   | `4102`   | `4103`   | `4104`   | `411`    | `412`    | `413`    |
| `0101_0`     | `3`  | `414`    | `4200`   | `4201`   | `4202`   | `4203`   | `4204`   | `42100`  | `42101`  |
| `0101_1`     | `3`  | `42102`  | `42103`  | `42104`  | `4211`   | `4212`   | `4213`   | `4214`   | `422`    |
| `0110_0`     | `3`  | `423`    | `424`    | `4300`   | `4301`   | `4302`   | `4303`   | `4304`   | `43100`  |
| `0110_1`     | `3`  | `43101`  | `43102`  | `43103`  | `43104`  | `4311`   | `4312`   | `4313`   | `4314`   |
| `0111_0`     | `3`  | `43200`  | `43201`  | `43202`  | `43203`  | `43204`  | `432100` | `432101` | `432102` |
| `0111_1`     | `3`  | `432103` | `432104` | `43211`  | `43212`  | `43213`  | `43214`  | `4322`   | `4323`   |
| ---          |      |          |          |          |          |          |          |          |          |
| `1000_0`     | `4`  | `4324`+  | `433`+   | `434`+   | `44`+    |          |          |          |          |

## Level 3

- Shift: `0x7F`, divisor: `0x100`

Columns show selected values of `j mod 0x100`; `...` abbreviates the omitted range.
Words use dot-separated level-2 symbols in hex (e.g. `01.00.7F` = `[0x01, 0x00, 0x7F]`).

| `floor(j/256)` | `r`  | `00`          | `01`          | `02`          | `…` | `7F`       | `…` | `FF`          |
|----------------|------|---------------|---------------|---------------|-----|------------|-----|---------------|
| `000`          | `-1` |               |               |               |     | `00.00`    | …   | `00.80`       |
| ---            |      |               |               |               |     |            |     |               |
| `001`          | `0`  | `01.00.00`    | `01.00.01`    | `01.00.02`    | …   | `01.00.7F` | …   | `01.7F`       |
| ---            |      |               |               |               |     |            |     |               |
| `010`          | `1`  | `01.80`+      | `02.00.00`    | `02.00.01`    | …   | `02.00.7E` | …   | `02.01.00.7D` |
| `011`          | `1`  | `02.01.00.7E` | `02.01.00.7F` | `02.01.00.80` | …   | `02.01.01` | …   | `02.7E`       |
| ---            |      |               |               |               |     |            |     |               |
| `100`          | `2`  | `02.7F`+      | `02.80`+      | `03.00.00`    | …   | `03.00.7D` | …   | `03.01.00.7C` |
| `…`            |      |               |               |               |     |            |     |               |

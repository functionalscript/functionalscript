# nanvm-lib

A NaN-boxing VM for FunctionalScript implemented in Rust. See [`todo/fjs-nanvm-integration.md`](../todo/fjs-nanvm-integration.md) and [`nanvm-lib/todo/`](./todo/) for design notes.

## JS Operator Implementation Status

Operators on [`Any<A>`](src/vm/any/mod.rs) (the top-level VM value type).

### Arithmetic

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `+`      | Addition / concat   | [x]      | [`any/add.rs`](src/vm/any/add.rs) — `ToPrimitive`, then string concat or numeric addition; rejects mixed `number`/`bigint` |
| `-`      | Subtraction         | [x]      | [`any/sub.rs`](src/vm/any/sub.rs) — `ToNumeric` coercion; rejects mixed `number`/`bigint` |
| `*`      | Multiplication      | [x]      | [`impls/mul.rs`](src/vm/impls/mul.rs) → `Numeric * Numeric` |
| `/`      | Division            | [x]      | [`bigint/div.rs`](src/vm/bigint/div.rs) — magnitude quotient via schoolbook binary long division (shared with `%`'s `abs_divmod_vec`), truncates toward zero; `Number` uses Rust's own `/`; `Any`-level dispatch in [`any/div.rs`](src/vm/any/div.rs) |
| `%`      | Remainder           | [x]      | [`bigint/rem.rs`](src/vm/bigint/rem.rs) — magnitude remainder via schoolbook binary long division, sign follows the dividend; `Number` uses Rust's own `%`; `Any`-level dispatch in [`any/rem.rs`](src/vm/any/rem.rs) |
| `**`     | Exponentiation      | [x]      | [`bigint/pow.rs`](src/vm/bigint/pow.rs) — exponentiation by squaring, throws on a negative exponent; [`numeric.rs`](src/vm/numeric.rs) implements `Number::exponentiate`'s two departures from `f64::powf`/C99 `pow` (a `NaN` exponent, and an infinite exponent against a base of magnitude 1, are both `NaN`); not a `core::ops` trait (Rust has no exponentiation operator), so it's `Any::pow`/`Numeric::pow`, methods rather than operators |

### Unary

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `-`      | Unary minus         | [x]      | [`any/neg.rs`](src/vm/any/neg.rs) — `Neg for Any<A>` |
| `+`      | Unary plus          | [x]      | `Any::unary_plus()` method (coerces to number) |
| `!`      | Logical NOT         | [x]      | [`any/not.rs`](src/vm/any/not.rs) — `Not for Any<A>`, via the new `ToBoolean` coercion ([`boolean_coercion.rs`](src/vm/boolean_coercion.rs)) |
| `~`      | Bitwise NOT         | [x]      | `Numeric::bitwise_not()`/`Any::bitwise_not()` methods (no Rust operator to spell it with — `Not` is already `!`'s); `Number`: `ToInt32` then bitwise-negate; `BigInt`: `-x - 1`, the exact spec identity, reusing `Neg`/`Sub` rather than a new algorithm |
| `typeof` | Type of             | [x]      | [`any/typeof_.rs`](src/vm/any/typeof_.rs) — `Any::typeof_()` method (no Rust operator to spell it with; the trailing underscore resolves the collision with Rust's own reserved `typeof`, the same convention FJS and JS use); returns `"undefined"`, `"object"` (`null` and both container types), `"boolean"`, `"number"`, `"bigint"`, `"string"`, or `"function"` |

### Comparison

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `===`    | Strict equality     | [x]      | [`any/partial_eq.rs`](src/vm/any/partial_eq.rs) — `PartialEq for Any<A>` |
| `!==`    | Strict inequality   | [x]      | Provided by `PartialEq` |
| `<`      | Less than           | [x]      | [`any/relational.rs`](src/vm/any/relational.rs) — `IsLessThan`: `ToPrimitive`s both sides, lexicographic by UTF-16 code unit if both are strings, `StringToBigInt` if one side is a `BigInt` (decimal, `0x`, `0o`, and `0b` literals), otherwise exact `Number`/`BigInt` comparison (via IEEE 754 bit decomposition, not a lossy `f64` round-trip); `NaN` anywhere gives `false` in both directions |
| `<=`     | Less than or equal  | [x]      | `Any::le` — `!(y < x)`, except `NaN` anywhere stays `false` |
| `>`      | Greater than        | [x]      | `Any::gt` — the reversed `<`: `y < x` |
| `>=`     | Greater or equal    | [x]      | `Any::ge` — `!(x < y)`, except `NaN` anywhere stays `false` |

### Bitwise

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `&`      | AND                 | [x]      | [`any/bitand.rs`](src/vm/any/bitand.rs) — `BitAnd for Any<A>`; `Number`: `ToInt32` each side, then native `&`; `BigInt`: [`bigint/bitand.rs`](src/vm/bigint/bitand.rs) — infinite-precision two's-complement `AND` over words (see [`bigint/mod.rs`](src/vm/bigint/mod.rs)'s `bitwise_op`); rejects mixed `number`/`bigint` |
| `\|`     | OR                  | [x]      | [`any/bitor.rs`](src/vm/any/bitor.rs) — `BitOr for Any<A>`; same coercion as `&`; `BigInt`: [`bigint/bitor.rs`](src/vm/bigint/bitor.rs) |
| `^`      | XOR                 | [x]      | [`any/bitxor.rs`](src/vm/any/bitxor.rs) — `BitXor for Any<A>`; same coercion as `&`; `BigInt`: [`bigint/bitxor.rs`](src/vm/bigint/bitxor.rs) |
| `<<`     | Left shift          | [x]      | `Shl for Any<A>`; `Number`: `ToInt32` the left side, `ToUint32(rhs) & 0x1F` the shift count, then native `<<`; `BigInt`: [`bigint/shl.rs`](src/vm/bigint/shl.rs) — `x * 2^y` exactly (arbitrary precision, no 32-bit wrap), delegating to `>>` for a negative `y`; throws a `RangeError` if the result would exceed `fjs/types/bigint/module.f.mjs`'s `maxLength` (the smallest `BigInt` size limit across the engines FunctionalScript targets); the result's own buffer is reserved fallibly rather than through ordinary (abort-on-failure) `Vec` growth, though the container construction it's then handed to is not yet — see that file's own TODO |
| `>>`     | Signed right shift  | [x]      | `Shr for Any<A>`; same `Number` coercion as `<<`, arithmetic (sign-extending) shift; `BigInt`: [`bigint/shr.rs`](src/vm/bigint/shr.rs) — floor division by `2^y` (not truncation: a negative `BigInt` rounds *away* from zero when a set bit is shifted out, so `-1n >> 1_000_000n` stays `-1n`), delegating to `<<` for a negative `y` |
| `>>>`    | Unsigned right shift| [x]      | `Any::unsigned_right_shift()` method (no Rust operator for it — `>>` on a signed type is arithmetic, and there's no unsigned counterpart); `Number`: `ToUint32` *both* sides (never `ToInt32` — the one shift where the left operand's sign bit is never preserved); `BigInt`: always throws, since arbitrary-precision integers have no fixed width to be "unsigned" relative to |

### Logical

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `&&`     | Logical AND         | [x]      | [`any/and.rs`](src/vm/any/and.rs) — `Any::logical_and()` method (no `core::ops` trait fits: Rust's own `&&` takes `bool` and short-circuits evaluation) |
| `\|\|`   | Logical OR          | [x]      | [`any/or.rs`](src/vm/any/or.rs) — `Any::logical_or()` method, same reason |
| `??`     | Nullish coalescing  | [x]      | [`any/nullish_coalescing.rs`](src/vm/any/nullish_coalescing.rs) — `Any::nullish_coalescing()` method, checked by matching on `Unpacked::Nullish` directly (allocation-free), not `ToBoolean` |

### Other

| Operator   | Description         | `Any<A>` | Notes |
|------------|---------------------|----------|-------|
| `?:`       | Conditional         | [x]      | [`any/conditional.rs`](src/vm/any/conditional.rs) — `Any::conditional()` method; the corpus's one ternary group (`fjs/nanvm/types.ts`'s `NonEdagGroup`, since the EDAG has no conditional-expression node) |
| `.` / `[]` | Member access       | [ ]      | |
| `in`       | Property check      | [ ]      | |
| `instanceof` | Instance check    | [ ]      | |

## Coercions

| Coercion       | Status | Location |
|----------------|--------|----------|
| To number      | [x]    | [`number_coercion.rs`](src/vm/number_coercion.rs) |
| To string      | [x]    | [`string_coercion.rs`](src/vm/string_coercion.rs) |
| To boolean     | [x]    | [`boolean_coercion.rs`](src/vm/boolean_coercion.rs) — never throws, unlike the others |
| To primitive   | [x]    | [`primitive_coercion.rs`](src/vm/primitive_coercion.rs) |
| To numeric     | [x]    | `Any::to_numeric()` |
| To int32       | [x]    | [`int32_coercion.rs`](src/vm/int32_coercion.rs) — `ToInt32`, operating on the already-coerced `f64` a `Number::` bitwise/shift op needs |
| To uint32      | [x]    | [`int32_coercion.rs`](src/vm/int32_coercion.rs) — `ToUint32`, shares its `modulo 2^32` step with `ToInt32`; used for `<<`/`>>`'s shift-count operand and both of `>>>`'s operands |

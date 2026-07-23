# nanvm-lib

A NaN-boxing VM for FunctionalScript implemented in Rust. See [`issues/082-nanvm.md`](../issues/082-nanvm.md) for design notes.

## JS Operator Implementation Status

Operators on [`Any<A>`](src/vm/any/mod.rs) (the top-level VM value type).

### Arithmetic

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `+`      | Addition / concat   | [x]      | [`any/add.rs`](src/vm/any/add.rs) — delegates to `Unpacked`; handles `number`, `string`, `bigint` |
| `-`      | Subtraction         | [ ]      | `Sub for BigInt` exists; no `Any`-level impl |
| `*`      | Multiplication      | [x]      | [`impls/mul.rs`](src/vm/impls/mul.rs) → `Numeric * Numeric` |
| `/`      | Division            | [ ]      | |
| `%`      | Remainder           | [ ]      | |
| `**`     | Exponentiation      | [ ]      | |

### Unary

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `-`      | Unary minus         | [x]      | [`any/neg.rs`](src/vm/any/neg.rs) — `Neg for Any<A>` |
| `+`      | Unary plus          | [x]      | `Any::unary_plus()` method (coerces to number) |
| `!`      | Logical NOT         | [ ]      | |
| `~`      | Bitwise NOT         | [ ]      | |
| `typeof` | Type of             | [ ]      | |

### Comparison

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `===`    | Strict equality     | [x]      | [`any/partial_eq.rs`](src/vm/any/partial_eq.rs) — `PartialEq for Any<A>` |
| `!==`    | Strict inequality   | [x]      | Provided by `PartialEq` |
| `<`      | Less than           | [ ]      | `PartialOrd for BigInt` exists; no `Any`-level impl |
| `<=`     | Less than or equal  | [ ]      | |
| `>`      | Greater than        | [ ]      | |
| `>=`     | Greater or equal    | [ ]      | |

### Bitwise

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `&`      | AND                 | [ ]      | |
| `\|`     | OR                  | [ ]      | |
| `^`      | XOR                 | [ ]      | |
| `<<`     | Left shift          | [ ]      | `Shl for BigInt` exists; no `Any`-level impl |
| `>>`     | Signed right shift  | [ ]      | `Shr for BigInt` exists; no `Any`-level impl |
| `>>>`    | Unsigned right shift| [ ]      | |

### Logical

| Operator | Description         | `Any<A>` | Notes |
|----------|---------------------|----------|-------|
| `&&`     | Logical AND         | [ ]      | |
| `\|\|`   | Logical OR          | [ ]      | |
| `??`     | Nullish coalescing  | [ ]      | `Nullish` type exists |

### Other

| Operator   | Description         | `Any<A>` | Notes |
|------------|---------------------|----------|-------|
| `?:`       | Conditional         | [ ]      | |
| `.` / `[]` | Member access       | [ ]      | |
| `in`       | Property check      | [ ]      | |
| `instanceof` | Instance check    | [ ]      | |

## Coercions

| Coercion       | Status | Location |
|----------------|--------|----------|
| To number      | [x]    | [`number_coercion.rs`](src/vm/number_coercion.rs) |
| To string      | [x]    | [`string_coercion.rs`](src/vm/string_coercion.rs) |
| To primitive   | [x]    | [`primitive_coercion.rs`](src/vm/primitive_coercion.rs) |
| To numeric     | [x]    | `Any::to_numeric()` |

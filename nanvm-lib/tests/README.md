# Tests

[`proof.f.ts`](proof.f.ts) is the JavaScript reference — it runs the same operations against a standard JS engine.
[`test.rs`](test.rs) is the Rust counterpart — it runs the same operations against `nanvm-lib`.

The goal is a near 1-to-1 match so that any divergence signals either a missing Rust test or an unimplemented feature.

## Coverage map

`[x]` = present, `[ ]` = missing.

### `eq` / strict equality (`===` / `!==`)

| Test case              | `proof.f.ts` | `test.rs`       | Notes |
|------------------------|:---:|:---:|-------|
| `nullish`              | [x] | [x] | `nullish_eq` |
| `boolean.boolean`      | [x] | [x] | `bool_eq` |
| `boolean.nullish`      | [x] | [x] | `bool_eq` |
| `number.number`        | [x] | [x] | `number_eq` — includes NaN, ±0, ±Inf |
| `number.nullish`       | [x] | [x] | `number_eq` |
| `string.string`        | [x] | [x] | `string_eq` |
| `string.number`        | [x] | [ ] | `n(0)("0")` — cross-type check missing in Rust |
| `bigint.bigint`        | [x] | [x] | `bigint_eq` |
| `array.array`          | [x] | [x] | `array_eq` |
| `object.object`        | [x] | [x] | `object_eq` |

### `unary_plus` (`+n`)

| Test case              | `proof.f.ts` | `test.rs` | Notes |
|------------------------|:---:|:---:|-------|
| `null`                 | [x] | [x] | |
| `undefined`            | [x] | [x] | |
| `boolean.false`        | [x] | [x] | |
| `boolean.true`         | [x] | [x] | |
| `number.zero`          | [x] | [x] | |
| `number.positive`      | [x] | [x] | |
| `number.negative`      | [x] | [x] | |
| `string.empty`         | [x] | [x] | |
| `string.zero`          | [x] | [x] | |
| `string.positive`      | [x] | [x] | TS tests `"2.3"`, Rust tests `"2.3e2"` — same concept |
| `string.nan`           | [x] | [x] | |
| `bigint.throw`         | [x] | [x] | |
| `array.empty`          | [x] | [x] | |
| `array.single_number`  | [x] | [x] | |
| `array.single_string`  | [x] | [x] | TS tests `["-2.3"]→-2.3`, Rust tests `["0.3"]→0.3` — Rust missing negative case |
| `array.multiple`       | [x] | [x] | |
| `object.empty`         | [x] | [x] | |
| `function`             | [x] | [x] | |

### `unary_minus` (`-n`)

| Test case              | `proof.f.ts` | `test.rs` | Notes |
|------------------------|:---:|:---:|-------|
| `null`                 | [x] | [x] | |
| `undefined`            | [x] | [x] | |
| `boolean.false`        | [x] | [x] | |
| `boolean.true`         | [x] | [x] | |
| `number.zero`          | [x] | [x] | |
| `number.positive`      | [x] | [x] | |
| `number.negative`      | [x] | [x] | |
| `string.empty`         | [x] | [x] | |
| `string.zero`          | [x] | [x] | |
| `string.positive`      | [x] | [x] | |
| `string.nan`           | [x] | [x] | |
| `bigint.positive`      | [x] | [x] | |
| `bigint.negative`      | [x] | [x] | |
| `array.empty`          | [x] | [x] | |
| `array.single_number`  | [x] | [x] | |
| `array.single_string`  | [x] | [x] | |
| `array.multiple`       | [x] | [x] | |
| `object.empty`         | [x] | [ ] | `{}` → NaN missing in Rust |
| `function`             | [x] | [x] | |

### `stringCoercion` (`String(x)`)

| Test case                      | `proof.f.ts` | `test.rs`              | Notes |
|--------------------------------|:---:|:---:|-------|
| `number`                       | [x] | [x] | `number_coerce_to_string` |
| `bool`                         | [x] | [ ] | `true`/`false` → `"true"`/`"false"` missing in Rust |
| `null`                         | [x] | [ ] | `null` → `"null"` missing in Rust |
| `undefined`                    | [x] | [ ] | `undefined` → `"undefined"` missing in Rust |
| `bigint`                       | [x] | [ ] | `123n` → `"123"` missing in Rust |
| `array`                        | [x] | [x] | `array_coerce_to_string` — Rust additionally tests nested arrays |
| `func`                         | [x] | [ ] | `typeof String(fn) === "string"` missing in Rust |
| `object.norm`                  | [x] | [ ] | `{}` → `"[object Object]"` missing in Rust |
| `object.toString`              | [x] | [ ] | custom `toString()` method missing in Rust |
| `object.toStringThrow`         | [x] | [ ] | throwing `toString()` missing in Rust |
| `object.toStringNotFunc`       | [x] | [ ] | non-function `toString` missing in Rust |
| `object.toStringNonPrimitive`  | [x] | [ ] | `toString()` returning non-primitive missing in Rust |

### `mul` (`*`) — only in `test.rs`

| Test case              | `proof.f.ts` | `test.rs` | Notes |
|------------------------|:---:|:---:|-------|
| `mul` (all cases)      | [ ] | [x] | Full table covering null, bool, number, bigint, string, array, object |

### BigInt-specific — only in `test.rs`

| Test case              | `proof.f.ts` | `test.rs` | Notes |
|------------------------|:---:|:---:|-------|
| `bigint_add`           | [ ] | [x] | Addition at `Any<A>` level |
| `bigint_mul`           | [ ] | [x] | Multiplication with large multi-limb values |
| `bigint_negative_zero` | [ ] | [x] | Rust normalization: `-0n === 0n` |

### Infrastructure — only in `test.rs`

| Test case              | `proof.f.ts` | `test.rs` | Notes |
|------------------------|:---:|:---:|-------|
| `serialization`        | [ ] | [x] | Round-trip serialize/deserialize for all types |
| `format_fn`            | [ ] | [x] | Rust `Debug` formatting of `Function` |

## Summary

| Gap | Action needed |
|-----|---------------|
| `stringCoercion` for bool/null/undefined/bigint/func/object | Add Rust tests in `test.rs` |
| `unary_minus.object.empty` | Add Rust test case |
| `eq.string.number` cross-type | Add Rust test case |
| `mul` / `bigint_add` / `bigint_mul` | Add TS tests in `proof.f.ts` |
| `serialization` | JS serialization is out of scope (VM-internal), keep Rust-only |
| `format_fn` / `bigint_negative_zero` | Rust-specific, keep Rust-only |
| `old_eq` in `test.rs` | Redundant — overlaps with `nullish_eq`/`bool_eq`/`number_eq`/etc.; consider removing |

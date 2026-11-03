# L1: the operations

**Decided (2026-11-02):** the JavaScript operations form their own layer,
between the core and the stock runtime.

L1 holds the operations whose meaning is JavaScript's: arithmetic and
comparison, `===`, `typeof`, `instanceof`, member access, calls through a
member, coercions, iteration and spread, and the natives the stock runtime
cannot write in FunctionalScript.

## Today

The operations are methods on `Any` and helpers in `vm::unstable`:

- `dot`, `option_dot`, `call`, `option_call`, `end`, `end_call_native`;
- the operators, through Rust's `ops` traits, and `lt`, `le`, `gt`, `ge`,
  `pow`, `unsigned_right_shift`, `bitwise_not`;
- `typeof_`, `instanceof_`, `same_value`, `to_boolean`, `to_number`,
  `to_numeric`, `to_string`, `to_primitive`, `to_json`;
- `entries`, `entry`, `has_entry`, `get_iterator`, `object_spread`;
- in `unstable`: `strict_eq`, `strict_ne`, `static_read`, and the spread
  helpers `spread_item`, `spread_array`, `spread_call`, `property_item`,
  `spread_entries`, `spread_object`.

Sources: [`nanvm/lib/src/vm`](../../../nanvm/lib/src/vm/mod.rs),
[`vm/unstable`](../../../nanvm/lib/src/vm/unstable/mod.rs).

## Where the operations live

| Option | Meaning | For | Against |
| --- | --- | --- | --- |
| A. In the runtime | Each operation is an import. The program never looks inside a value. | The smallest generated code. The runtime owns all behaviour. | A new runtime implements about 50 operations before the first program runs. |
| B. In the program | Each operation is FJS or WAT over L0, linked into each program. The runtime is only L0. | The smallest runtime, and one definition of the behaviour. | Larger programs. Number formatting and parsing and bigint arithmetic are hard to write well over L0. Speed depends on inlining across modules. |
| C. A named list, native by default, with a reference body | Each operation is an import, as in A, and also has a reference body in FJS over L0, as in B. A runtime implements it natively or links the body. | NaNVM keeps its native code. A new runtime starts with L0 and the bodies, then replaces hot operations one at a time. The bodies are a test oracle. | Two definitions per operation to keep equal. Conformance has to check both. |

**Proposed:** C. The repository already works this way in one place:
`runtime.in` is a body in FJS that an executor may replace natively
([in-native-substitution.md](../../../nanvm/lib/todo/in-native-substitution.md)).
C applies that to all of L1.

## Consequences

- **Fast paths come from types, not encodings.** L0 keeps `any` opaque,
  so a program inlines `f64 + f64` only where it has unpacked both operands,
  and calls the `+` operation otherwise.
- **L1 is narrower than `Any`.** The spread helpers and `property_item`
  exist to shorten printed Rust. They become sequences of L0 builder calls,
  so the list stays short.
- **The list is versioned.** A module names the L1 version it was compiled
  against, and a runtime refuses a version it does not provide.

## Open

- Which operations have no reasonable reference body? Number to string and
  string to number are the likely ones, and they may stay native-only. Every
  native-only operation is one more thing a runtime must implement before
  its first program runs, so this list should stay as short as it can.
- Whether member access on a primitive, which `runtime.dot` and the native
  member table answer today, is one L1 operation or a call into L2.

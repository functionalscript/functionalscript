# Enumerable Property Presence

**Priority:** P2
**Status:** open

## Decision

Prohibit `Object.hasOwn` in FunctionalScript source. Do not change that standard
operation's meaning to enumerate entries. The `in` operator remains prohibited,
and the `obj.hasOwnProperty(...)` method is not an alternate admitted spelling.

This replaces the earlier proposal to recognize `Object.hasOwn` directly.
That proposal correctly required extending or refusing unsupported receivers;
it did not propose the enumerability redefinition later suggested by `entry`.
The decision is now to expose enumerable data properties through an explicit
pattern instead. This is a source-language plan, not a ban on host-side
implementation helpers or a claim that the new instruction ships today.

## Proposed pattern

Working name: `hasEntity`. The candidate source spells exactly what it asks:

```js
const hasEntity = (a, b) =>
    Object.getOwnPropertyDescriptor(a, b)?.enumerable;
```

Use JavaScript's actual names: `getOwnPropertyDescriptor` and `enumerable`.
The descriptor exists only inside the complete matched pattern; it is not
an ordinary value a program can obtain or return.

| Input | Result of this exact pattern |
|-------|------------------------------|
| `hasEntity({ x: 7 }, "x")` | `true` |
| `hasEntity({ x: undefined }, "x")` | `true` |
| `hasEntity({}, "x")` | `undefined` |
| `hasEntity([7], "0")`, `hasEntity("ab", "0")` | `true` |
| `hasEntity([], "length")`, `hasEntity("ab", "length")` | `false` |
| `hasEntity(() => 0, "name")` | `false` |
| `hasEntity({}, "toString")` | `undefined` (inherited, not own) |
| `hasEntity(null, "x")`, `hasEntity(undefined, "x")` | failure |

An enumerable property's value does not decide its presence. In particular,
`undefined` is a value an enumerable entry can hold, not an instruction to
remove the entry. This constrains the [undefined-property plan](./1010-undefined-property.md).

### Boolean or descriptor flag?

The candidate above returns `boolean | undefined`, not only `boolean`.
It still distinguishes a missing property from a non-enumerable own property.
A uniformly boolean enumerable-entry predicate would instead spell:

```js
const hasEntity = (a, b) =>
    Object.getOwnPropertyDescriptor(a, b)?.enumerable === true;
```

These are different source patterns. Do not lower the first to the second:
`undefined` is not `false`. Before selecting the final helper/API and EDAG
encoding, confirm whether the instruction returns the raw flag or the boolean
predicate, and confirm the working name (`hasEntry` would align with `entry`).
The prohibition of `Object.hasOwn` does not depend on this remaining API choice.

## Recognition and execution

Follow [statement-aware AST recognition](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md).
The parser produces a JavaScript-subset AST, not an already-valid FJS program.
AST-to-EDAG compilation resolves bindings, checks visibility and early errors,
then admits only complete approved patterns and supported computations. The
matcher never scans source tokens, inspects newlines or inserts semicolons.
The parser must understand the pattern's syntax, including its
[named parameters](../README.md#functions); general EDAG lowering for every
function using that syntax is not a prerequisite. `Object` must resolve to
the intended intrinsic, not a shadowing binding. Parsed descriptor operations
outside an approved pattern remain refused by FJS admission.

Share receiver/key-conversion semantics with the descriptor read used by
[`entry`](../../fjs/edag/todo/entry.md). Preserve the selected source pattern's
semantics, including primitive boxing and property-key conversion, subject to
the adopted [function-source exception](../README.md#function-source-representation-exception).
A function-derived key may differ from the host's key; ordinary string-key
presence and the raw-flag/boolean distinction do not change. A receiver or
conversion not yet supported is refused, not answered with an invented value.
The [rendering questions](./serialization.md#function-text-and-serialization)
also apply to this helper; it cannot silently choose a different conversion.

## Tasks

- [x] Withdraw direct `Object.hasOwn` recognition and its proposed enumerability
      reinterpretation; record the source prohibition and new pattern direction.
- [ ] Confirm the helper name and raw-flag versus boolean API before encoding it.
- [ ] Add the complete pattern to AST-to-EDAG compilation after its syntax,
      including [named parameters](../README.md#functions), can be represented;
      keep descriptor values and unmatched protected operations inaccessible.
- [ ] Implement the selected operation across the applicable EDAG/execution
      paths and writer, with matching source semantics and explicit refusals.
- [ ] Cover all cases above, coercion, binding shadowing, statement boundaries,
      and `{ x: 1, x: undefined }`. Compare with the actual JavaScript pattern,
      not with `Object.hasOwn`, which answers a different question.
- [ ] Run the repository's required type, test and coverage checks with code.

The feature implementation is P2. Any accepted pattern that violates source
inclusion or successful-result agreement is P1; unsupported syntax may remain
refused while the feature is developed.

## Related

- [Entry](../../fjs/edag/todo/entry.md) — reading an enumerable data entry.
- [Built-ins](./2360-built-in.md) — prohibited reflection and pattern-only access.
- [Undefined-property representation](./1015-undefined-property-vm-layer.md)
  — representation choices cannot override the source pattern's observations.
- [PR #1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — historical `in`/`hasOwn` discussion, superseded by the decision above.

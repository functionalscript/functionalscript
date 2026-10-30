## Substitute a native answer for the `in` node

**Priority:** P4
**Status:** open — taken when a measurement asks for it

### Problem

A compiled `"k" in o` calls the runtime's `in` body through the runtime
value: `Any::call` of the function `dot(rt, "in")` reads, with the key and
the value. That is the naive spelling DESIGN.md §13 keeps, correct by
construction since the body is the definition, and it costs a property
read, a call and a frame where `instanceof` costs one `Dispatch` over
`Unpacked`. Nothing has measured that the cost matters.

### Proposal

A substitution rule keyed on the EDAG's `in` node, as `vm/lambda` is for
the chain nodes: `Any::in_(key, value)` over `Unpacked`, `has_entry` of an
object, an array or a function and the `TypeError` of a primitive, and the
Rust writer (`fjs/rust/serializer`) printing it in place of the call. The
naive emission stays, and the harness runs the corpus's `in_x` and `in_0`
groups both ways and diffs the answers, which is the proof of the rule.
Take it after a measurement on a program that asks `in` often enough to
show, never before.

### Related

- [`spec/todo/2346-in-operator.md`](../../../spec/todo/2346-in-operator.md) — the operator and its runtime body.
- [DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution) — optimize by substitution.

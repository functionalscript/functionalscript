## One member function per name, dispatching on its receiver itself

**Priority:** P3
**Status:** open — a design **sergey-shandar** gave in the static-runtime
session; take it after a measurement, with the two decisions below made

### Problem

A member call on a built-in, `a.map(b)`, is dispatched at run time by name
and by the receiver's type. The compiled form reads the property with a
string key and calls what it finds; the call step tries the receiver's own
property, then the native table in `vm/lambda`, scanned by comparing the
key against every name, then the runtime's `members` table by type and
key, then throws. The name was a literal in the source, and the list of
names a module may call on a built-in, `allowedCalls` in
[`../prototype`](../prototype/module.f.js), is known at compile time. The
same dispatch is written twice more, in the represented interpreter's
`value/method` and in the `member` section of
[`../runtime`](../runtime/module.f.js), keyed by receiver type.

### Proposal

The runtime defines one function per member name, taking any receiver, and
the function dispatches on its receiver itself:

```js
export const runtime = {
    member: {
        map: (self, f) => {
            if (self instanceof Array) { return /* the array's map */ }
            const { map } = self
            return map(f)
        },
    },
}
```

- The `member` section is keyed by name alone. The native implementations
  become branches of the bodies, so the native table, `runtime_method`'s
  search by type and key, the `members` table and `type_name` go, and the
  interpreter's dispatcher with them: one rule, in one place, for both
  executors.
- A compiled `a.map(b)` calls the body directly, `map(a, b)` on NaNVM and
  the runtime's body in the interpreter, skipping the key string and both
  scans. A call of a name not in `allowedCalls` stays as it is: a property
  read, then a call of what it holds.
- The fallback is the own-property path as it already is: destructuring
  reads the own property or `undefined`, the bare call calls it with no
  receiver, as an own property is called today, and calling `undefined`
  throws the `TypeError` JavaScript throws on a type without the method.

### Decisions

- **Admit a prototype name at a destructuring key in the runtime module.**
  The parser refuses `const { map } = self` by name alone
  ([`../prototype/README.md`](../prototype/README.md)), since on the host
  the pattern would reach the prototype where FunctionalScript reads an own
  property or nothing. Inside a member body the refusal loses its reason:
  the body handles every type whose prototype has the name before it falls
  back, so by the fallback the host and FunctionalScript agree. Whether the
  admission is the runtime module's alone or a rule for every module is
  the decision.
- **The optional call.** `({}).map?.()` skips today because the call step
  finds no own property and no built-in for an object. With one `map` for
  every receiver the callee always exists, so either the body answers
  "nothing to call here" for the guard, or the fallback reads the property
  and skips on nullish itself, keeping the rule in the body.

### Related

- [`runtime.md`](./runtime.md) — the bodies written once, which this
  extends to the dispatch.
- [`runtime-static.md`](./runtime-static.md) — the static runtime the
  bodies compile into.
- [`../../../nanvm/lib/todo/static-runtime-calls.md`](../../../nanvm/lib/todo/static-runtime-calls.md)
  — the sibling case, a known callee inside the runtime called directly.
- [`../prototype/README.md`](../prototype/README.md) — the read and call
  rules by name alone.

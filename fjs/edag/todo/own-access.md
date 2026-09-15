## One access node: `.` reads an own property, and `own` goes

**Priority:** P2
**Status:** open — [`own-object.md`](./own-object.md) proposes the alternative, two nodes with the guard read as what `Object` means

### Problem

The EDAG has two nodes for one read. `['.', a, key]` is the access the
compiler emits, and under amnesia it is the host's `a[key]`, which walks the
prototype chain; `['own', a, key]` reads an own property and bypasses it.
The language has one access, and the specification says which: an access
reads an own property, never the prototype chain, `undefined` where there is
none ([`spec/README.md`](../../../spec/README.md), Property Access), and the
value path already reads it so through `hasOwn`. So `.` as amnesia runs it
is not the language's access, and `own` is.

The parser's prohibited names — every name a built-in prototype gives, all
but `length` — do not fix that. They keep an accepted program meaning the
same in JavaScript, where `[].push` is a function and under an own read it
is `undefined`; they cannot make a host read own, since no list can name
what a realm adds to a prototype. And they ban `name`, which an own read
returns anyway — `Object.hasOwn(f, 'name')` is `true`, and
`Object.getOwnPropertyDescriptor` is an allowed built-in — so the ban is a
rule the language cannot keep.

### Proposal

One node, `['.', a, key]`, reading an own property; `own` retired from the
schema, the README's table and amnesia.

- **Semantics.** The value is `Object.getOwnPropertyDescriptor(a, key)?.value`:
  the own property, `undefined` where there is none, and a throw on a
  `null` or `undefined` receiver, as JavaScript's read throws. No
  FunctionalScript value has an accessor, so `.value` is always the value. A
  JavaScript executor — amnesia, the memo executor's operation table — reads
  exactly that expression; the key stays a string, a number, or
  `['Number', e]`, since the language rejects `a[b]` where `b` is not known.
- **Non-enumerable own properties.** `length` on an array, a string and a
  function, and `name` on a function, are own and not enumerable: the read
  returns them, and `Object.entries` does not list them —
  `Object.entries([5])` is `[['0', 5]]`, `Object.entries({ length: 5 })` is
  `[['length', 5]]`. A VM returns them on a read and keeps them out of
  `entries`, which is what the descriptor read and JavaScript's `entries`
  already do.
- **`name`.** Readable, as any own property is, so the parser's exemption
  from the prohibited names becomes the own data properties of a built-in
  value, `length` and `name`, not `length` alone. Its value is what the
  engine gives a function — `"f"` for `const f = (...a) => 5` in
  JavaScript, another name after the writer, whatever the memo executor's
  closure carries, since the graph is name-erased — so the specification
  states it as implementation-defined until `=>` carries the name
  ([`function-name.md`](./function-name.md)), after which it is
  JavaScript's.
- **Writing it back.** The general spelling is
  `Object.getOwnPropertyDescriptor(a, b)?.value`, which needs a call and
  optional chaining in the language; the writer uses the simpler forms
  wherever they mean the same — `a.b` and `a["b"]` for a string key,
  `a[0]` for a number, `a[Number(b)]` or `a[+b]` for a computed number —
  and today every key is one of those.
- **Future ECMAScript.** A new own property on a built-in value would be a
  name the read returns. ECMAScript avoids such additions, and the language
  assumes none for now.

### Tasks

- [ ] `own` removed from the `op2` ids, the RTTI schema, `types.ts` and the
      README's table; `.` documented as the own read, with the descriptor
      expression as its definition.
- [ ] Amnesia's `.` reads `Object.getOwnPropertyDescriptor(a, key)?.value`;
      its `own` handler goes; proofs for a missing property, `length` on an
      array, a string and a function, `name` on a function, an inherited
      property returning `undefined`, and a nullish receiver throwing; the
      README's host-delegation caveat closes.
- [ ] The parser exempts `name` as it exempts `length`; the specification's
      Property Access section says `name` is implementation-defined.
- [ ] The writer's spellings, per the bullet above.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`analysis.md`](./analysis.md) — a plain access is pure, which this read
  is by construction.
- [`../amnesia/README.md`](../amnesia/README.md) — the caveat this closes.
- [`spec/todo/2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md)
  — the accessor's roadmap entry.
- [`fjs/fsc/todo/functionalscript-output.md`](../../fsc/todo/functionalscript-output.md)
  — the writer that spells the node.

## Evaluate to host values, a function to its description

**Priority:** P2
**Status:** open — a design proposed by the language designer; details below are to be settled

### Problem

An evaluated value is an EDAG node ([`../value/types.ts`](../value/types.ts),
`EdagValue`): an array is `['[]', items]`, an object `['{}', properties]`,
`undefined` is `['undefined']`, and a function is `['=>', length, captures,
body]`. Everything the interpreters do is done on that representation, and
three costs follow from it.

- **A reference map is a list.** The interpreters answer the EDAG's
  `['refMap']` with [`fjs/js/ref_map`](../../js/ref_map/module.f.js), pairs
  searched with `===`, where the
  [contract](../../../spec/built-ins/reference-map/README.md) asks
  `O(log n)`. [`fjs/types/map`](../../types/map/module.f.js) is built on the
  reference map, and the analysis and sharing passes are built on that map,
  so the compiler run through an interpreter pays it everywhere. A program
  that sets `n` distinct keys and reads each back, interpreted by
  [`memo`](../memo/README.md) at `9a14b1d`
  (`fjs compile` to a `.data.js`, start-up of about 2 s included):

  | `n` | time |
  | --- | --- |
  | 1,000 | 8.6 s |
  | 2,000 | 31.4 s |
  | 4,000 | 122.5 s |
  | 8,000 | 477.1 s |
  | 4,000, the same loops without the map | 1.8 s |

- **Every operation is an emulation.** A property read, a spread and an
  addition each take a tagged tuple apart and build another.
- **A call walks a graph.** A function's body is an expression evaluated node
  by node at each call.

[A store for reference maps](./reference-map-store.md) answers the first cost
alone, with a table threaded through every invocation of both interpreters.

### Proposal

A value is the host's own value, except a function.

- A primitive, an array and an object are what they are in the host. Their
  identity is the host's, so a reference map is
  [`fjs/types/ref_map`](../../types/ref_map/module.f.js) itself, with its
  bound, and no store is threaded anywhere.
- A function is a host function of no arguments that answers its description,
  along the lines of

  ```js
  () => ({ length, frame, edag })
  ```

  the three parts a closure has today
  (`['=>', length, captures, body]`). `frame` is the array of its captured values,
  host values each, ready as it stands for the body's `['frame', index]`
  nodes to read by index; `edag` is its body, unevaluated. A call evaluates
  `edag` over `frame` and the arguments, as a call does today, with nothing
  converted on the way in, and the function can still be written out from the three. The
  description is behind a call so that a function value is told from data by `typeof`, and is one
  reference, which is its identity.

  **A call is a change of frame.** The interpreter holds the frame it is
  evaluating over. To run a function's `edag` it puts that frame on a stack
  of its own and takes the function's `frame` in its place; when the body
  has answered, it takes the old one back. The stack is the interpreter's
  data, not the host's, so a call nested in a call does not enter the
  evaluator again, which is what
  [non-tail calls](../value/call/todo/non-tail-recursion.md) ask for. A call
  in tail position puts nothing on it.

  The description may later hold a fourth field, `compiled`: a host function
  built once where the function value is made, which takes the arguments and
  answers the result, so that a call does not walk the body. It is not part
  of this proposal. Without it the third cost above stays, and the first two
  go.

This is the model NaNVM already has, real values and functions
(`Any<A>` in `nanvm/lib`), so the interpreters and the VM would agree on what
a value is.

### What a design has to settle

- **Functions that are no closure.** What the entry helpers, intrinsics and
  static functions (`EntryFunction`, `Intrinsic`, `Static`) answer as
  descriptions: they have no captures and no body, only the node that names
  them.
- **A reference map is a host function too.** `typeof` alone no longer tells
  a description from a map. Either a map is wrapped in a description whose
  `edag` is the `['refMap']` node and which the interpreter calls as the
  host's map, or the two are told apart another way.
- **What the stack holds.** The old frame alone does not say where to go
  on: an entry also needs the caller's arguments, the node whose operand the
  call was, and the values that invocation has already computed. What an
  entry is, and how an operation with several operands is taken up again
  part-way.
- **`undefined`.** It is tagged today so that an absent value and an
  `undefined` one are never confused inside the interpreter
  ([`../value/README.md`](../value/README.md)). With the host's `undefined`
  as the value, every place that relies on the tag needs another way to say
  "absent".
- **Objects.** An evaluated object is a list of properties with no
  prototype to read through. A host object has one, and `__proto__` is a key
  a program may write; the operations have to read own enumerable
  properties only, as they do now.
- **Writing a value out.** `.data.js`, `.f.js` and `.rs` outputs of an
  evaluated module need the walk from host values back to EDAG, with shared
  values found by identity, which the reference map gives. A map that was
  used holds what cannot be enumerated: it is refused, or the fold over the
  empty map is kept beside it
  ([the store's third question](./reference-map-store.md)).
- **Types.** `EdagValue` is checked to be a subset of `Exp`
  (`_Subset`), and the value serializer and the function-text renderer rely
  on it. Values become `unknown` narrowed at each operation; what replaces
  the check.
- **Failure.** An operation answers `Result<EdagValue, EdagValue>`; a thrown
  value is any value, which stays true.

### Scope

`EdagValue` is named in about thirty modules: all of `fjs/edag/value`,
`fjs/edag/operations`, both interpreters, `fjs/compiler/transpiler`,
`fjs/compiler/source`, `fjs/compiler/serializer/value` and `fjs/nanvm`.
[`to_unknown`](../value/to_unknown/module.f.js), which converts an evaluated
value to a host one, becomes the identity on data.

### Tasks

- [ ] Settle the descriptions of functions that are no closure, and how a map is told from a function.
- [ ] Settle `undefined` and the object rules.
- [ ] Measure on one interpreter before moving the rest: the reference-map
  program above, and the whole compiler evaluated (`fjs/module.f.js`), which
  took 19 min 25 s at `9a14b1d`. What a call still costs there says whether
  `compiled` is worth an issue of its own.
- [ ] Move the operations, then the interpreters, then the consumers.
- [ ] Write a host value out as EDAG, with sharing kept.
- [ ] Delete [the store issue](./reference-map-store.md) with the pull
  request that makes the map the real one.

### Related

- [A store for reference maps](./reference-map-store.md) — the narrower
  answer to the first cost.
- [Reference map](../../../spec/built-ins/reference-map/README.md) and its
  [design record](../../../spec/design/object-identity.md#reference-map).
- [`../values.md`](../values.md) — the contracts values keep today.
- [Non-tail interpreter calls](../value/call/todo/non-tail-recursion.md) —
  the host stack a nested call takes today, which the frame stack replaces.
- [`fjs/types/ref_map`](../../types/ref_map/module.f.js) — the map with the
  bound, which the host gives.

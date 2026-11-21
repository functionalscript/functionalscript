## Evaluate to host values, a function to its description

**Priority:** P2
**Status:** open — one of three options, all proposed by the language designer; none is chosen

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
  [`memo`](../memo/README.md) at `2ae0f18`
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

### Where the time goes

One evaluation, profiled: `fjs/ci/module.f.js` interpreted whole by
[`memo`](../memo/README.md) at `2ae0f18`, about 48 s, with Node's CPU
profiler and with a count of each interpreted function's calls and time.
It ran 2,501,232 calls of 493 different functions.

| what | share |
| --- | --- |
| copying a function's body where a closure is made (`func`, [`../value/function`](../value/function/module.f.js)) | 21% |
| garbage collection | 17% |
| the values a call keeps by node, in `memo` | 8% |
| the interpreted reference map | 165 calls, 3 ms |

- **The reference map is nothing here.** It costs what the table above
  says where a program uses it heavily, and this program does not: its
  module initialization does not run the compiler's analysis. No evaluation
  that does has been profiled, the whole compiler's included.
- **The largest single cost was a copy.** A closure's body was copied every
  time the closure was made, so that two functions from one arrow shared no
  node: 760,195 copies for those 493 functions. It followed from a value
  being EDAG, where a node is its identity. The copy is now made where a
  value is analysed or written
  ([`ownBodies`](../value/function/module.f.js)), and the same evaluation
  takes about 17 s where it took about 29 s on the tree before it. The
  shares in the table are of the run before that change.
- **The rest is spread.** No operation of the interpreter stands out beyond
  these, so what emulation costs is not one figure this profile gives. One
  interpreted function, the binary search of
  [`fjs/types/function/compare`](../../types/function/compare/module.f.js),
  is over a third of the interpreted time by itself: it is the program's
  work, made slow by the calls and closures it is written with.

### Options

Three are open, and none is chosen.

| | what a value is | reference map | the other two costs |
| --- | --- | --- | --- |
| Host values, this issue | the host's own; a function is its description | the host's map itself | emulation goes; a call still walks a graph |
| [A map as a value of its own](./reference-map-value.md) | `EdagValue`, with one form more | the host's map inside the value, with its pairs beside it | stay |
| [A store beside the values](./reference-map-store.md) | `EdagValue`, unchanged | the pairs in the value, an index outside it | stay |

The last two keep `EdagValue` and answer the first cost alone. They differ
in where the index is: in the value, which then is no EDAG until it is
normalized, or outside it, where it has to last across invocations and be
found again for an older map. Only the first cost is measured, so the
smaller options also say, once one is timed, how much the other two costs
are.

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

- An interpreter answers `Result<Value, unknown>`, where `Value` is the new
  type, replacing `EdagValue`: host data and function descriptions. What is
  thrown is `unknown`.
- A value the interpreter made is serialized back to EDAG. The interpreter's
  answer is not where the work ends: the linker and every output are
  written over EDAG, so the walk from a value to the graph it is, with a
  value shared by identity written once, is part of the proposal and not an
  option.

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
- **Serializing back to EDAG.** Shared values are found by identity, which
  the reference map gives. Whether the answer is the old `EdagValue` form,
  so that what reads one today is unchanged, or another. A map that was
  used holds what cannot be enumerated: it is refused, or the fold over the
  empty map is kept beside it
  ([the store's third question](./reference-map-store.md)).
- **Types.** `EdagValue` is checked to be a subset of `Exp`
  (`_Subset`), and the value serializer and the function-text renderer rely
  on it. What `Value` is as a type, when a function in it is a host function
  told from a reference map only by what it answers, and what replaces the
  check.
- **Failure.** An operation answers `Result<EdagValue, EdagValue>` today.
  The error side becomes `unknown`: whether that is every value a program
  can throw and nothing else, or also the interpreter's own failures.

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
  took 19 min 25 s at `2ae0f18`. What a call still costs there says whether
  `compiled` is worth an issue of its own.
- [ ] Move the operations, then the interpreters, then the consumers.
- [ ] Write a host value out as EDAG, with sharing kept.
- [ ] Delete [the store issue](./reference-map-store.md) with the pull
  request that makes the map the real one.

### Related

- [A map as a value of its own](./reference-map-value.md) and
  [a store for reference maps](./reference-map-store.md) — the two options
  that keep `EdagValue`.
- [Reference map](../../../spec/built-ins/reference-map/README.md) and its
  [design record](../../../spec/design/object-identity.md#reference-map).
- [`../values.md`](../values.md) — the contracts values keep today.
- [Non-tail interpreter calls](../value/call/todo/non-tail-recursion.md) —
  the host stack a nested call takes today, which the frame stack replaces.
- [`fjs/types/ref_map`](../../types/ref_map/module.f.js) — the map with the
  bound, which the host gives.

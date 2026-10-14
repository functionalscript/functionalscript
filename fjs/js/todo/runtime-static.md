## A static section of the runtime: `Object.is` the first

**Priority:** P2
**Status:** wip — the shape is `sergey-shandar`'s, who approved the
proposal by merging it and asking for the implementation
([#2885](https://github.com/functionalscript/functionalscript/pull/2885));
the member table is nested under `member`, keyed by the global's name

### Problem

[`runtime.md`](./runtime.md) defines the built-in member functions once, in
FunctionalScript, and names its second step without designing it: "the
static-function table — the same split, keyed by global and name". Three
things wait on that step.

The language admits no static function. `Number` and `String` are the
conversions alone, and every other member of a global is refused —
`Number.isInteger` as a `reserved word`, `Object.is` as an unbound name
(`const not found`), since `Object` is not reserved yet. Authored modules
spell what they need as imported helpers
([`doc/CONVERTING.md` §2](../../../doc/CONVERTING.md#2-numberisinteger)):
[`is`](../../types/object/is/module.f.js) for `Object.is`,
[`isInteger`](../../types/number/is_integer/module.f.js) for
`Number.isInteger`, [`bigint`](../../types/bigint/from_number/module.f.js)
for `BigInt(n)`. The helpers are the right answer for a module and the
right body for the runtime: an admitted `Object.is` that did not reuse `is`
would be a second implementation of SameValue, free to drift from the
first, which is what the runtime exists to prevent.

The casing pair, `toLowerCase` and `toUpperCase`, stays native because no
body can build a string from a code unit: `String.fromCharCode` is a
primitive, and until the static section admits one the Unicode casing
table stays rustc's. The number formatters wait on no static function —
`bigint` already converts an integral double exactly, in FunctionalScript,
and the runtime imports helpers as any module does — so they are
`runtime.md`'s batches, not this proposal's.

And the runtime object's shape is the one its first pull request gave it:
a table keyed by receiver type at the top level, with no room for a second
section, so adding one later is a shape break every binding pays.

### Proposal

**Two sections, both keyed by the global's name.** The runtime object
gains a `static` section, and the member table moves under `member`:

```js
import { is } from '../../types/object/is/module.f.js'

export const runtime = {
    static: {
        Object: {
            is,
            '': a => /* Object(a) */,
        },
        isNaN: a => toNumber(a) !== toNumber(a),
    },
    member: {
        Array: {
            map: (self, f) => /* ... */,
        },
        String: {
            startsWith: (self, search, position) => /* ... */,
        },
    },
}
```

`static` is keyed by the global's name as a module spells it. A key holds
either a namespace — an object keyed by member name, `Object.is` — or a
function the global itself is, `isNaN`, and the two are told apart by what
the value is. Inside a namespace the empty key `''` is the global called
as a function: `static.Object['']` is `Object(a)`. A body is the existing
helper where one exists — `is` for `Object.is`, `isInteger` for
`Number.isInteger` — imported, not copied, so the runtime and the module
that imports the helper directly answer alike by construction; a body with
no helper is written in the module, as `isNaN` is above, over `toNumber`,
the module's own `ToNumber` that throws on a bigint as the global `isNaN`
does and `Number(x)` does not. `member` is keyed by the same names —
`Array`, `String`, `Number`, `Object`, `Boolean`, `BigInt`, `Function` —
rather than the `typeof`-style `array` and `string` the first pull request
used, so one global has both halves under one key: `static.Array.isArray`
and `member.Array.map`. A VM maps a receiver's type to that name once,
which is what NaNVM's `type_name` and `nanvm/methods`'s type column
already do under the old spelling; renaming them is part of the first
task. A static body takes the arguments as the call passed them,
positionally, `undefined` past the end, with a rest parameter where the
algorithm tells an omitted argument from an explicit `undefined` or is
variadic — `Math.max`'s values, `String.fromCharCode`'s units — exactly as
a member body does minus the receiver. `static` is a reserved word in
strict-mode binding positions and an ordinary property key, which the
current compiler accepts; the shape above, `''` and the bare `isNaN`
included, compiles today. The nesting and the rename are the first task,
made before the static section exists so that `types.ts`, the executors
and `vm/runtime.rs` read `runtime.member[type][name]` once and never move
again.

**Admission is a list of paths; the namespace is closed.** Which static
names a module may call is a new list beside `js/prototype`, `js/static`'s
`statics`: the admitted paths into the `static` section, each a list of
keys — `[['Object', 'is']]` to start, `[['Object', 'is'], ['Object', ''],
['isNaN']]` as names land. A path's keys are the runtime's: a two-key
path is a namespace's member, a path ending in `''` the global called as
a function, a one-key path a global that is a function, so one
representation names every admitted binding and a VM, the runtime's
`types.ts` and the completeness walk below probe the same object the
same way, by walking the keys, with no second classification of what a
global is. The parser admits a call of a listed path, in every spelling
JavaScript gives the same call: `G.n(args)` and `G['n'](args)`, the
constant key being the same key the property access already treats it
as, and the guarded forms `G?.n(args)`, `G.n?.(args)` and `G?.['n']?.(args)`,
which lower to the same node, since a reserved global and its listed
member are never nullish and a harmless spelling is refused only for a
reason the design has
([DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
It refuses every other member of a reserved global as it refuses
`String.fromCharCode` today (`reserved word`), and a computed key,
`G[k](args)`, since the namespace is closed at compile time and a key
known only at run time cannot be looked up in a list. That is the opposite of the prototype side, where an own-property
call is admitted by default and only a `prohibitedCalls` name is refused:
a global's namespace is closed, so there is no prohibited list, and a name
is admitted a name at a time, each reserving its global no later than it
lands
([`2365-global-names.md`](../../../spec/todo/2365-global-names.md#landing-a-name-at-a-time)).
`Object.is` reserves `Object`, which
[`2360-built-in.md`](../../../spec/todo/2360-built-in.md) ticks as a name
to admit. The conversions `Number(exp)` and `String(exp)` are nodes of
their own already (`['Number', exp]`, `['String', exp]`) and stay so: they
are the floor's `['Number', '']` and `['String', '']`, native by
definition, and need no row. The runtime's `types.ts` pins every path the
`static` section holds against the list, as it pins every `member` key
against `allowedCalls`, so a body for a path the language does not admit
fails `tsc`. A global is not a value: `const f = Object.is` and `Object`
alone stay refused, as `String` is, so a global never reaches a module as
a first-class function. No run-time guard exists for the guarded
spellings, because nothing is guarded. `String?.(x)` stays as the spec
has it, a question for the conversion node, not this one.

**One node, a callee.** The EDAG spells a static function as a value node
carrying its path into the table, `['static', ['Object', 'is']]`,
`['static', ['isNaN']]`, `['static', ['Object', '']]`, as it spells the
language's helper `['entry']`: a function of fixed `length` capturing
nothing, fresh where it stands. The parser emits it only as the callee of
the ordinary call, `['()', ['static', ['Object', 'is']], [a, b]]`, so the
call node, the argument list and spread are the ones every call has, and
a new static name is a row in two tables, not a node kind. The admission
`validate` [`compiler/todo/interpret-edag.md`](../../compiler/todo/interpret-edag.md)
requires enforces both halves on EDAG supplied as data, the one place a
node could enter without a parser: a `static` node whose path is not
listed is rejected, as a prohibited member key is, and so is a `static`
node anywhere but the callee position of a `()` node — a root, an
argument, an element, a captured value — so that no supplied graph makes
a static a first-class value either. The restriction is the node's
placement, which `validate` sees, not the parser's habit.

**Executors answer it as they answer a member.** An executor resolves a
`static` node to its native binding where it has one, else to the entry
at that path in the `static` section of the runtime its context carries,
and calls the body with the arguments. A path with neither is the
executor's error, not the module's: the parser admitted it, so an executor
given no runtime, or one without the body, reports a missing binding the
way the transpiler reports a package without a runtime (`no runtime
export`), never a `TypeError` and never a plausible value. NaNVM gains
`IVm::runtime_static(path)` beside `runtime_method`, which `naive` answers
by walking the compiled object's `static` section; the Rust backend emits
the lookup for a `static` callee; and a body bound this way is exactly the
non-capturing function
[`callable-function-objects.md`](../../../nanvm/lib/todo/callable-function-objects.md)'s
`static function` tag anticipates. The native static table, if NaNVM keeps
one, is an enumerable Rust array of paths like the member tables, and the
completeness test walks `statics` forward — every admitted path answered
natively or by a body — and the native table in reverse.

**The floor grows by the primitives no body can write.** Some static
functions are definitions over the operators, bodies from the first day:
`Object.is`, `Number.isInteger`, `Number.isNaN`, `isNaN`, `Math.max`,
`Math.trunc`, `Math.sign`. One is a primitive a VM must bind natively
because nothing in the language reaches it: `String.fromCharCode`, a
string from a code unit. The transcendental `Math` names — `sin`, `exp`,
`log`, `pow` with a fractional exponent — are neither, and stay refused:
a host engine and a platform `libm` round differently near a boundary,
and a module that serialized differently on two executors would break the
agreement the spec requires of every successful result, so such a name is
admitted only with a body that pins its answer, a correctly rounded
algorithm or a table, and not before. The runtime's README lists each
admitted static path as bodied or native, as it lists the member names,
and a native-only name is absent from the table as a member primitive is.
`Object(a)` is the one `''` whose body needs a decision before it is
admitted: on an object or an array it is the identity, and on a primitive
JavaScript answers a wrapper object the language has no value for, so the
body either throws there or the name is not admitted. The invariant that
keeps the bootstrap acyclic extends by one word: no initializer in the
runtime module's import closure calls a member function or a static
function, which `runtimeAt` checks by interpreting the module under no
runtime; `is` and `isInteger` hold it, since each builds one closure over
the operators.

**Each name is its own admission.** The approval this proposal asks for
covers the mechanism and `Object.is`. Every later static name is an
admission of its own, as [`2360-built-in.md`](../../../spec/todo/2360-built-in.md)
already says of a namespace's members — a decision there, with its
benefits and drawbacks, before its row lands in `statics` — and this
mechanism is what the decision then lands through. `String.fromCharCode`
is the first such decision worth taking, since the casing pair waits on
it; `BigInt`, which 2360 marks not decided, and `Object(a)` are decisions
this proposal does not take.

### Benefits

- One definition of each static function, in FunctionalScript, run by
  every executor and compiled for every target, as the member functions
  have; the existing helpers are the bodies, so a module importing `is`
  and one calling `Object.is` answer alike by construction.
- A familiar JavaScript spelling for what modules already do through
  imported helpers.
- Static calls are closed by a list of paths, so the parser's work is one
  lookup, one representation names every binding, and a VM never sees an
  unadmitted path.
- One key per global across both sections, so a reader finds everything
  `Array` has in two places that share a name.

### Drawbacks

- Reserving `Object`, and each global after it, breaks a module that
  binds the word; `2365-global-names.md` accepts this one name at a time.
- A new node kind, `['static', path]`, with its validation rows, printer
  case, and one more branch in each executor and in the Rust backend.
- Two admission lists where one might do; they stay separate because a
  prototype's names are open by default and a global's are closed, and
  one list cannot say both.
- Nesting the member table under `member` and renaming its keys is a
  shape change the bindings of #2880 pay once, before any consumer exists.

### Tasks

- [x] File this proposal, and obtain approval for the mechanism and
      `Object.is` before the next task.
- [x] Nest the member table under `runtime.member` and key it by the
      global's name: the module, `types.ts`, `edag/value/method`'s `body`,
      `vm/runtime.rs` and `type_name`, `nanvm/methods`'s type column,
      and the README.
- [x] `js/static` with `statics = [['Object', 'is']]` and `isStatic`;
      the `['static', path]` EDAG node in the schema and the types; the
      analysis's binding check, `checked`, refuses an unlisted path and a
      `static` node outside callee position, which the admission
      `validate` of
      [`compiler/todo/interpret-edag.md`](../../compiler/todo/interpret-edag.md)
      composes once it exists.
- [x] `runtime.static.Object.is` as the imported `is`, `types.ts` pinned
      against `statics`, the proof at full coverage; the represented
      executors resolve a `static` node from the runtime, through
      `functionAt`, and fail naming the path without a binding; function
      text spells the node as the source calls it.
- [x] NaNVM: `IVm::runtime_static` and `static_binding`, which fails
      naming the path as the interpreter does; the Rust backend emits the
      lookup; the completeness test checks every admitted path is bound.
      NaNVM keeps no native static table, so there is no reverse walk.
- [ ] The parser admits `Object.is(a, b)`, `Object['is'](a, b)` and the
      guarded spellings as `['()', ['static', ['Object', 'is']], [a, b]]`,
      reserves `Object`, and refuses every other member, a computed key
      and `Object` alone; the FunctionalScript writer spells the node
      back; the spec's reserved-word and built-in sections say so; the
      corpus runs `Object.is` on the interpreter and on NaNVM.
- [ ] Decide `String.fromCharCode` in `2360-built-in.md`; admitted, it is
      the native primitive, and the casing pair follows as bodies over a
      generated casing table.
- [ ] Decide `isNaN`, `Number.isInteger`, `Number.isNaN` and
      `Number.isFinite` there; admitted, their bodies are the helpers, and
      the helper importers `2360-built-in.md` counts are rewritten.

### Related

- [`runtime.md`](./runtime.md) — the member-function section this extends;
  its invariants hold here unchanged.
- [`../runtime/README.md`](../runtime/README.md) — the module, its three
  forms, and how each VM binds it.
- [`2360-built-in.md`](../../../spec/todo/2360-built-in.md) — which globals
  the language is to admit, each member an admission of its own, and the
  `String` conversion's proposal record, the model for this one.
- [`2365-global-names.md`](../../../spec/todo/2365-global-names.md) — why
  a global is reserved no later than any of it is admitted.
- [`doc/CONVERTING.md`](../../../doc/CONVERTING.md) — the helpers modules
  use today in place of `Object.is`, `Number.isInteger` and `BigInt`, and
  the bodies the static section reuses.
- [`nanvm/lib/todo/callable-function-objects.md`](../../../nanvm/lib/todo/callable-function-objects.md)
  — the `static function` tag and `IStaticFunction`.
- [`edag/README.md`](../../edag/README.md#nodes) — `['entry']`, the value
  node `['static', path]` is modelled on, and the call node it is a
  callee of.

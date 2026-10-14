## A static section of the runtime: `Object.is` the first

**Priority:** P2
**Status:** proposed — the shape is `sergey-shandar`'s; the first static
call, `Object.is(a, b)`, is a new language feature and needs explicit
approval from another language designer before its task starts
([DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions))

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
`isInteger` for `Number.isInteger`, `bigint` for `BigInt(n)`, and the
semantics module compares with the host's `Object.is` where the language
has no spelling of its own. The helpers are the right answer for a module
and the wrong place for a definition: an admitted `Object.is` would be
implemented three times, as the member functions were, unless the runtime
holds it.

The member bodies that stay native wait on primitives only a static
function gives: `String.fromCharCode` for `toLowerCase`, `toUpperCase` and
`toWellFormed`; `BigInt` for `toFixed`, `toPrecision`, `toExponential` and
a nondecimal `toString` radix. Until the static section exists, those
names have no body and the casing table stays rustc's.

And the runtime object's shape is the one its first pull request gave it:
a table keyed by receiver type at the top level, with no room for a second
section, so adding one later is a shape break every binding pays.

### Proposal

**Two sections, both keyed by the global's name.** The runtime object
gains a `static` section, and the member table moves under `member`:

```js
export const runtime = {
    static: {
        Object: {
            is: (a, b) => a === b ? a !== 0 || 1 / a === 1 / b : a !== a && b !== b,
            '': a => /* Object(a) */,
        },
        isNaN: a => /* isNaN(a) */,
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
as a function: `static.Object['']` is `Object(a)`, `static.BigInt['']`
would be `BigInt(n)`. `member` is keyed by the same names — `Array`,
`String`, `Number`, `Object`, `Boolean`, `BigInt`, `Function` — rather
than the `typeof`-style `array` and `string` the first pull request used,
so one global has both halves under one key: `static.Array.isArray` and
`member.Array.map`. A VM maps a receiver's type to that name once, which
is what NaNVM's `type_name` and `nanvm/methods`'s type column already do
under the old spelling; renaming them is part of the first task. A static
body takes the arguments as the call passed them, positionally,
`undefined` past the end, with a rest parameter where the algorithm tells
an omitted argument from an explicit `undefined`, exactly as a member body
does minus the receiver. `static` is a reserved word in strict-mode
binding positions and an ordinary property key, which the current compiler
accepts; `Object.is`'s body above compiles today and answers `false` for
`(-0, 0)` through `fjs compile`. The nesting and the rename are the first
task, made before the static section exists so that `types.ts`, the
executors and `vm/runtime.rs` read `runtime.member[type][name]` once and
never move again.

**Admission is a list; the namespace is closed.** Which static names a
module may call is a new list beside `js/prototype`, `js/static`'s
`statics`: an object keyed by global, each a list of admitted keys,
`''` for the global called as a function — `{ Object: ['is'] }` to start,
`{ Object: ['is', ''], isNaN: [''], BigInt: [''] }` as names land. The
parser admits `G.n(args)` where `n` is on `G`'s list, `G(args)` where
`''` is, and refuses every other member of a reserved global as it refuses
`String.fromCharCode` today (`reserved word`). That is the opposite of the
prototype side, where an own-property call is admitted by default and
only a `prohibitedCalls` name is refused: a global's namespace is closed,
so there is no prohibited list, and a name is admitted a name at a time,
each reserving its global no later than it lands
([`2365-global-names.md`](../../../spec/todo/2365-global-names.md#landing-a-name-at-a-time)).
`Object.is` reserves `Object`, which
[`2360-built-in.md`](../../../spec/todo/2360-built-in.md) ticks as a name
to admit. The conversions `Number(exp)` and `String(exp)` are nodes of
their own already (`['Number', exp]`, `['String', exp]`) and stay so: they
are the floor's `static.Number['']` and `static.String['']`, native by
definition, and need no row. The runtime's `types.ts` pins every `static`
key against the list, as it pins every `member` key against
`allowedCalls`, so a body for a name the language does not admit fails
`tsc`. Nothing else is a value: `const f = Object.is`, `Object` alone and
`Object.is?.(a, b)` stay refused, as `String` and `String?.(x)` are, so a
global never reaches a module as a first-class function and no optional
call needs a guard.

**One node, a callee.** The EDAG spells a static function as a value node
carrying its path into the table, `['static', ['Object', 'is']]`,
`['static', ['isNaN']]`, `['static', ['Object', '']]`, as it spells the
language's helper `['entry']`: a function of fixed `length` capturing
nothing, fresh where it stands. The parser emits it only as the callee of
the ordinary call, `['()', ['static', ['Object', 'is']], [a, b]]`, so the
call node, the argument list and spread are the ones every call has, and
a new static name is a row in two tables, not a node kind. The admission
`validate` [`compiler/todo/interpret-edag.md`](../../compiler/todo/interpret-edag.md)
requires rejects a `static` node whose path is not on the list, as it
rejects a prohibited member key, the one place such a path could enter
without a parser.

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
one, is an enumerable Rust array like the member tables, and the
completeness test walks the `statics` list forward — every admitted path
answered natively or by a body — and the native table in reverse.

**The floor grows by the primitives no body can write.** Some static
functions are definitions over the operators: `Object.is` above,
`Number.isInteger` as `typeof n === 'number' && n % 1 === 0`,
`Number.isNaN`, `isNaN` as `Number(a) !== Number(a)`, `Math.max`,
`Math.trunc`, `Math.sign`. Others are primitives a VM must bind natively
because nothing in the language reaches them: `String.fromCharCode`, a
string from a code unit; `BigInt`, a bigint from a number; the
transcendental `Math` names, whose answers are the platform's `libm` until
a body pins them. The runtime's README lists each admitted static path as
bodied or native, as it lists the member names, and a native-only name is
absent from the table as a member primitive is. `Object(a)` is the one
`''` whose body needs a decision before it is admitted: on an object or
an array it is the identity, and on a primitive JavaScript answers a
wrapper object the language has no value for, so the body either throws
there or the name is not admitted. The invariant that keeps the bootstrap
acyclic extends by one word: the runtime module's own initialization
calls no member function and no static function, so it is always
compiled with no runtime.

**What the first body unlocks.** `Object.is` needs nothing and settles the
`-0` and `NaN` questions a module asks today through `1 / x`.
`String.fromCharCode` as a native primitive is the next admission, since
it is what `toLowerCase`, `toUpperCase` and `toWellFormed` wait on; with
it those three leave the native member tables, and the Unicode casing
table becomes a `gen.*` module from the data files, pinned in this
repository. `BigInt(n)`, the first `''`, follows for the number
formatters.

### Benefits

- One definition of each static function, in FunctionalScript, run by
  every executor and compiled for every target, as the member functions
  have; no third implementation per name.
- A familiar JavaScript spelling for what modules already do through
  imported helpers; `isInteger` and `bigint` become bodies rather than
  substitutes.
- The member bodies that wait on `String.fromCharCode` and `BigInt` can
  land, and the casing table leaves rustc's standard library.
- Static calls are closed by a list, so the parser's work is one lookup
  and a VM never sees an unadmitted path.
- One key per global across both sections, so a reader finds everything
  `Array` has in two places that share a name.

### Drawbacks

- Reserving `Object`, and each global after it, breaks a module that
  binds the word; `2365-global-names.md` accepts this one name at a time.
- A new node kind, `['static', path]`, with its validation row, printer
  case, and one more branch in each executor and in the Rust backend.
- Two admission lists where one might do; they stay separate because a
  prototype's names are open by default and a global's are closed, and
  one list cannot say both.
- Nesting the member table under `member` and renaming its keys is a
  shape change the bindings of #2880 pay once, before any consumer exists.

### Tasks

- [ ] File this proposal, and obtain approval from another language
      designer for the static call before the next task.
- [ ] Nest the member table under `runtime.member` and key it by the
      global's name: the module, `types.ts`, `edag/value/method`'s `body`,
      `vm/runtime.rs` and `type_name`, `nanvm/methods`'s type column,
      and the README.
- [ ] `js/static` with `statics = { Object: ['is'] }`; the parser admits
      `Object.is(a, b)` as `['()', ['static', ['Object', 'is']], [a, b]]`,
      reserves `Object`, and refuses every other member, `Object` alone
      and `Object.is?.()`; the spec's reserved-word and built-in sections
      say so; `validate` rejects an unlisted `static` path.
- [ ] `runtime.static.Object.is`, `types.ts` pinned against `statics`,
      the proof at full coverage; the executors resolve a `static` node
      natively or from the runtime and report a missing binding as the
      executor's error.
- [ ] NaNVM: `IVm::runtime_static`, the backend emits the lookup, the
      completeness test covers the static paths both ways; the corpus
      runs `Object.is`.
- [ ] `String.fromCharCode` as a native primitive, then the casing pair
      and `toWellFormed` as bodies over a generated casing table.
- [ ] `BigInt(n)`, the first `''`, then the number formatters as bodies.
- [ ] `isNaN`, `Number.isInteger`, `Number.isNaN`, `Number.isFinite` as
      bodies; rewrite the helper importers `2360-built-in.md` counts.

### Related

- [`runtime.md`](./runtime.md) — the member-function section this extends;
  its invariants hold here unchanged.
- [`../runtime/README.md`](../runtime/README.md) — the module, its three
  forms, and how each VM binds it.
- [`2360-built-in.md`](../../../spec/todo/2360-built-in.md) — which globals
  the language is to admit, and the `String` conversion's proposal record,
  the model for this one.
- [`2365-global-names.md`](../../../spec/todo/2365-global-names.md) — why
  a global is reserved no later than any of it is admitted.
- [`doc/CONVERTING.md`](../../../doc/CONVERTING.md) — the helpers modules
  use today in place of `Number.isInteger` and `BigInt`.
- [`nanvm/lib/todo/callable-function-objects.md`](../../../nanvm/lib/todo/callable-function-objects.md)
  — the `static function` tag and `IStaticFunction`.
- [`edag/README.md`](../../edag/README.md#nodes) — `['entry']`, the value
  node `['static', path]` is modelled on, and the call node it is a
  callee of.

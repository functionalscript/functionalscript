## Enumerable Property Presence

**Priority:** P2
**Status:** wip

### Decision

The `entry` helper answers presence and value at once. It returns the
enumerable own property `b` names of `a` as an **option**: a one-element
array holding the value, or an empty array where there is none.

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? [x.value] : [];
};
```

Its type is `Option<T>` from
[`fjs/types/option/types.ts`](../../fjs/types/option/types.ts),
`readonly [T] | readonly []`. `{ x: undefined }` and `{}` come apart,
`[undefined]` against `[]`, which is the distinction
[undefined-valued properties](./1010-undefined-property.md) keeps visible.

This replaces two things at once: the current `entry`, which returns the
value and answers `undefined` alike for an absent key and for an entry
holding `undefined`; and the separate presence helper this file proposed
before, `hasEntity` (raw flag or boolean, the choice it left open). One
helper, one EDAG node, one question — the entry, if any — and a
value-or-fallback read costs one lookup, not two. Approved by the language
designer, Sergey Shandar, on the pull request for this file:
["Design is approved!"](https://github.com/functionalscript/functionalscript/pull/3023#issuecomment-6245721352)
([design principles §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).

An option that is an array composes with arrays and their methods without a
wrapper, which is why it is one and not `undefined` or `{ value }`:

```js
entry(o, k)[0]                          // the value, `undefined` where absent: the old read
entry(o, k).length === 1                // presence
const [v] = entry(o, k)                 // destructured, `undefined` where absent
[...entry(o, k), fallback][0]           // value or fallback, one lookup
keys.flatMap(k => entry(o, k))          // the values present, in key order
```

| Input | Result |
|-------|--------|
| `entry({ x: 7 }, "x")` | `[7]` |
| `entry({ x: undefined }, "x")` | `[undefined]` |
| `entry({}, "x")`, `entry({}, "toString")` | `[]` |
| `entry([7], 0)`, `entry([7], "0")`, `entry("ab", 1)` | `[7]`, `[7]`, `["b"]` |
| `entry([], "length")`, `entry("ab", "length")`, `entry(f, "name")` | `[]` |
| `entry(5, "x")`, `entry(true, "0")`, `entry(5n, "x")` | `[]` |
| `entry(null, "x")`, `entry(undefined, "x")` | failure |

The key converts as `Object.getOwnPropertyDescriptor` converts it, as
today; a receiver or a conversion not yet supported is refused, not answered
with an invented value. Each call returns a fresh array, as the JavaScript
body does.

### Why the option

Pluses:

- **One lookup for every question.** Value, presence, and value-or-default
  are each one call: `entry(o, k)[0]`, `entry(o, k).length === 1`,
  `[...entry(o, k), d][0]`. With a separate `hasEntry`, a default that
  respects a stored `undefined` is `hasEntry(o, k) ? entry(o, k) : d`, two
  lookups where one is enough — and a lookup is a linear scan of the
  property list in NaNVM and in the EDAG executors, which nothing recovers:
  calls are never merged as shared nodes. A cost built into an API outlives
  every optimization; this one is never paid.
- **No lie.** `[undefined]` is an entry holding `undefined` and `[]` is no
  entry, where a value read answered `undefined` for both.
- **A type that already exists, in a shape that composes.** `Option<T>` is
  an array, so `flatMap`, spread, destructuring and `.length` work on it
  with no vocabulary of their own.
- **The smallest change.** One recognized body, one EDAG node, one VM
  method, one function text, each differing from today's by the wrapping
  alone; nothing receiver-dependent is exposed, as the descriptor would.

Minuses:

- **The common read carries a tail.** Most code wants the value and writes
  `entry(o, k)[0]`, which also discards the distinction the option keeps —
  so most readers pay a tail for information they drop. The tail is a
  constant-key read of a one-element array, the cheapest read there is, and
  a library reader can smooth it if it grates; a second primitive cannot
  be smoothed away later.
- **A fresh array per read.** One small allocation in NaNVM; on a
  JavaScript host the former body already allocated a descriptor per read,
  so nothing is added there.
- **Presence reads as a length.** `.length === 1` is less direct than a
  boolean.
- **Breaking.** Every importer is rewritten, and the former body is no
  longer the helper.

Selected because the pluses are semantics and cost fixed by the API, which
no later work can change, while the minuses are syntax and a constant
allocation, which later work can. One primitive that is never a trap is the
simpler API ([§1](../../doc/DESIGN.md#1-simplicity-first)), and the API is
what quality is measured by.

### Alternatives rejected

| Alternative | Why not |
|---|---|
| `hasEntity(a, b)`, `Object.getOwnPropertyDescriptor(a, b)?.enumerable` | A second helper beside `entry`; `true`/`false`/`undefined` leaks the own-but-not-enumerable case (`length`) the language otherwise hides; a value-or-fallback read is two lookups |
| `hasEntry(a, b)`, the same `=== true` | Two helpers for one question; two lookups |
| The descriptor itself, `x?.enumerable ? x : undefined` | Exposes `writable` and `configurable`, which vary by receiver — a string's code unit is `writable: false, configurable: false` where an array's element is `true` — mutability flags the language has no word for and every VM would reproduce |
| `{ value: x.value }` or `undefined` | A shape of our own, or a nullish, that no array method takes; `Option<T>` already exists and is an array |
| `Object.hasOwn`, `obj.hasOwnProperty`, `in` | Unchanged: prohibited, each answering a different question — a non-enumerable own property or the prototype chain ([the `in` decision](./2346-in-operator.md)) |

### Breaking change

The body the compiler recognizes today,
`return x?.enumerable ? x.value : undefined;`, is no longer the helper: a
function spelling it is an ordinary function, in which `Object` is refused
at the word as everywhere else. The EDAG node stays `['entry']`, with the
new meaning; its function text, `String(entry)`, changes with it, so the
writers, the Rust printer and NaNVM's `Any::entry` change in the same pull
request. The helper written once in
[`fjs/types/object/entry`](../../fjs/types/object/entry/module.f.js) is
rewritten, every importer with it, and the compatibility re-export
[`fjs/js/entry`](../../fjs/js/entry/module.f.js) is deleted. Migration:
`entry(a, b)` becomes `entry(a, b)[0]`, and `entry(a, b) !== undefined`
becomes `entry(a, b).length === 1` — which also tells an entry holding
`undefined` from no entry, where the old test could not.

### Recognition and execution

As today
([statement-aware AST recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)):
the function is matched whole on the syntax tree with its names resolved,
`Object` the reserved global no scope binds, and a parsed descriptor outside
the pattern stays refused. Receiver and key conversion are the ones the
current helper has; only the result is wrapped.

### Tasks

- [x] Withdraw direct `Object.hasOwn` recognition and its proposed
      enumerability reinterpretation; record the source prohibition.
- [x] Decide the helper: `entry` returns `Option<T>`, no separate presence
      helper; correct every `todo/` that described `hasEntity`.
- [ ] Compiler: recognize the new body and refuse the old; the AST and EDAG
      documentation of `['entry']`; the parser, EDAG and compiler proofs.
- [ ] Executors and writers: `fjs/edag/value/property`'s `entry` returns the
      option; the function text in `fjs/compiler/serializer/function_text`
      and the FunctionalScript output; the Rust printer's text.
- [ ] NaNVM: `Any::entry` returns an `Array`; the harness fixtures
      (`entry.mjs`, `parity.mjs`) and the corpus; `npm run gen`.
- [ ] The helper module `fjs/types/object/entry`, its `types.ts` and proof;
      rewrite every importer; delete `fjs/js/entry`.
- [ ] Specification: [reading an entry](../property-access/entries.md) and
      its demo program, [`in`](../operators/in.md),
      [CONVERTING.md](../../doc/CONVERTING.md), `fjs/edag/README.md`,
      `nanvm/lib/README.md`; tick the related `todo/`s and delete this file.

### Related

- [Reading an entry at run time](../property-access/entries.md) — the helper as it is today.
- [The `in` decision](./2346-in-operator.md).
- [Undefined-valued properties](./1010-undefined-property.md) and
  [their representation](./1015-undefined-property-vm-layer.md) — the
  option's `[undefined]` is an observation a representation must preserve.
- [Built-ins](./2360-built-in.md) — prohibited reflection and pattern-only access.
- [PR #1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — historical `in`/`hasOwn` discussion, superseded by the decision above.

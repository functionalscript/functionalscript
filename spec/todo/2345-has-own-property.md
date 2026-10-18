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
designer in the session the pull request for this file links
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
- [x] Compiler: recognize the new body and refuse the old; the AST and EDAG
      documentation of `['entry']`; the parser, EDAG and compiler proofs.
- [x] Executors and writers: `fjs/edag/value/property`'s `entry` returns the
      option; the function text in `fjs/compiler/serializer/function_text`
      and the FunctionalScript output; the Rust printer's text.
- [x] NaNVM: `Any::entry` returns an `Array`; the harness fixtures
      (`entry.mjs`, `parity.mjs`) and the corpus; `npm run gen`.
- [x] The helper module `fjs/types/object/entry`, its `types.ts` and proof;
      rewrite every importer; delete `fjs/js/entry`.
- [x] Specification: [reading an entry](../property-access/entries.md) and
      its demo program, [`in`](../operators/in.md),
      [CONVERTING.md](../../doc/CONVERTING.md), `fjs/edag/README.md`,
      `nanvm/lib/README.md`.
- [ ] Tick the related `todo/`s and delete this file.

### Related

- [Reading an entry at run time](../property-access/entries.md) — the helper, as implemented.
- [The `in` decision](./2346-in-operator.md).
- [Undefined-valued properties](./1010-undefined-property.md) and
  [their representation](./1015-undefined-property-vm-layer.md) — the
  option's `[undefined]` is an observation a representation must preserve.
- [Built-ins](./2360-built-in.md) — prohibited reflection and pattern-only access.
- [PR #1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — historical `in`/`hasOwn` discussion, superseded by the decision above.

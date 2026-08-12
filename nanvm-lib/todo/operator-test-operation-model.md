## operator-test-operation-model. Describe operations by syntax and arity

**Priority:** P3
**Status:** open

### Problem

The shared operator corpus in `fjs/nanvm/` currently uses implementation-style
names such as `unaryPlus`, `unaryMinus`, and `mul`:

```ts
export type Op = 'unaryPlus' | 'unaryMinus' | 'mul' | 'stringCoercion'
```

`Case.args` is also just `readonly Value[]`, so the type system does not connect
an operation with its number of arguments. A unary operation can therefore be
given two arguments, or a binary operation one argument, without a type error.

The shared corpus should describe the JavaScript operation itself rather than
the identifier chosen by a particular proof or code generator. Consumer-specific
names such as Rust function names and diagnostic case labels belong in the
consumer.

This follows the post-merge review discussion on #1489:

- use operation spellings such as `+`, `-`, and `*` instead of `unaryPlus`,
  `unaryMinus`, and `mul`;
- associate every operation with its arity and use that arity to type its cases.

### Proposal

Represent an operation as a small immutable tuple containing its semantic name
and argument count:

```ts
export type Operation<N extends number = number> =
    readonly [name: string, argsN: N]
```

The corpus can then describe operations along these lines:

```ts
['+', 1]
['-', 1]
['*', 2]
['String', 1]
```

The arity disambiguates operations that share syntax, such as unary `+` and a
future binary `+`. The tuple also keeps the shared data compact: an operation is
just a semantic descriptor, not an object with independently mutable fields.

Make `Case` generic over the argument count and use the existing fixed-length
array machinery (`Tuple<N, T>`) so an operation's cases have exactly the right
number of arguments:

```ts
export type Case<N extends number> = {
    readonly args: Tuple<N, Value>
    readonly expected: Value
    readonly rust?: string
}
```

Do not store a `name` on each case. The inputs, operation, and expected result
already contain enough information to generate a useful semantic diagnostic.
For example, an ordinary binary case can be rendered as:

```text
2 + 2 === 4
```

Prefer such semantic expressions over positional labels such as `case17`.
The renderer must still describe the comparison truthfully for special values:
when the proof relies on `Object.is` semantics (for example `NaN` or `-0`), use
an explicit `Object.is(...)` form rather than a misleading `===` expression.
Throwing cases should likewise get an explicit generated form such as
`+0n throws`.

FunctionalScript can use this generated expression directly as the emergent-test
proof key. The Rust generator should reuse the same semantic expression in
assertion diagnostics so a failure identifies the exact case without a stored
name. Under the current Rust test layout, generated cases are statements inside
generic group functions rather than individual `#[test]` functions, and Rust
function identifiers cannot literally be expressions such as `2 + 2 === 4`.
Do not restructure the Rust harness solely to turn each expression into a test
function name; keep the exact expression in the assertion diagnostic. A future
test-layout change may additionally derive a valid Rust identifier from it if
that becomes useful.

Groups must preserve the operation's literal arity so their cases are typed as
`Case<O[1]>`, where element `1` is the operation's `argsN`. The exact TypeScript
shape may use generic groups or separate unary/binary group types; the important
invariant is that invalid case arity is rejected statically.

`commutative` only makes sense for binary operations. Prefer a type shape where
it is available only for binary groups rather than a general optional property.

The JavaScript proof and Rust printer should translate the semantic operation
into their own implementation. In particular, the Rust printer must not derive
Rust identifiers by applying `snakeCase` to punctuation such as `+`; it should
own an explicit mapping from an operation plus arity to the Rust expression and,
when needed, generated function name.

Do not broaden this task into making strict equality (`===`) use the generic
`Group` representation. `Eq` has shared-reference requirements today; it can be
unified later if doing so becomes clearly useful. Its existing case representation
is therefore outside this task as well.

### Tasks

- [ ] Replace the current string-union `Op` model with `readonly [name, argsN]`
      operations carrying a semantic name and literal argument count.
- [ ] Make `Case` generic over argument count, remove its stored `name`, and
      type `args` as a fixed-length tuple.
- [ ] Generate semantic case expressions from the operation, arguments, and
      expected result instead of storing case names in the shared corpus.
- [ ] Use generated semantic expressions as FunctionalScript proof keys and in
      Rust assertion diagnostics; handle `Object.is`-sensitive and throwing
      cases explicitly.
- [ ] Make each group's cases derive their argument count from `operation[1]`.
- [ ] Restrict `commutative` to binary groups.
- [ ] Update `fjs/nanvm/module.f.mjs` to use semantic operation descriptions and
      unnamed cases.
- [ ] Update `fjs/nanvm/proof.f.mjs` to dispatch on the semantic operation and
      arity and generate semantic leaf names.
- [ ] Update `fjs/nanvm/rust/module.f.mjs` to map semantic operations to Rust
      syntax, generated identifiers, and assertion diagnostics without leaking
      those identifiers into the shared data.
- [ ] Add type-level coverage proving that wrong argument counts are rejected.
- [ ] Regenerate `nanvm-lib/tests/test/generated.rs` and keep the generated test
      behavior unchanged.
- [ ] Run `npx tsc`, `fjs test`, `npm run ci-update`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- #1489 — introduced the shared operator corpus.
- #1489 review: https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770780551
- #1489 review: https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770797058

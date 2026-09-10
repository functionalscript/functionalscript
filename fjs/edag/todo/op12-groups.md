## Op12 groups: `+` and `-` at both arities

**Priority:** P2
**Status:** open

### Problem

The EDAG spells negation `neg` rather than `-`, and has no unary `+` at all.
Both come from one rtti limitation that no longer exists.

[`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
("Negation is a word tag") records why `-` was not reused at unary arity: rtti
tuples had open trailing positions, so `['-', a]` also matched `['-', a, b]`
and a tuple-typed `or` had to be ordered to tell them apart. Tuples are closed
now — `validate` answers by length as well as by tag
([`fjs/rtti/validate/module.f.mjs`](../../rtti/validate/module.f.mjs), "Structs
and tuples are closed") — and the chain vocabulary already relies on exactly
this overloading: `['|()', exp]` and `['|()', exp, k]` share a tag and differ
only in arity, pinned by `endingIsTheShorterArity` in
[`proof.f.mjs`](../proof.f.mjs). The reason for `neg` is gone; the tag stays
only because nothing revisited it.

Unary `+` was then excluded on top of that: with `-` already a word tag, a
unary `+` would have needed one too, and `Number` was preferred as the
language's coercion form. That is still the right call for
**FunctionalScript** — the language need not parse `+x` — but it does not
follow that the EDAG cannot spell it. The EDAG is the pure core that
FunctionalScript is a syntactic subset of (see
[`../README.md`](../README.md)); an operation belongs in it when its result is
a pure function of its operands, and which of those operations
FunctionalScript admits as syntax is a separate decision recorded in
[`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md).

The shared operator corpus pays for the gap today. `unaryPlus` is a
`NonEdagGroup` in [`fjs/nanvm/types.ts`](../../nanvm/types.ts), so all 26 of
its cases take the corpus's escape path — the operation applied to built
values rather than an expression validated against the schema — and the
corpus keeps a NaNVM-only name (`nanvmOp: 'unaryPlus'`) beside the canonical
ids precisely because no canonical id exists.

### Proposal

A third operation vocabulary, `Op12Id`, for the tags that are legal at both
arities. `Op1Id`, `Op2Id`, and `Op12Id` stay pairwise disjoint, so every
consumer that asks "which vocabulary is this id in" keeps working for the
first two, and `Op12` is the one place where the id fixes nothing and the
node's length does.

**In `fjs/edag`:**

- `Op12Id = '+' | '-'`. `neg` leaves `Op1Id`; `+` and `-` leave `Op2Id`.
- `Op12 = readonly ['+' | '-', Exp] | readonly ['+' | '-', Exp, Exp]`, added
  to `Exp` in [`types.ts`](../types.ts), and the schema as
  `or([op12Id, exp], [op12Id, exp, exp])` in [`module.f.mjs`](../module.f.mjs).
  Closed tuples make the two arms exact; no alternative order is load-bearing.
- [Amnesia](../amnesia/module.f.mjs) dispatches on tag, then on length:
  `['-', a]` negates, `['-', a, b]` subtracts, `['+', a]` is JS unary plus,
  `['+', a, b]` adds. Unary `+` keeps JS semantics and so **throws on a
  bigint**; it is a different operation from `Number`, not a second spelling
  of it, and its JSDoc says so beside `Number`'s.
- The "Negation is a word tag" paragraph in
  [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) is
  rewritten to record the opposite: tags follow their JS spelling, and `Op12`
  is where arity is decided by the node rather than the id. Its operators
  table gains `+` at arity 1, and the "no unary `+`" notes there and in
  "Number" become "not FunctionalScript syntax; see 2340-operators".

**In `fjs/nanvm`:**

- `Group12`, discriminated by an explicit arity because the id no longer
  carries one:

  ```ts
  type Group12 =
      | { readonly op: Op12Id; readonly arity: 1; readonly cases: readonly Case<1>[] }
      | { readonly op: Op12Id; readonly arity: 2; readonly cases: readonly Case<2>[] }
  ```

  The field is honest rather than redundant: everywhere else the operand
  count *is* which vocabulary the id belongs to, and
  [`README.md`](../../nanvm/README.md)'s "Arity is not an annotation" paragraph
  gains this one exception.
- `arityOf` reads `g.arity` when present and falls back to the vocabulary
  check otherwise. `caseExp` keeps its runtime shape — it already builds the
  node from `arityOf`'s answer — but not its types: the constructed node
  becomes `Op1 | Op2 | Op12`, and its two casts widen to `Op1Id | Op12Id` and
  `Op2Id | Op12Id`, since an `Op12Id` is legal at either count and the old
  casts to `Op1Id`/`Op2Id` would be false for one.
- The `neg` group becomes `{ op: '-', arity: 1 }` and the `unaryPlus` group
  moves off `NonEdagGroup` onto `{ op: '+', arity: 1 }`. The `'unaryPlus'`
  arm of `NonEdagGroup` and `OpId`'s member for it are deleted. `ternary` and
  `typeof` remain there until
  [ternary-conditional-node](./ternary-conditional-node.md) and
  [typeof-operator](./typeof-operator.md) land, so the escape path itself
  stays for now; this change retires 26 of its cases and the last invented
  operator tag.
- The proof's `op1Js`/`op2Js` and the printer's `op1Rust`/`op2Rust` are
  already separate tables per arity, so `'-'` and `'+'` can appear in both
  with no collision. Two things key on the bare id and need an arity-aware
  key for `Op12` groups: the proof's test-object keys (`proof` and
  `crossCheck` in [`proof.f.mjs`](../../nanvm/proof.f.mjs), built from
  `opId(g)`) and the printer's `rustName`. Give the key one owner — a
  `groupKey` beside `opId` in [`module.f.mjs`](../../nanvm/module.f.mjs) —
  so the JavaScript and Rust names cannot diverge, the same rule `orders`
  follows for the `Swapped` suffix. The spelling is observable — it is a test
  name and a `rustName` key — so it is fixed here rather than left to the
  implementation: an `Op12` group's key is its tag, a slash, and its arity —
  `'+/1'`, `'-/1'`, `'+/2'`, `'-/2'` — and every other group's key is its
  `opId` unchanged, so no existing proof or Rust-name key moves.
- `rustName` keeps mapping the unary groups to `neg` and `unary_plus`, so
  `nanvm-lib/tests/test/generated.rs` is **byte-identical** after
  `npm run gen`. That is the acceptance check for the whole change: the
  corpus's meaning moved, its output did not.

**Two consequences to accept up front:**

- Renaming `neg` to `-` changes the structural identity of every graph that
  contains a negation, and `Op1Id` losing a member is a breaking change to
  the published type-level API. Nothing persists an EDAG yet, so the cost
  today is a changelog entry; it grows once
  [cache-compiled-modules](../../djs/todo/cache-compiled-modules.md) lands,
  which is a reason to do this first.
- [`nanvm-lib/todo/replace-unary-plus-with-number.md`](../../../nanvm-lib/todo/replace-unary-plus-with-number.md)
  proposed dropping `Any::unary_plus` and moving the corpus group to
  `Number`. Under this issue `Any::unary_plus` stays as the implementation
  of `['+', x]`, and that issue shrinks to what is still missing: the real
  `Number(x)` coercion with its `BigInt → f64` conversion. It has been
  amended to say so.

### Tasks

- [ ] `fjs/edag/types.ts`: add `Op12Id` and `Op12`, fold `Op12` into `Exp`,
      remove `neg` from `Op1Id` and `+`/`-` from `Op2Id`.
- [ ] `fjs/edag/module.f.mjs`: `op12Id` and `op12` in the schema, into
      `exp`'s `or`; move the `neg` JSDoc to the new vocabulary and document
      unary `+` against `Number`.
- [ ] `fjs/edag/proof.f.mjs`: update `op1Ids`; the "extra operand" negative
      test currently written over `neg` moves to a strictly unary id, and
      `Op12` gets its own pins — both arities accepted, `['-']` and
      `['-', 1, 2, 3]` refused.
- [ ] `fjs/edag/amnesia/module.f.mjs` and its proof: length dispatch for
      `'+'` and `'-'`; a unary `+` bigint case that throws; the
      `_NegIsOp1` assertion becomes an `Op12` one.
- [ ] `fjs/edag/README.md`: the node table and the vocabulary sentence.
- [ ] `todo/edag-stage1-discussion.md`: rewrite "Negation is a word tag"
      and the operators table.
- [ ] `fjs/nanvm/types.ts`: `Group12`; delete the `'unaryPlus'`
      `NonEdagGroup` arm; extend the `Case<N>`/`Group` assertions to the two
      `Group12` arms.
- [ ] `fjs/nanvm/module.f.mjs`: `arityOf` reads `arity`; `caseExp`'s node
      type and casts admit `Op12`; `groupKey` with the four keys above; move
      the two groups.
- [ ] `fjs/nanvm/proof.f.mjs`: `'-'` and `'+'` entries in `op1Js`; test
      objects keyed by `groupKey`.
- [ ] `fjs/nanvm/rust/module.f.mjs` and `rust/proof.f.mjs`: `op1Rust`
      entries for `'-'` and `'+'`; `rustName` keyed by `groupKey`, still
      naming `neg` and `unary_plus`; pinned `nodeExpr` snippets over `['-', 1]`
      instead of `['neg', 1]`.
- [ ] `fjs/nanvm/README.md`: the "Arity is not an annotation" paragraph, the
      `neg` mentions, and the `unaryPlus` exception paragraph.
- [ ] `npm run gen`: `nanvm-lib/tests/test/generated.rs` unchanged.
- [ ] Changelog entry for `fjs/edag` (breaking: `neg` renamed to `-`,
      `Op1Id`/`Op2Id` members moved to `Op12Id`).
- [ ] `tsc`, `fjs test`, `node --test`, `cargo test`,
      `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) —
  "Negation is a word tag": the rtti reason this issue retires.
- [`fjs/rtti/validate/module.f.mjs`](../../rtti/validate/module.f.mjs) —
  "Structs and tuples are closed": why the reason no longer holds.
- [`fjs/nanvm/README.md`](../../nanvm/README.md) — "The operations come from
  EDAG": the arity-from-vocabulary rule this adds an exception to.
- [replace-unary-plus-with-number](../../../nanvm-lib/todo/replace-unary-plus-with-number.md)
  — narrowed by this issue to adding `Number(x)`.
- [ternary-conditional-node](./ternary-conditional-node.md),
  [typeof-operator](./typeof-operator.md) — the two `NonEdagGroup` arms that
  remain after this one.
- [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md) —
  where FunctionalScript's own operator subset is decided; unary `+` is not
  added there by this issue.

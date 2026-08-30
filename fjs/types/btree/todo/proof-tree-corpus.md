## proof-tree-corpus. Table-drive the B-tree proofs and share their fixture

**Priority:** P3
**Status:** open

### Problem

The four B-tree proofs test one data structure with one corpus — the squares
of `2..n` inserted into `['1']` — and each of them rebuilds the scaffolding for
it from scratch.

#### 1. 29 copies of one test case

`fjs/types/btree/set/proof.f.mjs` is 394 lines, of which 57 carry expected
values and almost all the rest is the same six lines repeated for
`n = 10 … 38` (`:17-352`):

```ts
() => {
    let _map: TNode<string> = ['1']
    for (let i = 2; i <= 10; i++)
        _map = set(_map)((i * i).toString())
    const r = jsonStr(_map)
    assertEq(r, '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]')
},

() => {
    let _map: TNode<string> = ['1']
    for (let i = 2; i <= 11; i++)
        _map = set(_map)((i * i).toString())
    const r = jsonStr(_map)
    assertEq(r, '[[["1"],"100",["121"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]')
},
```

…and 27 more. Between consecutive cases exactly two tokens change: the bound
`n` and the expected string. The expected strings are genuinely different — a
B-tree reshapes as it grows, and that reshaping is what the proof exists to pin
down — but they are *data*, and here they are embedded one per hand-written
function.

The cost is not only length. Adding `n = 39` means writing a seventh copy of
the scaffold; a reader checking "at which insert does the root split?" has to
scan 29 near-identical blocks for the two tokens that differ; and the sequence
of expected values — the actual subject of the test — cannot be read as a
sequence because it is interleaved with 174 lines of boilerplate.

#### 2. The fixture helpers are re-declared in all four proofs

```ts
// fjs/types/btree/proof.f.mjs:17-19, find/proof.f.mjs:12-14,
// set/proof.f.mjs:8-10, remove/proof.f.mjs:9-11 — four copies
const set = (node: TNode<string>) => (value: string) =>
    setSet(cmp(value))(() => value)(node)
```

Each also binds its own `jsonStr = stringify(sort)`, and **all four** open-code
the squares loop `_map = set(_map)((i * i).toString())` — `set/proof.f.mjs` 31
times, `remove/proof.f.mjs:22` (`n = 38`) and `:379` (`n = 10`),
`find/proof.f.mjs:26` (`n = 10`), and `proof.f.mjs:33-35` (`valuesTest2`,
`n = 10`).

**`remove/proof.f.mjs:447-465` (`test3`) is not one of them.** Its loop inserts
`i.toString()` — the *sequential* integers `2 … 50`, not their squares — and it
then removes `'40'` and `'10'`, neither of which exists in the squares corpus.
It is a separate fixture built for a separate purpose, stated in its own
comment: reaching the branch-merge-into-`Branch5`-sibling path in
`reduceValue0`. It must not be folded into `squares`; see the proposal.

So "a string B-tree keyed by `cmp`", "serialize canonically", and "the squares
corpus" — one fixture, shared by every proof in the directory — is stated four
times with no single definition. `fjs/bnf/testlib.f.mjs` is the precedent for
where it should live instead.

#### 3. The corpus itself is shared but unstated

`set/proof.f.mjs` and `remove/proof.f.mjs` build the *same* tree at `n = 38` and
assert the *same* expected string for it (`set:343-352`, `remove:20-31`), each
with its own copy of the seven-line literal. `remove/proof.f.mjs` then walks
that tree down through 39 removals. Nothing connects the two files, so the
shared starting state has to be verified by eye.

### Proposal

**1. A `fjs/types/btree/testlib.f.mjs`** — mirroring `fjs/bnf/testlib.f.mjs` —
holding the fixture the four proofs share:

```ts
/** A string B-tree ordered by `cmp`, the shape every btree proof tests. */
export const set = (node: TNode<string>) => (value: string): TNode<string> =>
    setSet(cmp(value))(() => value)(node)

/** `['1']` with the squares of `2..n` inserted, the shared corpus. */
export const squares = (n: number): TNode<string> => …

/** `jsonStr(squares(38))` — the tree `remove/proof.f.mjs` starts its removals from. */
export const expectedSquares38: string =
    '[[[["1"],"100",["1024"]],"1089",[["1156"],"121",["1225"]]],' +
    …

/** `jsonStr(squares(n))` per row, as `[n, expected]` — how the tree reshapes as it grows. */
export const expectedSquares: readonly (readonly [number, string])[] = [
    [10, '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]'],
    [11, '[[["1"],"100",["121"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]'],
    …
    [38, expectedSquares38],
]
```

The expectation table belongs in the testlib, **not** in `set/proof.f.mjs`:
`remove/proof.f.mjs` asserts the same `n = 38` string (`:25-32`), and a table
private to one proof would leave that copy in place — the deduplication in
item 3 below would not actually be reachable.

Two shape decisions worth stating, because the obvious alternatives are worse:

- **Rows carry their own `n`; there is no `firstN` offset.** An
  `expectedSquares[n - firstN]` lookup would export a base index nobody should
  have to know, and index arithmetic that silently reads the wrong row if a row
  is ever inserted. `[n, expected]` puts the bound next to the value it
  belongs to.
- **No `expectedFor(n)` lookup function.** Its `string` return type would be a
  lie — `n` outside `10 … 38` yields `undefined`, and a proof would then fail
  against an `undefined` expected value, which reads as a tree-shape bug rather
  than a bad argument. Making it total means either a range check or an
  `undefined` return that every caller unwraps, and neither is worth it for the
  **one** value read across files: `n = 38`. That one gets its own named export
  (defined once, referenced from the table's last row), and the only other
  consumer iterates the whole table anyway.

Per `AGENTS.md` ("Pin literal `const`s"), both exports carry explicit
annotations rather than relying on widening.

About `jsonStr`: it is `stringify(sort)`, which
[stringifySorted](../../../media/json/todo/stringify-sorted-canonical.md)
proposes exporting once from `fjs/media/json`. That export does **not** exist
yet, so do not treat it as a prerequisite and do not block on it. Bind the
alias once *in the testlib* — that already replaces four scattered aliases with
one — and swap the body for the import when `stringifySorted` lands. Either
ordering works and neither issue has to wait for the other.

**2. Table-drive `set/proof.f.mjs`.** The 29 cases become one generator over the
shared table:

```ts
const growth = expectedSquares.map(
    ([n, e]) => () => assertEq(jsonStr(squares(n)), e))
```

**Keep one test entry per `n`** — `.map` over the table rather than one
incremental fold that inserts and checks in a loop. The fold would be shorter
and would turn ~670 inserts into 37, but it makes case `n` depend on case
`n - 1`: a single reshaping bug at `n = 12` would fail 27 entries and the
report would no longer say *where* the divergence starts. The rebuild is
microseconds and independence is the property this proof is for.

The two `replace` cases at the end (`:357-393`) keep their hand-written form —
they assert two things each and carry comments explaining which `x.length`
arms they reach — but they get their trees from `squares(10)` / `squares(13)`
instead of rebuilding.

**3. Point `remove/proof.f.mjs` at the same fixture.** Its starting tree becomes
`squares(38)` and its opening assertion `expectedSquares38`, so both files read
the *same values* rather than holding two copies of a seven-line literal.

(An alternative is to drop that opening assertion from `remove/proof.f.mjs`
altogether — the shape of `squares(38)` is `set`'s contract and `set/proof.f.mjs`
already pins it. Keeping it as a sanity anchor for the 39-step removal chain is
defensible; what is not defensible is keeping it as a second literal. Either
resolution closes this point.)

`test3` (`:444-461`) is **out of scope and stays as it is.** Only its `set` and
`jsonStr` bindings come from the testlib; its loop does not. Rewriting it as
`squares(50)` would be a silent coverage loss, not a cleanup: it inserts the
sequential integers `2 … 50` and removes `'40'` and `'10'`, and neither key
exists among the squares — the removals would become no-ops against a
differently-shaped tree and the branch-merge-into-`Branch5`-sibling path in
`reduceValue0` would stop being exercised at all, while the proof still passed.

Do **not** add a `sequential(n)` helper to the testlib for it. One consumer does
not need an export, and a second corpus builder sitting next to `squares` with
the same shape is precisely the confusion that produced this hazard. Give the
loop a local name in `remove/proof.f.mjs` and a comment saying it is deliberately
*not* the shared corpus — the same treatment `ll1:68-74`'s grammar variant gets
in [proof-recognizer-and-fixtures](../../../bnf/todo/proof-recognizer-and-fixtures.md).
Move it to the testlib only if a second consumer ever appears.

Roughly 300 lines of scaffolding across the four files collapse into a table
and three imports, and the expected values become readable as the sequence they
are.

### Tasks

- [ ] Add `fjs/types/btree/testlib.f.mjs` with `set`, `squares`,
      `expectedSquares`/`expectedSquares38`, and — until `stringifySorted` exists —
      the single `jsonStr` alias.
- [ ] Convert `fjs/types/btree/set/proof.f.mjs` to `expectedSquares.map`; keep
      the two `replace` cases hand-written, sourced from `squares`.
- [ ] Convert `fjs/types/btree/remove/proof.f.mjs`, `find/proof.f.mjs`, and
      `proof.f.mjs` to import the fixture; delete the four local `set` helpers
      and `remove/proof.f.mjs`'s duplicate `n = 38` literal (`:25-32`).
- [ ] Replace every squares loop with `squares(n)`, not just the local `set`
      helpers — `remove/proof.f.mjs:22` and `:379`, `find/proof.f.mjs:26`, and
      `proof.f.mjs:33-35` (`valuesTest2`). Importing `set` while leaving the
      loop in place would satisfy the previous task and still leave the corpus
      with four owners.
- [ ] Leave `remove/proof.f.mjs`'s `test3` loop (`:447-465`) alone — it builds
      the sequential-integer corpus, not the squares one. Name it locally and
      comment why; do not call `squares(50)` and do not add a `sequential`
      helper to the testlib.
- [ ] Confirm coverage of `fjs/types/btree/{set,remove,find}` is unchanged —
      this must move test text, not test cases. Check the
      `reduceValue0` branch-merge path specifically: `test3` is its only
      exercise, and a corpus swap there would keep the proof green while
      silently dropping it.
- [ ] Add a CHANGELOG entry (`changelog/README.md`). The documentation-only
      exemption does not apply: this adds `testlib.f.mjs` and rewrites four
      `proof.f.mjs` files, which are code changes even though nothing in
      production moves.
- [ ] Run `tsc` and `fjs t`.

### Related

- [stringifySorted](../../../media/json/todo/stringify-sorted-canonical.md) —
  exports `stringify(sort)` once; this issue's `jsonStr` sites are four of the
  ~20 it lists, and it should land first so the testlib imports rather than
  re-aliases.
- [65Y-proof-assertEq-adoption](../../../emergent_testing/todo/65y-proof-asserteq-adoption.md)
  — `fjs/types/btree/remove/proof.f.mjs` still uses `if (r !== …) { throw r }`
  at 39 sites while its three siblings have moved to `assertEq`. Orthogonal to
  the fixture work, but the same file, so do them in either order rather than
  at once.
- [66F-btree-remove-mirror-merge](./66f-btree-remove-mirror-merge.md)
  — a `btree/remove` *implementation* refactor; it would be reviewed against
  these proofs, so landing the fixture first makes that diff readable.
- [proof-recognizer-and-fixtures](../../../bnf/todo/proof-recognizer-and-fixtures.md)
  — the same "shared harness and fixtures belong in a `testlib.f.mjs`" move for
  the bnf proofs.
- `fjs/bnf/testlib.f.mjs` — the existing precedent for a proof-only fixture
  module living beside the code it exercises.

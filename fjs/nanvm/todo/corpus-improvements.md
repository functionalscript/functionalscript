## Close the call-contract corpus gaps

**Priority:** P3
**Status:** open

### Problem

The call-contract corpus ([`corpus`](../corpus/module.f.mjs): the
`nanvm-harness` fixtures, each compared between Node, the FJS interpreter and
the direct AOT output) is now complete as a mechanism: the interpreter agrees
with Node on every fixture, each fixture has a committed generated
expectation ([`expected`](../expected/module.f.mjs)), and one Rust test
compares the compiled result with it. What it holds is uneven. Some fixtures
compare nothing, a few hand-written assertions repeat what the generated
expectation now says, and several things the language can do are in no
fixture at all.

This file lines up the remaining work so each item is one small pull request
and none repeats an issue that already owns it. It is a plan, not a design:
an item that needs a decision says so.

**Not here, because another issue owns it**

- Running the interpreter compiled to Rust over the corpus (step 3 of Stage 8
  in `nanvm-lib/todo/callable-function-objects.md`): blocked on the host `Map`
  migration and the immutable memo cache.
- The operator corpus (`fjs/nanvm`'s data, printed as `gen.corpus`) through
  `memo` and the native interpreter:
  [corpus-as-conformance-vectors](./corpus-as-conformance-vectors.md).
- The `#[should_panic]` set: [should-panic-per-vm](./should-panic-per-vm.md).
- Refactoring the generators' shared Rust item text, which includes
  `expectedModules`: [rust-item-helpers](./rust-item-helpers.md), when it
  lands.
- Default function text (the `function-text` exception): the "default-text
  observations" task of `callable-function-objects.md`.
- Host resource failures such as an oversized BigInt shift:
  [bigint-allocation-failures](../../edag/value/numeric/todo/bigint-allocation-failures.md)
  and the interpreter resource work it points to. Item 6 below uses the
  mechanism they define and adds none.
- The parity corpus (`parity.mjs`), which checks hosts and not values.

**Sequencing.** The Rust projects are being regrouped under `nanvm/`, which
moves every path this plan names in `nanvm-harness`. A code change to the
corpus should wait for that move, or be rebased over it.

### Proposal

**Remove vacuous and repeated checks (A).**

1. **Retire `undefinedDefault`.** Four of its entries (`effect`, `exports`,
   `named-imports`, `named-imports-math`) compare `undefined` with
   `undefined`, which proves nothing, and the table exists to make that visible
   until named exports are compared (decision 3 of Stage 8, "revisit after
   step 2"). Sort each fixture by what it is for. One that exists for a host
   test (`exports` for the harness's `run` API, `effect` for the effects host)
   becomes an exception with its reason, like `function` and `rest-function`.
   One that tests the language (`named-imports`, `named-imports-math`) has its
   data exports compared, the callable ones named in a list the corpus rule
   owns, so a callable export is a decision and not an accident. Then delete
   the hand-written assertions the comparison covers (the whole export object
   of `number` and `object`, `named`'s exports, the data half of
   `named-imports`). The expectation would print the export object and not
   only `default`, and the comparison would read it; this widens
   `fjs/nanvm/expected` and the Rust comparison, and is the main design risk.
2. **Delete the hand-written throw checks the `THROWS` record covers.** Every
   expectation records whether its fixture throws, and the Rust test compares
   it. The hand-written `Thrown(_)` assertions for the `throws`, `nullish`,
   `closure-throws` and `not-a-function` fixtures repeat that. Keep the one
   that checks the thrown value (`throw`, which throws `7`) and the test of the
   harness's own `Thrown` reporting over a hand-written module. Small and
   mechanical, the same shape as the JSON deduplication.
3. **Compare thrown values that are plain data.** A value the language threw
   (`throw 7`) is data on both sides; an engine's own error (`TypeError`,
   `RangeError`) is not and stays uncompared. The expectation could record the
   thrown data, which would retire the last hand-written throw check. Confirm
   first what the interpreter's failure carries for each case; if it cannot
   tell a thrown datum from an engine error reliably, drop this item.

**Fixtures for what no fixture exercises (B).** Each is one fixture or a few,
compared by the existing machinery with nothing retyped.

4. **Special numbers.** `-0`, `NaN`, the infinities, `5e-324`, `1e21`, and
   integers at the edge of exact representation. No fixture has a special
   number today. The Stage 8 design requires an independent hand-written Rust
   assertion for these leaves (bits against Rust's own constants), because the
   generated layers share an emitter that could spell them wrongly in both
   operands; add it with the fixture.
5. **Member-function calls through the compile path.** Only two of the allowed
   calls (`at`, `toString`) have a compiled fixture. The VM's answers are
   already pinned by the operator corpus, so the gap is the compiled wiring,
   not each method: the receiver lookup, an own property shadowing the
   built-in, a guarded call, a method call on a computed receiver, and above
   all callbacks. Only `entry` passes a function into a built-in, and nothing
   passes a capturing closure to `map`, `filter` or `reduce`, which is the
   AOT-compiled closure called by the VM's own code. A few fixtures, one per
   family (array with callbacks, string, number formatting), rather than one
   per method. This is the open "corpus cases for every entry" task of
   [member-functions](../../../nanvm-lib/todo/member-functions.md); tick it
   there, and reword it, since it predates the compiled corpus.
6. **BigInt operators through the compile path.** Today only literals and a
   division by zero are compiled. Add the arithmetic, shift and comparison
   operators and the mixed-type `TypeError`. A result the host can hold and
   the VM refuses (past its word limit) is a resource boundary, not a language
   difference: mark it the way the operator corpus already marks host
   allocation failures and do not add a second convention.
7. **Parameter leftovers.** Unused fixed parameters, the identity of a spread
   array against its source, and forwarding rest through a call. These are
   the unchecked fixture items of the Stage 6 follow-through in
   `callable-function-objects.md`; the legacy-sketch refusal and zero-arity
   migration it lists are compiler proofs, not fixtures.
8. **Structure and strings.** Integer-like keys in a plain object literal
   (only `object-spread` pins key order today), empty containers, lone
   surrogates and non-BMP characters in fixture source. Extend the existing
   fixtures where they fit.

**Decisions before any work (C).**

9. **Generated fixtures.** Deep nesting, many shared nodes and long arrays
   cannot sensibly be written by hand. A `gen.`-named fixture would be
   written by a generator and compared like the others, but the fixture walk
   and the corpus rule do not distinguish generated fixtures today. Is it
   wanted? It also touches [array-deep-nesting](../../../nanvm-lib/todo/array-deep-nesting.md)
   and [stack-safety](../../edag/todo/stack-safety.md).
10. **One source for the operator tables.** The `operators` fixture and the
    operator corpus both enumerate the same operators. One table could print
    both, so a new operator is added once. It is a design change to the
    operator corpus's data, so it needs agreement before an implementation.

### Tasks

- [ ] 2: delete the hand-written throw checks the `THROWS` record covers.
- [ ] 1: retire `undefinedDefault`; compare the data exports.
- [ ] 4: a special-numbers fixture, with the independent Rust assertion.
- [ ] 5: member-function calls through the compile path, callbacks included.
- [ ] 6: BigInt operators through the compile path.
- [ ] 7: parameter leftovers as fixtures.
- [ ] 8: key order, empty containers and string edge cases.
- [ ] 3: record thrown data, if the interpreter can tell it from an engine error.
- [ ] 9, 10: decide, then file each as its own issue if wanted.

### Related

- [`corpus`](../corpus/module.f.mjs) and [`expected`](../expected/module.f.mjs):
  the rule and the generated expectation this plan extends.
- `nanvm-lib/todo/callable-function-objects.md`: Stage 8, whose decisions 1 to
  5 govern every item here.
- [member-functions](../../../nanvm-lib/todo/member-functions.md): owns item 5's
  task.
- [corpus-as-conformance-vectors](./corpus-as-conformance-vectors.md): the
  operator corpus's other consumers.

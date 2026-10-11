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
  `expectedModules`: the `rust-item-helpers` issue that
  [pull request 2797](https://github.com/functionalscript/functionalscript/pull/2797)
  files, once it lands.
- Default function text (the `function-text` exception): the "default-text
  observations" task of `callable-function-objects.md`.
- Host resource failures such as an oversized BigInt shift:
  [bigint-allocation-failures](../../edag/value/numeric/todo/bigint-allocation-failures.md)
  and the interpreter resource work it points to. Those mark resources that
  the host fails on too; item 6 below is not that case.
- The parity corpus (`parity.mjs`), which checks hosts and not values.

**Sequencing.** The Rust projects are being regrouped under `nanvm/`, which
moves every path this plan names in `nanvm-harness`. A code change to the
corpus should wait for that move, or be rebased over it.

### Proposal

**Remove vacuous and repeated checks (A).**

1. **Retire `undefinedDefault`.** Four of its entries (`effect`, `exports`,
   `named-imports`, `named-imports-math`) compared `undefined` with
   `undefined`, which proves nothing. Done without comparing named exports:
   `exports` (the harness's `run` API), `effect` (the effects host) and
   `named-imports-math` (a dependency of `named-imports`) became exceptions
   with their reasons, like `function` and `rest-function`; and `named-imports`
   gained `export default checks`, so its identity checks are an ordinary
   default the corpus compares, and the hand-written read of the same checks
   went. `undefinedDefault` keeps only `missing`, whose `undefined` is the
   observation.

   What remains of the original item is comparing whole export objects, to
   delete the hand-written whole-export checks of `number`, `object` and
   `named`. It is a large change for three small tests: a second Node and
   interpreter route in `fjs/nanvm/corpus/proof.mjs` (it reads only `default`
   today) comparing whole export objects, the expectation printing the export
   object, the Rust comparison reading it, and a list of callable exports the
   corpus rule owns. Node must come first, as the authority, and the
   comparison stays order-sensitive: the compiler's parser sorts the exports
   before it builds the object, so its keys are in module-namespace order, as
   Node's are (the AST types say so); Stage 8 decision 3's earlier claim that
   the represented export object keeps declaration order is corrected there.
   Recommended: do not build it unless a
   fixture needs a named export that cannot be observed through its default,
   which today none does.
2. **Delete the hand-written throw checks the `THROWS` record covers.** Every
   expectation records whether its fixture throws, and the Rust test compares
   it. The hand-written `Thrown(_)` assertions for the `throws`, `nullish`,
   `closure-throws` and `not-a-function` fixtures repeat that, and so does the
   imported-module throw that `named_imports_and_captures` asserts for
   `named-imports-throws` (the rest of that test, the call of `main`,
   stays). Keep the one
   that checks the thrown value (`throw`, which throws `7`) and the test of the
   harness's own `Thrown` reporting over a hand-written module. Small and
   mechanical, the same shape as the JSON deduplication.
3. **Compare thrown values that are plain data.** A value the language threw
   (`throw 7`) is data on both sides; an engine's own error (`TypeError`,
   `RangeError`) is not and stays uncompared. The expectation could record the
   thrown data, which would retire the last hand-written throw check, but only
   with an independent oracle: `fjs/nanvm/corpus/proof.mjs` reduces every Node
   exception to "throws" today, and the compiled fixture and the expected graph
   share the literal emitter, so a shared bug that emitted `7` as another value
   would pass. So the proof must first keep Node's thrown datum and compare it
   with the interpreter's, and the datum needs its own JSON bytes beside the
   graph, like a default. Confirm first what the interpreter's failure carries
   for each case; if it cannot tell a thrown datum from an engine error
   reliably, or the two extra layers cost more than the one check they
   replace, drop this item.

**Fixtures for what no fixture exercises (B).** Each is one fixture or a few,
compared by the existing machinery with nothing retyped.

4. **Special numbers.** `-0`, `NaN`, the infinities, `5e-324`, `1e21`, and
   integers at the edge of exact representation. No fixture has a special
   number today. Finite values such as `5e-324`, `1e21` and the exact-integer
   boundaries need nothing extra: the JSON bytes the compiler wrote are
   compared with the compiled result's own serialization, a path that shares
   nothing with the Rust literal emitter. The Stage 8 design requires an
   independent hand-written Rust assertion only for the leaves JSON cannot
   verify, here `-0` (bits against Rust's own constant), `NaN` (`is_nan`) and
   the infinities (value and sign), because the generated layers share an
   emitter that could spell them wrongly in both operands; add those with the
   fixture.
5. **Member-function calls through the compile path.** A handful of the
   allowed calls have a compiled fixture (`at`, `toString`, `endsWith`,
   `startsWith`, `join`, and one `map` in `entry` with a plain, non-capturing
   callback); most do not. The VM's answers are already pinned by the
   operator corpus, and the compiled wiring of a call on an own property is
   too: `method` and `optional` pin a method call and a guarded call of an
   own function, and `to-string` an own `toString` shadowing the built-in. What
   remains is callbacks that capture state, since nothing passes a capturing
   closure to `map`, `filter` or `reduce` (the AOT-compiled closure called by
   the VM's own code), a guarded call of a built-in (`a?.at(0)`, `a.at?.(0)`),
   and the other families' methods with arguments (string slicing and
   padding, number formatting). A few fixtures, one per family, rather than
   one per method. This is the open "corpus cases for every entry" task of
   [member-functions](../../../nanvm-lib/todo/member-functions.md); tick it
   there, and reword it, since it predates the compiled corpus.
6. **BigInt operators through the compile path.** Today the corpus
   compiles literals, a division by zero and a `toString`; strict equality of
   BigInts appears only in `parity`, which is an exception checked by its
   hosts and not by this comparison. Add the arithmetic, shift and relational
   operators, equality inside the corpus, and the mixed-type `TypeError`, with operands inside the native
   word limit so that Node, the interpreter and the AOT output agree. A
   result that Node can hold and the VM refuses is a different case: see item
   11, which this item does not assign.
7. **Parameter leftovers.** Unused fixed parameters, the identity of a spread
   array against its source, and forwarding rest through a call. These are
   the unchecked fixture items of the Stage 6 follow-through in
   `callable-function-objects.md`; the legacy-sketch refusal and zero-arity
   migration it lists are compiler proofs, not fixtures.
8. **Structure and strings.** Integer-like keys in a plain object literal
   (only `object-spread` pins key order today; `entry` has a single such key),
   and a lone surrogate written in fixture source (`object-spread` only
   produces them, from a spread of a string). Empty containers (`lazy` has an
   empty array literal) and non-BMP text (`spread`) are already covered.
   Extend the existing fixtures where they fit.

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
11. **Native capacity limits.** The corpus requires Node, the interpreter and
    the AOT output to agree, and has no per-fixture marker for a result the
    native VM refuses by design (a BigInt past its word limit). The operator
    corpus's allocation marker does not fit: it marks operations the host
    fails on as well. Choose a boundary before any such fixture is written:
    keep the corpus inside the limits and test the refusal in Rust only, or add
    a per-fixture marker with a reason, like the exceptions.

### Tasks

- [x] 2: delete the hand-written throw checks the `THROWS` record covers.
- [x] 1: retire `undefinedDefault`: the host and helper fixtures became exceptions and `named-imports` gained a default.
- [ ] 1b: compare whole export objects (Node route first, order-sensitive), only if a fixture needs a named export its default cannot show; recommended against.
- [ ] 4: a special-numbers fixture, with the independent Rust assertion for `-0`, `NaN` and the infinities.
- [ ] 5: capturing callbacks, guarded built-in calls and the other families' methods through the compile path.
- [ ] 6: BigInt arithmetic, shift and relational operators, equality and the mixed-type `TypeError` through the compile path.
- [ ] 7: parameter leftovers as fixtures.
- [ ] 8: out-of-order integer-like keys in a plain object literal and a lone surrogate in source.
- [ ] 3: record thrown data, only with Node's thrown datum compared first and its own JSON bytes, and only if the interpreter can tell it from an engine error.
- [ ] 9, 10, 11: decide, then file each as its own issue if wanted.

### Related

- [`corpus`](../corpus/module.f.mjs) and [`expected`](../expected/module.f.mjs):
  the rule and the generated expectation this plan extends.
- `nanvm-lib/todo/callable-function-objects.md`: Stage 8, whose decisions 1 to
  5 govern every item here.
- [member-functions](../../../nanvm-lib/todo/member-functions.md): owns item 5's
  task.
- [corpus-as-conformance-vectors](./corpus-as-conformance-vectors.md): the
  operator corpus's other consumers.

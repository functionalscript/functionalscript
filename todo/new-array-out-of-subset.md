## Remove `new Array` from FunctionalScript sources

**Priority:** P2 — shipped `.f.mjs` code uses constructs the subset forbids, and
two modules in `fjs/types` currently state opposite premises about the same
input. Nothing is broken for a caller today, which is why it is not P1.
**Status:** open — the survey is complete and below. The first step is a
decision and every step that touches a hole waits on it. One does not: the
`fjs/sul` cleanup is about `fill` and a reassigned local rather than about
holes, so it lands first and clears the grep of the one site the decision has
nothing to say about.

### Problem

`new Array(n)` is not FunctionalScript. Global objects may be used only as
namespaces ([`spec/todo/2360-built-in.md`](../spec/todo/2360-built-in.md)), and
the `Array` table there lists `from`, `fromAsync`, `isArray` and `of` and no
constructor. An array literal cannot spell a hole either — "Two adjacent commas
are not an elision: an array has no holes"
([`spec/README.md`](../spec/README.md)) — and `delete` and a `length`
assignment are mutation. `concat`, `slice` and `map` propagate a hole without
originating one. So **no FunctionalScript expression builds a sparse array**,
and [`fjs/types/object/structurally_same/README.md`](../fjs/types/object/structurally_same/README.md)
already says so outright.

The tree does not agree with that. **Twenty-nine `new Array(` expressions on
twenty-eight lines across nine `.f.mjs` files**, and one of them is not a
proof. The table counts lines, which is what a sweep works through; the one
place the two differ is noted in it:

| where | uses |
| - | - |
| `fjs/rtti/validate/proof.f.mjs` | 11 (12 expressions: one line carries two) |
| `fjs/edag/proof.f.mjs` | 4 |
| `fjs/rtti/common/proof.f.mjs` | 3 |
| `fjs/rtti/data/proof.f.mjs` | 3 |
| `fjs/types/range_set/proof.f.mjs` | 3 |
| `fjs/media/datajs/serializer/proof.f.mjs` | 1 |
| `fjs/rtti/parse/proof.f.mjs` | 1 |
| `fjs/sul/proof.f.mjs` | 1 |
| **`fjs/rtti/parse/module.f.mjs`** | **1** |

A further eight sites mention `new Array` in prose only. The one occurrence in
`spec/datajs/vectors/reject/data.f.mjs` is not an offender: it is the document
text of a vector proving DataJS rejects `new Array()`.

**This is not a find-and-replace, and that is the whole difficulty.** Three
things are tangled together.

**A shipped module builds holes on purpose.** `tupleRebuild` in
[`fjs/rtti/parse/module.f.mjs`](../fjs/rtti/parse/module.f.mjs) allocates with
`new Array(n)` and writes with `Object.defineProperty` in a loop, so that
"every index it never writes" stays a hole. Its own JSDoc states the rule and
then works around it — "A hole is the one member shape no expression builds" —
defending itself by local freshness, that the array is the function's own and
is returned before anything else sees it. Nothing in `spec/README.md` or
[`fjs/AGENTS.md`](../fjs/AGENTS.md) grants that exception, and §1.6 and §3.1
name both `defineProperty` and index assignment on an accumulator among what
the subset forbids. So the module concedes the rule and claims an exception
nobody wrote down.

It is also load-bearing beyond itself: `parse` output is handed to
`assertStructurallySame`, whose module declares its operands dense as a
premise. `parse` is currently the one shipped function that can hand a sparse
array to a comparison documented as unable to receive one.

**Deleting a proof can uncover a branch.** Most of the twenty-eight proof uses
exist to show that some module rejects or tolerates a hole. If a hole cannot
occur, the guard being proved is also unreachable, and `fjs/AGENTS.md` §1.2
then says to restructure so the branch is not there. Removing only the proof
leaves the branch uncovered and turns `npm run cov` red. Two of these cross
directory boundaries: the false arm of a branch in `fjs/rtti/parse` has its
only cover in `fjs/rtti/validate`'s proof, reached through the
acceptance-agreement table. Those two directories cannot be audited
independently.

**Some guards survive and must not be swept up.** The const-tuple length bound
in `parse` and `validate` takes both arms on dense values and earns its place
on speed. The DataJS serializer's array check refuses a hole and an extra own
property in one message; the hole half may be unreachable while the extra own
property half is exactly the silently-wrong document its own documentation
holds up as the counterexample.

### Proposal

Settle the exception first, in writing, then sweep in dependency order. The
sweep is six pull requests, and the sites group by the fix rather than by the
module they live in.

- **Shipped code that builds a hole.** `tupleRebuild` only ever produces an
  interior hole when its *input* already has one: for a dense input, every
  index below the highest present one is present, so the allocate-and-write
  body produces exactly what the subset-legal `arrayRebuild` beside it
  produces. If the exception is refused, `arrayRebuild` replaces it for both
  tuple kinds and the difference is visible only on an input the ruling says
  cannot be constructed. **Confirm that empirically before acting on it.**
- **Guards that become unreachable.** The container and rest length checks
  across `fjs/rtti/parse`, `fjs/rtti/validate` and `fjs/rtti/data` are
  consulted only when no undeclared member was found, which for a dense array
  already implies the bound holds. They collapse to a constant, and the
  parameter threading them can go. The three readers are pinned to each other
  by their acceptance-agreement proofs, so this is one pull request, not three.
- **Proof-only inputs with no branch behind them.** The `fjs/edag` entries and
  the schema-side rows delete freely once their dense siblings are confirmed to
  cover the same branches.
- **Guards that survive.** Leave the code, rewrite the prose to say which
  caller it defends against.
- **Unrelated subset violations found on the way.** `fjs/sul/proof.f.mjs` has
  `new Array(n).fill(0n)`, which breaks two rules on one line, since `fill`
  mutates. `Array.from({ length: n }, () => 0n)` is the repository idiom and is
  already used in `fjs/crypto/sha1`.

### Tasks

- [ ] **The exception, in writing. Everything else waits on this.** Does the
      subset admit a fresh, never-escaped array built with `new Array(n)` and
      written by index inside a `.f.mjs`?
      [`fjs/rtti/parse/module.f.mjs`](../fjs/rtti/parse/module.f.mjs) asserts
      one and nothing grants it. Answer it in `spec/README.md` beside the
      no-elision rule and in `fjs/AGENTS.md` §3.1, saying also whether it
      covers `Object.defineProperty` and index assignment on an accumulator,
      which the same function uses. Note the precedent: this exact argument was
      made for the DataJS corpus, acted on, and reversed.
- [ ] **`fjs/sul` hygiene.** Replace `new Array(n).fill(0n)` with
      `Array.from`, and drop the `push` and reassigned local in the same
      helper. No shipped code, no coverage change, unrelated to holes. Lands
      first to clear the grep.
- [ ] **`fjs/edag`.** Delete the four hole entries and trim the two prose
      clauses that describe `fjs/rtti`'s behaviour rather than `edag`'s.
      Confirm in the pull request that the dense siblings still cover the
      length gate and the absence pass.
- [ ] **The schema side**, if a sparse schema is agreed to be unauthorable. A
      schema is an ordinary FunctionalScript value, so the three-way
      distinction between a hole, an empty array and an explicit `undefined`
      has no inhabitant. Delete whole arrow functions rather than lines, so
      function coverage stays clean. `tupleSchemaEntries` itself stays: it
      keeps its justification from the non-index-own-property half of its
      argument.
- [ ] **The container and rest length checks, all three readers in one pull
      request.** Remove the collapsed parameter and its JSDoc from
      `fjs/rtti/parse`, `fjs/rtti/validate` and `fjs/rtti/data`, and delete
      their covers in the same commit. Keep the const-tuple bound, which takes
      both arms on dense values. Run `npm run cov` before and after; anything
      below 100% means the unreachable-versus-live split is wrong somewhere.
- [ ] **`fjs/rtti/parse`'s hole producer**, gated on the first task. If the
      exception was refused, `arrayRebuild` replaces `tupleRebuild` for both
      tuple kinds, and the three proofs whose subject is hole preservation go
      with it. If it was granted, the opposite edit: cite the new spec
      paragraph in the JSDoc instead of arguing local freshness, and note in
      [`fjs/types/object/structurally_same/README.md`](../fjs/types/object/structurally_same/README.md)
      that `parse` output is the one source of sparse arrays its dense premise
      does not cover.
- [ ] **`fjs/types/range_set`.** Its guard and the prose explaining it either
      both go or both stay, depending on whether it defends a FunctionalScript
      caller or the published package's JavaScript surface. Leaving the proof
      entry while removing the guard turns it red.
- [ ] **`fjs/media/datajs/serializer`**, last, because it waits on a decision
      of its own: whether its input parameter stays `unknown`. Separate the
      hole half of its array check from the extra-own-property half before
      touching either.
- [ ] **The prose sweep.** Eight sites mention `new Array` in explanation.
      Rewrite each to say which caller it is about, and fix the one in
      `fjs/types/range_set` that reads as though `new Array(1)` were an
      ordinary FunctionalScript value, which contradicts its sibling in
      `fjs/types/object/structurally_same`.

### Related

- [`spec/README.md`](../spec/README.md) — the no-elision rule the sweep derives
  from; the exception, if granted, is written beside it.
- [`spec/todo/2360-built-in.md`](../spec/todo/2360-built-in.md) — globals as
  namespaces only, and the `Array` table that omits the constructor.
- [`fjs/types/object/structurally_same/README.md`](../fjs/types/object/structurally_same/README.md)
  — already states that FunctionalScript cannot build a sparse array, and
  assumes dense operands on that basis.
- [`spec/datajs/todo/conformance-vectors.md`](../spec/datajs/todo/conformance-vectors.md)
  — where the same argument was made, acted on, and reversed; its open question
  about the serializer's `unknown` parameter gates the last task here.

## A call's arguments as an item list

**Priority:** P2
**Status:** open

### Problem

A call's arguments are one operand, a node that evaluates to the complete
argument array. `f(a, b)` is `['()', f, ['[]', [a, b]]]`, and `f(a, ...x)`
is `['()', f, ['[]', [a, ['...', x]]]]`. Every call written in source
therefore wraps its arguments in an array node that exists only to be
unwrapped again.

The [stage 1 discussion](../../../todo/edag-stage1-discussion.md) chose the
wrapper over a literal list for two reasons. At `dc037ef7c`, before #2460,
it said a literal list "would save the `["[]", …]` wrapper in the common
case but would need a spread marker". It still says `args` is "a single
operand that evaluates to an array", so a node operand could pass a
computed array through: "Forwarding stays free where the operand is an
array by construction". Neither reason holds any longer:

- **The spread marker exists.** `['...', exp]` is already an item of `[]`,
  with the semantics a call spread needs
  ([spread operations](../../../nanvm-lib/todo/spread-operations.md)).
- **Passing an array through is the exception, not the rule.** A spread
  operand must be iterated: `f(...'ab')` passes `'a'` and `'b'`. Only an
  array by construction, such as a forwarded `['rest']`, may be the operand
  itself, and [`../README.md`](../README.md) has to carry that exception
  beside the rule.

### Proposal

Every argument operand becomes an item list, the same `Items` list `[]`
holds, read by position:

| Node | Today | Proposed |
|---|---|---|
| call | `['()', f, ['[]', [a, b]]]` | `['()', f, [a, b]]` |
| call step | `['\|()', ['[]', [a]]]` | `['\|()', [a]]` |
| optional call | `['?.()', f, ['[]', [a]]]` | `['?.()', f, [a]]` |
| optional call step | `['\|?.()', ['[]', [a]]]` | `['\|?.()', [a]]` |
| region-closing call step | `['\|!()', ['[]', [a]]]` | `['\|!()', [a]]` |

The step continuations keep their optional third element unchanged.

- **No ambiguity.** The list is an operand position the schema reads as a
  list, exactly as `['[]', items]` reads its second element. A list whose
  first item is a string, `f('.', x)`, is `['()', f, ['.', x]]`, and the
  position, not the tag, says it is a list.
- **One rule for spread.** `f(...x)` is `['()', f, [['...', x]]]`, and
  forwarding `(...r) => f(...r)` is `['()', f, [['...', ['rest']]]]`. The
  "array by construction" exception disappears from the README and the
  schema's JSDoc.
- **Nothing observable changes.** Every callee builds its own rest array
  from the arguments, in both executors, so whether the caller's argument
  array is a node or a list cannot be told apart. A computed array passed
  through costs one spread instead: an executor may still skip the copy
  where the operand is an array by construction.
- **Smaller graphs and simpler readers.** The argument array stops being a
  node, so it is never shared, hoisted or counted. The `.js` writer's
  `argumentItems`, which unwraps the node today, reads the list directly.

**This breaks the EDAG format.** Every `.edag.data.js` holding a call
changes, and so does every content hash over one, so the change is declared
as a breaking change and every reader and writer in the repository moves in
the same pull request.

### Tasks

- [ ] Schema: the argument operand of `call`, `optionCall` and the three
      call steps is an `Items` list, in [`../module.f.mjs`](../module.f.mjs)
      and [`../types.ts`](../types.ts).
- [ ] Lowering in [`fjs/compiler/edag`](../../compiler/edag/module.f.mjs)
      emits the list.
- [ ] Readers: [`../analysis`](../analysis/module.f.mjs),
      [`../operations`](../operations/module.f.mjs), the amnesia evaluator,
      [`../rust`](../rust/module.f.mjs), the `.js` writer in
      [`fjs/compiler/serializer`](../../compiler/serializer/module.f.mjs),
      the graph demo in [`fjs/compiler/edag`](../../compiler/edag/demo.f.mjs)
      and [`fjs/nanvm`](../../nanvm/module.f.mjs).
- [ ] Docs: every description of the current format moves with it —
      [`../README.md`](../README.md), whose Nodes section and Spellings
      table drop the array-by-construction exception; the stage 1
      discussion's subject on the args operand;
      [`fjs/compiler/README.md`](../../compiler/README.md);
      [`fjs/nanvm/README.md`](../../nanvm/README.md) and
      [`fjs/nanvm/types.ts`](../../nanvm/types.ts); the
      [spread operations](../../../nanvm-lib/todo/spread-operations.md)
      todo; and the spellings in [`entry.md`](entry.md) and
      [property accessor](../../../spec/todo/2330-property-accessor.md);
      and [compile modules to EDAG](../../compiler/todo/compile-modules-to-edag.md),
      whose open design says calls keep their array-valued argument
      operand, spelled `args`. A search for `'[]'` under a call tag finds
      the literal spellings, and one for `args` beside a call tag finds the
      abstract ones.
- [ ] Proofs updated to the new shape, including a call with a spread item,
      a forwarded rest, and a first argument that is a string.
- [ ] `npm run gen`: the `nanvm-harness` fixtures are compiled from source,
      so check whether the generated Rust changes.
- [ ] A `Changelog:` entry marked **BREAKING CHANGES** for the EDAG format.

### Related

- [spread operations](../../../nanvm-lib/todo/spread-operations.md): the
  call-spread rule this replaces with a single shape. Its semantics stand —
  a call spread is an array spread — and only its spelling of the
  arguments moves, in the same pull request as this one; an implementer of
  the spread operations reads the argument list as this todo spells it.
- [stage 1 discussion](../../../todo/edag-stage1-discussion.md): the
  original choice of a node operand.

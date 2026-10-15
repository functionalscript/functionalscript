## Write a shared node once

**Priority:** P2
**Status:** open

### Problem

A node the EDAG shares — one node, reached from more than one place — is one
value, computed once. The FunctionalScript writer writes some shared nodes as
a `const` and others in place at every reference, so its text loses sharing
the graph has. At `f9b71749`:

```js
// two different EDAGs
export default a => { const x = a + a; return x + x; };   // `x` is one node, shared
export default a => (a + a) + (a + a);                     // two equal nodes
// one text for both
export default ($0)=>$0+$0+($0+$0);
```

The EDAG document keeps them apart — `const $0=["+",["arg",0],["arg",0]];…["+",$0,$0]`
for the first, two `["+",["arg",0],["arg",0]]` for the second — and so does
the Rust writer: one `let` for `x`, read twice, in the first; two in the
second. The FunctionalScript writer writes them alike, and its text is also
what `String(f)` answers and what the Rust output embeds as each function's
text (`tryFunctionText`).

The cause is where the writer reads sharing from. It writes from
`fjs/edag/analysis`'s table, which merges equal nodes (`mergeable`): both
programs above are one table, the inner `+` counted as shared in each. The
writer cannot tell one shared node from two equal ones, so it gives a `const`
only to a node that mints identity — `[]`, `{}`, `=>`, a call — which the
table never merges (`hoistedKind`), and writes every other node in place:
right for two equal nodes, wrong for one shared node. The Rust writer reads
sharing from the graph itself, by node identity (`sharedNodesOf` in
[`fjs/edag/rust`](../../../edag/rust/module.f.mjs)). Two writers, two answers
to one question.

The cost is more than duplicated text. A copy repeats the shared nodes under
it, so the text grows with the number of paths to a node, not the number of
nodes:

```js
// source
export default (x) => { const a = x + 1; const b = a * a; const c = b * b; const d = c * c; return d * d; };
// written
export default ($0)=>($0+1)*($0+1)*(($0+1)*($0+1))*(($0+1)*($0+1)*(($0+1)*($0+1)))*(($0+1)*($0+1)*(($0+1)*($0+1))*(($0+1)*($0+1)*(($0+1)*($0+1))));
```

Five nodes, sixteen copies of `$0+1`; `n` such `const`s write `2^n`. The
`.js` output run as JavaScript evaluates every copy, so the run time grows the
same way: the text evaluates the graph as
[Amnesia](../../../edag/amnesia/README.md) does, every incoming edge
evaluating its target again, where the graph has one node. A default
parameter ([#2963](https://github.com/functionalscript/functionalscript/pull/2963))
makes the case common, since every read of a defaulted parameter is one
shared conditional — `(a = 42) => a + a` writes the test twice — but it is no
cause of it.

### Proposal

**One sharing analysis, by node identity, for both writers.** Decided by the
owner: "If expression is shared, it means it must be `const`!" — whatever its
kind, `$0.y` as `$0+1` ("it is not about shorter or longer; it's about
sharing",
[comment](https://github.com/functionalscript/functionalscript/pull/2964#issuecomment-6185308972)).

- **Shared is the EDAG's word.** A node is shared when the EDAG reaches that
  one node from more than one place — what the Rust writer's `sharedNodesOf`
  counts today. The walk moves where both writers import it (export it, do
  not copy it), and the FunctionalScript writer takes its shared nodes from
  it rather than from the merged table.
- **A shared node is a `const`; an unshared one is written where it
  stands.** `a => { const x = a + a; return x + x; }` is written
  `($0)=>{const $1=$0+$0;return $1+$1;}`, and `(a + a) + (a + a)` stays
  `$0+$0+($0+$0)`. The writer merges nothing: two equal nodes are two nodes,
  as the source wrote them — `a => { const x = a + a; return [x, x, a + a]; }`
  is `($0)=>{const $1=$0+$0;return [$1,$1,$0+$0];}`, where today it is
  `[$0+$0,$0+$0,$0+$0]`.
- **Where the `const` goes** is unchanged: the block that holds the node's
  uses, as the writer already places a minting node's. A node shared within
  one lazy operand — the right operand of `&&`, `||` and `??`, an arm of
  `?:` — takes a `const` of the block the writer opens there,
  `$0?(()=>{const $1=[$0];return [$1,$1];})():0` ("lazy cases are not
  shareable outside their own blocks", the owner, same comment). A source
  `const` read only in lazy operands is anchored by the body's comma, so the
  scope reaches it eagerly and names it, as today. A node two lazy operands
  reach with no eager path stays as today, owner's choice: a mergeable one
  written in each operand's block, a minting one refused.
- **Evaluation order.** Naming a shared node the scope reaches eagerly can
  change which failure comes first — `[(() => { throw 1 })(), y, y]` with
  `y` a shared `null.x` fails at `y` before the call — and that is no
  observation: the first failing operation is not one, and reordering a
  failing computation to fail earlier is what the
  [failure contract](../../../../spec/README.md#failure-is-one-outcome)
  allows. A successful run evaluates the node anyway. The writer already does
  it for a shared call.

The chain above is then linear:
`($0)=>{const $1=$0+1;const $2=$1*$1;const $3=$2*$2;const $4=$3*$3;return $4*$4;}`.

### Tasks

- [ ] Move the identity walk (`visit`, `sharedNodesOf`) out of
      `fjs/edag/rust` to a module both writers import.
- [ ] The FunctionalScript writer: shared nodes by identity, each a `const`
      of the block holding its uses, whatever its kind; equal nodes not
      merged into one; `hoistedKind` and the header's "What a `const` is
      for" say so.
- [ ] Proofs: the two programs above written apart, the `[x, x, a + a]`
      case, the chain linear, a node shared within one lazy operand, and the
      expectations
      in the serializer's own proof, `../../language.proof.f.mjs` and
      `../../proof.f.mjs`'s `fjsRoundTrip` that pin in-place text.
- [ ] `tsc`, `npm start test` under `fjs/compiler` and `fjs/edag`, scoped
      proof coverage at 100%.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `hoists`, `hoistedKind`, and the
  header's "What a `const` is for".
- [`../../../edag/rust/module.f.mjs`](../../../edag/rust/module.f.mjs) —
  `sharedNodesOf`, sharing by identity.
- [`../../../edag/analysis/module.f.mjs`](../../../edag/analysis/module.f.mjs)
  — `mergeable`, the merging the writer's table does.

## Write a shared node once

**Priority:** P2
**Status:** open

### Problem

The FunctionalScript writer gives a shared node a `const` only when the node
mints identity — `[]`, `{}`, `=>`, a call — or holds one through a lazy
edge (`hoistedKind`). Every other shared node, an access or an operator over
values, is written in place at each occurrence, as the module's own header
says: the occurrences merge again when the output is read, and hoisting one
"would evaluate it where the source did not".

The values are right — a merged node is pure and mints nothing, so each
copy answers what the one node answers — but the text is not the graph. A
copy repeats every shared node under it too, so the text grows with the
number of *paths* to a node rather than the number of nodes: each level of
sharing doubles it. At `f9b71749`:

```js
// source
export default (x) => { const a = x + 1; const b = a * a; const c = b * b; const d = c * c; return d * d; };
// written
export default ($0)=>($0+1)*($0+1)*(($0+1)*($0+1))*(($0+1)*($0+1)*(($0+1)*($0+1)))*(($0+1)*($0+1)*(($0+1)*($0+1))*(($0+1)*($0+1)*(($0+1)*($0+1))));
```

Five nodes, written as sixteen copies of `$0+1`; `n` such `const`s write
`2^n`. The EDAG document keeps the five (`const $0=["+",["arg",0],1];const
$1=["*",$0,$0];…`), and the Rust writer binds each once. Reading the written
text back merges the copies again, so the round trip holds; what it does not
hold is the size, and the `.js` output run as JavaScript evaluates each copy,
so the run time grows the same way: the text evaluates the graph as
[Amnesia](../../../edag/amnesia/README.md) does, every incoming edge
evaluating its target again, where the graph has one node.

Nothing about the source decides it: `(x) => { const a = x ? 1 : 2; return
a + a; }` is written `($0)=>($0?1:2)+($0?1:2)`. A `const` the source reaches
only lazily is written once already: every `const` is established, so the
front end anchors such a one with the body's comma, and the writer writes
the anchor as a `const` of its own — `const t0 = x + 1; const t1 = c ? t0 :
t0 * 2; …` comes out as `{const $2=$1+1;const $3=$0?$2:$2*2;…}`, linear. It
is the shared node a block reaches *eagerly* that is written in place. A default parameter, as
[#2961](https://github.com/functionalscript/functionalscript/pull/2961)
proposes it, would make the case common, since every read of a defaulted
parameter is such a
conditional — `(a = 42) => a + a` would be written with its test twice — but
it is no cause of it.

### Proposal

**A shared node is named in the block that shares it, whatever its kind.**
Decided by the owner
([comment](https://github.com/functionalscript/functionalscript/pull/2964#issuecomment-6185308972)):
"It is not about shorter or longer; it's about sharing. Correctness is
paramount!" — so `$0.y` and `-$0` take a `const` as `$0+1` does. The text is
then linear in the graph for every node a block always evaluates, which, for
a module the front end reads, is every shared node: the one case left is
below.

- **The scope.** In `hoists`, a shared node the scope always evaluates
  takes a `const` of the scope. *Always evaluates* is what a successful run
  of the scope cannot skip: what its root reaches through no lazy operand,
  and also a node that the condition of a `?:` so reached evaluates, or that
  *every* arm of it does — a `?:` runs one arm whenever it runs, so a node
  both arms reach is the block's around it, not either arm's. The reason
  given for writing such a node in place holds only where an occurrence can
  be skipped: a node the scope always evaluates is evaluated on every
  successful run whether or not it is named, so naming it skips no failure a
  successful run skips, and reads back as the same node. What it can move is *which* failure
  comes first — in `[(() => { throw 1 })(), null.x, null.x]` the hoisted
  `null.x` fails before the call — and that is no observation: the first
  failing operation is not one, and reordering a failing computation to fail
  earlier is what the
  [failure contract](../../../../spec/README.md#failure-is-one-outcome)
  allows, in so many words. The writer already does it for a shared call.
- **A lazy operand's block.** "Lazy cases are not shareable outside their
  own blocks" (the owner, same comment). The right operand of `&&`, `||`
  and `??` and an arm of `?:` is a block of its own, which the writer
  already opens for a minting node shared within it,
  `$0?(()=>{const $1=[$0];return [$1,$1];})():0`
  ([the writer's header](../module.f.mjs)); a node shared within one such
  operand takes a `const` of that block the same way, whatever its kind. A
  node two lazy operands reach that no block around them always evaluates
  is shared by neither: a mergeable one is written in each operand's block,
  as `x + 1` is in `$0?$0+1:($0+1)*2`, and a minting one stays refused, as
  today.

**The case left: it can still double.** A mergeable node that only some of
several lazy operands reach, none of which is sure to run, is written in
each — `(c ? t : 0) + (d ? t : 1)` — and a chain of them doubles per level.
A module the front end reads cannot build one but by writing the text out
in full, or by naming it with a `const`, which the comma anchors and the
writer names, so its output is as long as its source at most. A graph built
otherwise — an EDAG document, a value — can: at `c20968d4` the chain
`t0 = x + 1`, `tk+1 = c ? tk : tk * 2`, built with no anchor, three levels
deep, writes `$1+1` eight times. The `?:` rule above makes that chain
linear, both arms reaching each `tk`; the `(c ? t : 0) + (d ? t : 1)` chain
stays exponential. Open for the owner: write it in each block, as the rule
says, or refuse a graph whose text that rule would make longer than its
nodes — as a minting node two lazy operands reach is refused today.

The examples above would be written

```js
export default ($0)=>{const $1=$0+1;const $2=$1*$1;const $3=$2*$2;const $4=$3*$3;return $4*$4;};
export default ($0)=>{const $1=$0?1:2;return $1+$1;};
```

and the same chain under a lazy arm, written today
`$0?($0+1)*($0+1)*(($0+1)*($0+1)):0`, as
`$0?(()=>{const $1=$0+1;const $2=$1*$1;return $2*$2;})():0`.

### Tasks

- [ ] `hoists`: a `const` for a shared node the scope's root reaches
      eagerly; the module's header and `hoistedKind`'s comment say why, the
      failure contract included.
- [ ] *Always evaluates*: a node every arm of a `?:` reaches, or its
      condition does, belongs to the block around the `?:`.
- [ ] A lazy operand's block: a `const` of the block for a node shared
      within one lazy operand, whatever its kind; a mergeable node two lazy
      operands reach written in each, or refused, as the owner decides.
- [ ] Proofs: the serializer's own, `../../language.proof.f.mjs` and
      `../../proof.f.mjs`'s `fjsRoundTrip` expectations that pin in-place
      text, and a proof that a chain of nested shared operators is written
      in text linear in its length — in a scope, under a lazy operand, and
      as the built `tk+1 = c ? tk : tk * 2` chain with no anchor — and one
      that pins what the `(c ? t : 0) + (d ? t : 1)` chain does.
- [ ] `tsc`, `npm start test` under `fjs/compiler`, scoped proof coverage at
      100%.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `hoists`, `hoistedKind`, and the
  header's "What a `const` is for".
- [`../../../edag/analysis/module.f.mjs`](../../../edag/analysis/module.f.mjs)
  — `mergeable`, the nodes the analysis merges and the writer writes in
  place.

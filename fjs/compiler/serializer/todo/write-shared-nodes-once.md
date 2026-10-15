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
so the run time grows the same way.

Nothing about the source decides it: `(x) => { const a = x ? 1 : 2; return
a + a; }` is written `($0)=>($0?1:2)+($0?1:2)`. A default parameter, as
[#2961](https://github.com/functionalscript/functionalscript/pull/2961)
proposes it, would make the case common, since every read of a defaulted
parameter is such a
conditional — `(a = 42) => a + a` would be written with its test twice — but
it is no cause of it.

### Proposal

In `hoists`, give a `const` to a shared node the scope's root reaches
eagerly, whatever its kind. The reason given for writing such a node in
place holds only where an occurrence is lazy: a node the root reaches
eagerly is evaluated where the scope runs whether or not it is named, so
naming it evaluates nothing the source did not, and reads back as the same
node. The examples above would be written

```js
export default ($0)=>{const $1=$0+1;const $2=$1*$1;const $3=$2*$2;const $4=$3*$3;return $4*$4;};
export default ($0)=>{const $1=$0?1:2;return $1+$1;};
```

linear in the graph. A shared mergeable node reached only through lazy
operands stays in place for now: naming it in the scope would evaluate it
where the source did not, and the block a lazy operand opens for a minting
node ([the writer's header](../module.f.mjs)) is the mechanism that could
name it there, at the cost of an IIFE.

Open for the owner:

- whether every eagerly shared node takes a `const`, or a node whose text is
  shorter than its name and a read of it — `$0.y`, `-$0` — stays in place.
  The proposal is every one: one rule, and the text is linear either way;
- whether the lazy case is worth its block, as a step after this one.

### Tasks

- [ ] `hoists`: a `const` for a shared node the scope's root reaches
      eagerly; the module's header and `hoistedKind`'s comment say why.
- [ ] Proofs: the serializer's own, `../../language.proof.f.mjs` and
      `../../proof.f.mjs`'s `fjsRoundTrip` expectations that pin in-place
      text, and a proof that a chain of nested shared operators is written
      in text linear in its length.
- [ ] `tsc`, `npm start test` under `fjs/compiler`, scoped proof coverage at
      100%.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `hoists`, `hoistedKind`, and the
  header's "What a `const` is for".
- [`../../../edag/analysis/module.f.mjs`](../../../edag/analysis/module.f.mjs)
  — `mergeable`, the nodes the analysis merges and the writer writes in
  place.

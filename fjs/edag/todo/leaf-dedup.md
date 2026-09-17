## Deduplicate strings and bigints

**Priority:** P4
**Status:** open — needs investigation before a decision

### Problem

A primitive is never shared: the DataJS normalized form writes every
primitive inline, since primitive sharing is not observable and counting
primitives by value would raise the `0`/`-0` and `NaN` questions the
`Object.is` guarantee forbids answering
([`spec/datajs/README.md`](../../../spec/datajs/README.md), normalized form),
and the EDAG analysis ([`analysis.md`](./analysis.md)) lists operation
nodes, a primitive taking no index. That is right for a number, a boolean,
`null` and `undefined`, which always fit in a machine word. A string or a
bigint does not: a long string repeated in a graph is written out once per
occurrence and held once per occurrence at run time, and a bigint past what
the VM holds inline likewise, where one copy would do and nothing could tell
the difference.

A string and a bigint are immutable in JavaScript, and their equality is
their whole identity, so deduplicating them by value is safe wherever it is
done, and no `-0`/`NaN` question arises — which is why they, and only they,
are candidates.

### Options

Two questions are open. Neither is decided here; each needs the
investigation listed under Tasks before it is.

**1. Where the rule lives: the DataJS normalized form, or a threshold.**

- *Change the normalized form.* Redefine it so that a string or a bigint
  with more than one occurrence is hoisted into a `const $n`, as a shared
  object or array is, and every occurrence references it; the count is by
  value, since for these two a value is an identity. The rule is then one
  rule for every writer and the FunctionalScript output inherits it. It is a
  breaking change to the normalized text — every document with a repeated
  string gets other bytes and another hash — and it costs bytes for short
  strings: a hoisted `const $0="ab";` plus a `$0` per occurrence breaks even
  against inline copies only around five characters and a few occurrences,
  and a one-character string repeated twice grows the document.
- *A threshold.* Keep the normalized form as it is, and deduplicate only
  above a size — a string of more than *n* code units, a bigint past what
  the VM holds inline. That size is the representation's, not a constant:
  the NaN-box layout of
  [`nanvm-lib/todo/optimal-nanvm.md`](../../../nanvm-lib/todo/optimal-nanvm.md)
  holds 48 bits of bigint inline, and the naive VM of
  [`nanvm-lib/src/naive`](../../../nanvm-lib/src/naive/mod.rs) boxes every
  bigint, so "64 bits" is no VM's cutoff. The threshold would be a
  parameter of the analysis, not a constant of the graph, so that a VM with
  another value representation asks for its own and a writer whose reader
  cannot tell a string from a copy may ask for none; the same graph with
  the same threshold returns the same table, so an output stays canonical.
  The cost is a second knob, and a normalized form that depends on it if a
  writer ever hoists.

The two are not exclusive: the VM's table may use a threshold while the
writers follow the format's rule, or the format may fix one threshold as
part of its definition. What decides between them is the VM's value
representation, which is not designed yet, and the DataJS specification's
own stance that it is meant to stop changing.

**2. Keys.** A string is a key as often as a value, and a hoisted string is
no use to a key unless a key may reference it. One option is the computed
key, `{[$0]:5}`, which JavaScript reads as the property named by `$0`'s
value; the format has a precedent in `["__proto__"]`, its one computed
key today, and a reader would resolve `[$n]` at parse time to the string
the const holds, so the value graph and the AST are unchanged. A `$n` that
holds anything but a string would be refused, not coerced, since `[1]` and
`[null]` are keys in JavaScript too and coercion is a rule the format does
not want. With this, keys and values draw from one pool of strings; without
it, a string used as a key and as a value is deduplicated only as a value.
Whether the format admits it is part of question 1.

### Tasks

- [ ] Investigate the VM's value representation far enough to know which
      strings and bigints it holds inline, and so what a threshold would be.
- [ ] Assess the DataJS change: rewrite the normalized-form rule and the
      computed-key syntax as a draft against
      [`spec/datajs/README.md`](../../../spec/datajs/README.md), measure the
      size effect over the conformance corpus ([`fjs/media/datajs`](../../media/datajs/README.md)), and count the
      documents whose normalized bytes change.
- [ ] Assess the threshold: which default, whether a threshold belongs in
      the analysis's signature or in the format, and whether the
      FunctionalScript writer wants one at all.
- [ ] Decide — one of the two, or both with their division named — and only
      then: the analysis's leaf table with proofs (a listed string once, an
      unlisted one never, a bigint within the rule), the executor holding one
      value per entry, and the writers hoisting per the decision.

### Related

- [`analysis.md`](./analysis.md) — the node table a leaf table would sit
  beside.
- [`spec/datajs/README.md`](../../../spec/datajs/README.md) — the normalized
  form's rule that primitives are written inline, and the `["__proto__"]`
  key that is the computed-key precedent.
- [`../../fsc/serializer`](../../fsc/serializer/module.f.mjs) — the writer
  that would follow whichever rule is chosen.
- [`../../../spec/todo/content-addressable-vm.md`](../../../spec/todo/content-addressable-vm.md)
  — where a value is its content, deduplication is the storage, not a pass.

## method-call-arguments. A node method-call arguments alone share has no Rust spelling

**Priority:** P3
**Status:** open

### Problem

The Rust printer refuses a node that two method calls' arguments share,
and nothing else reaches eagerly:

```js
const o = { f: x => [x] }
export default a => { const t = a.k.m; return [o.f(t), o.f(t)] }
```

`fjs compile` to `.rs` fails with `no Rust for a shared node reached only
through lazy operands; a \`let\` binding would establish what the program
may not`, at `2ca692ba` as now. The `.js`, `.f.js` and value outputs
compile it.

[`../../sharing/module.f.mjs`](../../sharing/module.f.mjs)'s
`eagerOperandsOf` reads a `.` node's receiver and key as eager and its
continuation as lazy: a method call's arguments run only once the access
has not thrown. So `t` is reached only through two thunks, and the printer
has no block to bind it in.

The rest of the compiler reads those arguments as eager.
[`fjs/compiler/ast`](../../../compiler/ast/module.f.mjs)'s `anchors` counts
a method call's arguments as reached, so `t` is no anchor. The
FunctionalScript writer's eager reach, in
[`fjs/compiler/serializer`](../../../compiler/serializer/module.f.mjs),
counts them too. Under the
[failure contract](../../../../spec/README.md#failure-is-one-outcome) the
two readings agree on every outcome: the access is eager wherever the
`.` node is, so either it throws, a failure whatever `t` does, or the
arguments run.

Two programs `2ca692ba` printed now meet the same refusal, each because a
node once anchored before the root no longer is:

- A dead `const w = (() => t)();` beside the program above made `t` an
  anchor. The front end now reads such a call as the alias it is, as
  `const w = t;` is.
- An unread import that another import's node reaches is no anchor
  (`fjs/compiler/edag`'s `anchoredImports`), its module established by that
  import. Where that import reaches it only through method-call arguments,
  `import a from "./m0.f.js"; import b from "./m2.f.js";` beside
  `export default [o.f(a), o.f(a)];` in `m2.f.js`, the printer reads it as
  reached only lazily.

### Proposal

Read a `.` node's continuation as eager up to its first guarded step,
`|?.` or `|?.()`, where the printer decides what is established. A
nullish value there stops the chain without a failure, so the operands
after it stay lazy. Regenerate the Rust fixtures that change, and prove
both programs above against the interpreter.

### Related

- [`../../todo/identity-shared-walks.md`](../../todo/identity-shared-walks.md)

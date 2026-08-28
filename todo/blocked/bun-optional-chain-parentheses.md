## Parentheses do not end an optional chain in bun

**Priority:** P3
**Status:** blocked

### Problem

Parentheses end an optional chain, so a short-circuit does not reach past them.
When `a` is nullish, `(a?.b)(c)` calls `undefined` and throws. JavaScriptCore,
and therefore `bun`, carries the short-circuit through the parentheses instead
and evaluates the whole expression to `undefined`.

Measured against Node v22.22.2 (V8) on `bun` 1.3.11 and 1.4.0 — the latter is
the version pinned in [`fjs/ci/config/module.f.mjs`](../../fjs/ci/config/module.f.mjs),
so this is what CI runs — with `u` nullish:

|expression|Node (V8)|bun (JavaScriptCore)|
|---|---|---|
|`(u?.b)(0)`|`TypeError`|`undefined`|
|`(u?.b.c)(0)`|`TypeError`|`undefined`|
|`(u?.b).c`|`TypeError`|`TypeError`|
|`(u?.(0))(1)`|`TypeError`|`TypeError`|

The two wrong rows are exactly the ones whose grouped step is a call that
consumes a receiver — the `|!()` step of
["Chains"](../../fjs/edag/README.md#chains). The other two agree on every
engine: `(u?.b).c` is a property access, which nests as an ordinary `.` node
over a complete `?.` node, and `(u?.(0))(1)`'s inner call has already cleared
the receiver, so the group's boundary carries nothing.

There are two defects here, and the split matters because only one is bun's own
code:

- **The engine.** `(u?.b)(0)` answers `undefined` in a `.mjs` file, through
  `eval`, and through `new Function` alike. All three hand the source straight
  to JavaScriptCore, so bun's transpiler is not involved in this one.
- **The transpiler.** `` (u?.b)`tag` `` and `new (u?.b)()` are rejected at
  *parse* — `SyntaxError: Cannot use tagged templates in an optional chain` and
  `SyntaxError: Cannot call constructor in an optional chain` — while `eval` of
  the same text throws the correct `TypeError` at run time. Both restrictions
  are real *inside* a chain; the parenthesis ends the chain, so neither applies.

One root cause seen at two layers: the parenthesis ceases to end the chain, so
what holds inside it leaks past.

The cost is that no JavaScript oracle can pin `(u?.b)(...c)` on every supported
runner. `chainsJs.throw` in [`fjs/edag/proof.f.mjs`](../../fjs/edag/proof.f.mjs)
carries two commented-out cases for it, and the tagged-template one must stay
commented rather than merely fail, because a parse error takes the whole file
down. Nothing about the specification is in doubt, and the EDAG is unaffected:
`['?.', u, 'b', ['|!()', c, null]]` denotes the throwing reading, and
`optionRegion.throw.closeStepOnUndefined` in
[`fjs/edag/amnesia/proof.f.mjs`](../../fjs/edag/amnesia/proof.f.mjs) pins it by
evaluating the node, which is an oracle that works on every runner.

### Trigger

Unblocked when a `bun` release satisfies both halves and reaches the pinned
version in `fjs/ci/config/module.f.mjs`:

- `(u?.b)(0)` throws on a nullish `u`, in a module, through `eval`, and through
  `new Function`;
- `` (u?.b)`tag` `` and `new (u?.b)()` parse, and throw at run time.

[oven-sh/bun#31812](https://github.com/oven-sh/bun/issues/31812) tracks the
parse half, filed for the `new` sibling.

### Tasks

- [ ] Re-run the four expressions above on each `bun` bump; this file is the
      record of what the pinned version does.
- [ ] Find or file an upstream WebKit report for the engine half — #31812 is
      bun's parser, and nothing linked here covers JavaScriptCore's evaluation.
- [ ] Once fixed: uncomment `chainsJs.throw.groupedOptionalCall` and
      `groupedOptionalTag` in `fjs/edag/proof.f.mjs` and drop the commentary
      that explains why they are out.
- [ ] Once fixed: trim "Where the host engines disagree" in
      `fjs/edag/README.md` and the matching paragraph in
      `fjs/edag/amnesia/README.md` to the parts that outlive the bug. Keep the
      node-level proof either way — it pins the specification, not the host.

### Related

- [fjs/edag/README.md § Where the host engines disagree](../../fjs/edag/README.md#where-the-host-engines-disagree)
  — the shape of record for the `|!()` step and this divergence.
- [fjs/edag/amnesia/README.md](../../fjs/edag/amnesia/README.md) — `skip` is
  what makes the specified answer come out on every host.
- [interpret-edag.md](../../fjs/djs/todo/interpret-edag.md) and
  [compile-modules-to-edag.md](../../fjs/djs/todo/compile-modules-to-edag.md) —
  executing and lowering `|!()`; neither may take the host's answer for it.
- [spidermonkey-test-runner.md](../../fjs/emergent_testing/todo/spidermonkey-test-runner.md)
  — a third engine, and the task to document every divergence a run finds.

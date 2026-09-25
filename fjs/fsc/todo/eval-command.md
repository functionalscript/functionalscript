## Evaluate a module given as text

**Priority:** P3
**Status:** open

### Problem

There is no quick way to see what a FunctionalScript module evaluates to.
`fjs compile` needs an input file and an output file, and `fjs run` needs a
module exporting a `NodeProgram`. Trying an expression means writing a file,
compiling it to a `.json` and reading that back.

`fjs compile` cannot answer the simplest question either. Its value outputs,
`.json` and `.data.js`, go through `_transpileDefault` in
[`../transpiler`](../transpiler/module.f.mjs), and that path refuses an
operator: `export default 2 + 2;` compiled to `.json` fails with
`an operator has no value`. The EDAG route lowers the operator. The
[memo executor](../../edag/memo/module.f.mjs) can run it. No command connects
the two and prints the result.

### Proposal

Add a command that takes the module's text as its argument and prints the
module's `export default` as JSON on `stdout`:

```sh
fjs eval 'export default 2 + 2;'
# 4
```

The command is `eval`, aliased `e`, following `node -e`. It goes in the
`commands` list in [`fjs/module.f.mjs`](../../module.f.mjs). The logic goes in
`fsc` as `.f.mjs` next to `compile`, and `fjs/module.f.mjs` only registers the
command.

The pipeline reuses what exists and adds no second front end or interpreter:

```text
text
  -> parse                    (../transpiler: parse(path)(text))
  -> refuse any import
  -> unresolved(module).edag  (../edag)
  -> _defaultExport           (../edag)
  -> analysis                 (../../edag/analysis)
  -> memo under catch_        (../../edag/memo, ../../effects/common)
  -> JSON                     (_tryJson in ../module.f.mjs)
  -> log                      (../../effects/common)
```

**The first version does not resolve imports.** A module with any `import`
is refused with a message that says imports are not supported yet. It is not
lowered with its parameter nodes left unbound, and it is not treated as if
the import were missing
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
Because nothing is read from disk, the command needs no `ReadFile` or
`ResolveFileModule`. Its effects are `catch` (below) and writing to `stdout`
and `stderr`.

**A module that parses can still fail when it runs.** `export default null.x;`
parses and lowers, and then `memo` throws the host's `TypeError`. A call that
recurses without end overflows the stack the same way. A plain `.f.mjs`
function cannot turn that throw into a result, so `memo` runs as a thunk under
`catch_` from [`fjs/effects/common`](../../effects/common/module.f.mjs). That
is the host boundary `fjs/emergent_testing` already uses for user code. It
returns `ok(value)` or `error(thrown)`, and the error becomes the command's
diagnostic. Bounding time and memory is not this command's job. That work is
[`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md).

A value JSON cannot spell is refused rather than approximated. This covers
`undefined`, a bigint, `NaN`, the two infinities and a function. The command
applies the same rules as `fjs compile`'s `.json` output, so the two commands
agree on what JSON means. Reuse `_tryJson` for this, exporting it properly if
needed, instead of copying it. A module with no `default` export evaluates to
`undefined` and is refused for the same reason.

**`_tryJson` does not refuse a function today.** A function falls through to
`jsonLeaf`'s default branch and is written as `null`, so
`export default x => x;` would print `null`. `fjs compile` never reaches that
branch, because its value route refuses a function before any JSON is written
(`a function has no value`). `eval` does reach it, because `memo` returns the
function. So `jsonLeaf` gets a `'function'` case that refuses it
(`no JSON spelling for a function`), and the default branch is left with `null`
alone. This is one fix shared by both commands, not a separate check in
`eval`.

Errors exit `1` with the message on `stderr`, like every other command. That
covers a missing argument, a parse error, an import, a throw during
evaluation, and a value JSON cannot spell. A parse error needs a name for its location because there is no file.
Use a fixed pseudo-path such as `<eval>`, so the message reads
`<eval>:line:column - error: …`.

### Open questions

- **Sharing.** The memo executor keeps node identity, so
  `const a = [1]; export default [a, a];` evaluates to an array whose two
  elements are the same array. `fjs compile`'s `.json` output refuses such a
  value (`no JSON spelling for a shared node`). To stay consistent, `eval`
  should refuse it too. Decide where that fact comes from on the EDAG route.
  One option is analysis's `shared` indices restricted to the constructors the
  root scope reaches.
- **Input channel.** The first version takes the text as an argument. Reading
  from `stdin`, for example `fjs eval -` or with no argument, can come later.
- **Output format.** Other formats, such as DataJS for bigints and `undefined`,
  would need an option. They are out of scope. JSON is the first contract.

### Tasks

- [ ] Add the text-to-value function to `fsc`: parse, refuse imports, lower,
      select the default, analyse, and run `memo` under `catch_`. Prove it in
      `fsc`'s `proof.f.mjs` with 100% coverage.
- [ ] Add a `'function'` case to `jsonLeaf` that refuses a function, and prove
      it through `_tryJson`.
- [ ] Add the JSON step and its refusals, reusing `_tryJson`.
- [ ] Register `eval` / `e` in [`fjs/module.f.mjs`](../../module.f.mjs).
- [ ] Prove the cases: `export default 2 + 2;` prints `4`; an object and an
      array print as JSON; a module with an import is refused; a parse error is
      reported at `<eval>:line:column`; `export default null.x;` exits `1`
      with a diagnostic rather than a stack trace; `undefined`, a bigint and
      `export default x => x;` are refused; a missing argument exits `1`.
- [ ] Document the command in the CLI help text and in [`../README.md`](../README.md).

### Related

- [`interpret-edag.md`](./interpret-edag.md): the memo executor this command
  runs. Its open validation tasks apply to this entry too.
- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md): the lowering
  used here.
- [`value-refusal-names-the-output.md`](./value-refusal-names-the-output.md):
  how a value refusal is worded, which `eval` should follow.
- `resolve` in [`../edag`](../edag/module.f.mjs): the file-based linker a
  later version would reuse to resolve imports.

## `fjs compile` refuses arguments it does not read

**Priority:** P4
**Status:** open

### Problem

`compile` in [`../module.f.mjs`](../module.f.mjs) reads `args[0]` as the
input and `args[1]` as the output, refuses fewer than two, and ignores the
rest:

```sh
$ fjs compile ok.f.js ok.json extra.json --tree
$ echo $?
0     # ok.json is written; extra.json and --tree are never looked at
```

Its own refusal says as much: `Requires 2 or more arguments`. A caller who
meant a second input, a second output or a flag —
[`070-fsc-flags.md`](./070-fsc-flags.md) proposes `--tree` and others — gets
a success that did something other than what the command line said.
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
rules that out: an input the code does not handle is refused, never
approximated.

### Proposal

`fjs compile <input> <output>` takes exactly two arguments. Any other count is
refused with one message naming that usage: exit `1`, nothing written. When
flags land, `compile` parses them explicitly and refuses one it does not know,
rather than reading "2 or more" as "anything after".

The count is the check
[positional-arity-check](../../cli/todo/positional-arity-check.md) proposes
sharing among commands, and an unknown flag the refusal
[options-edsl](../../cli/todo/options-edsl.md) plans for every command. If
either lands first, `compile` uses it; if this lands first, that issue
migrates `compile` with the others, and nothing here waits for it.

A command line that ran before is refused after, so the pull request that
lands this declares it a breaking change.

### Tasks

- [ ] `compile` refuses every argument count but two, with a message naming
      `fjs compile <input> <output>`.
- [ ] A too-many-arguments case beside `tooFewArgs` in
      [`../proof.f.mjs`](../proof.f.mjs): exit `1`, the message, and no
      output file.
- [ ] `spec/README.md`'s Command Line drops its pointer to this issue.

### Related

- [`070-fsc-flags.md`](./070-fsc-flags.md) — the flags that would give an
  argument after the output a meaning.
- [`fjs/cli/todo/positional-arity-check.md`](../../cli/todo/positional-arity-check.md)
  — the per-command arity check this is one more copy of until it lands.
- [`fjs/cli/todo/options-edsl.md`](../../cli/todo/options-edsl.md) — declared
  options, which refuse an unknown one.
- `commands` in [`fjs/module.f.mjs`](../../module.f.mjs) — `compile` and its
  alias `c`.

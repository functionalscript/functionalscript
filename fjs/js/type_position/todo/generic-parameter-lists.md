## Parameter lists after a generic list or a generator's `*`

**Priority:** P4
**Status:** open — deferred from
[#3649](https://github.com/functionalscript/functionalscript/pull/3649) as a
missed colour, not a wrong one

### Problem

`typePositions` in [`js/type_position`](../module.f.mjs) reads a `(` as a
parameter list only where it is certain to be one, and `isParams` decides
that by looking at the token right before it: `function`, or a name after
`function`. A generic list or a generator's `*` comes between, so the
lookbehind no longer reaches `function` or the method's name, and the list
is read as a call's arguments:

- `function f<T extends string>(x: number): boolean {}`
- `function *g(x: number): boolean {}`
- `const o = { m<T>(x: number): boolean {} }`

At `d60e7ea1`, none of these colours anything, where
`function f(x: number): boolean {}` colours `number boolean`. The generic
list itself is not read as a type either, so `string` in `T extends string`
stays a name. A generic arrow, `<T,>(x: number): boolean => x`, already
colours, because the arrow after the list decides it.

This is a missed type, which costs a colour. It does not take a value for a
type, which is the error the module refuses. No `ts` fence in the
repository's Markdown had one of these forms when it was deferred, so a fix
coloured nothing then.

### Proposal

Look past the generic list and the `*` before deciding:

- After `function`, `function *`, `function name` or `function *name`, a `<`
  opens the function's type parameters, a type frame, for certain.
- `isParams` skips back over that list and a `*` before testing for
  `function` or the name.
- A method's `m<T>(…) {` needs the list matched forward from its `<`, then
  the `(…)` closed and followed by `{` on the same line, as a method without
  a list already is. In a value, `a < b > (c)` is a comparison, so the
  lookahead must keep that reading wherever the `{` does not follow.

### Tasks

- [ ] Open a type frame for a function's generic list after `function`,
  `function *` or the function's name.
- [ ] Let `isParams` see `function` or the name past a generic list and a `*`.
- [ ] Accept a generic method's list where its `(…)` is followed by `{` on
  the same line, and keep `a < b > (c)` a value.
- [ ] Prove each form, and the comparison, in `proof.f.mjs`.

### Related

- [#3649 review thread](https://github.com/functionalscript/functionalscript/pull/3649#discussion_r4463982408)
  — where the case was found and deferred.
- [`fjs/text/marked/README.md`](../../../text/marked/README.md) — the design
  record for colouring primitive names where a type stands.

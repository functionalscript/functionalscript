## body-const-forward-reference. A body `const` read before its declaration

**Priority:** P3
**Status:** open

### Problem

A function body that reads a name from a scope around it, and then declares
a `const` of the same name, is refused with `capture shadowed`:

```js
const x = [1];
export default (...a) => { const y = x; const x = 2; return y; };
export const f = (...a) => { const g = (...b) => x; const x = 2; return g; };
```

JavaScript resolves every reference in the body to the body's own `const`,
the ones written before it included: the first body throws when it reads
`x` before its declaration, and `g` in the second reads the body's `x`,
`2`, once called. The resolver in [`../module.f.mjs`](../module.f.mjs)
resolves a reference where it is written, against the names bound so far,
so it would read the module's `x` — a plausible wrong value — and the
program is refused instead
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

The refusal is a gap, not a rule of the language: nothing leaks through
such a program, and the language refuses at compile time only what could
leak a side effect. It is the body's case of
[forward references](../../../../spec/todo/3140-forward-references.md),
which a module's `const`s have too (`const not found` today).

### Direction

Resolve a body's names against every `const` it declares, not only the
ones before the reference: a reference to a later `const` from the body's
own statements is the body's, read before its declaration — a failure when
evaluated, as JavaScript's temporal dead zone is — and one from a function
written in the body is a capture of that `const`, which the frame can hold
only once the `const` is established, so the function has to be built after
it. How the EDAG spells the failure and the late frame is the
implementation's to decide, together with
[forward references](../../../../spec/todo/3140-forward-references.md).

### Tasks

- [ ] Decide the lowering of a read before declaration and of a capture of
      a later body `const`.
- [ ] Resolve a body's references against all its `const`s; remove
      `capture shadowed`.
- [ ] Proofs, and the spec's capture rule updated.

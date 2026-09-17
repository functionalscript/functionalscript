# No Shadowing

**Priority:** P4
**Status:** open — a warning or an error, undecided

## Problem

JavaScript lets a nested function bind a name an enclosing scope already
binds, and the inner binding hides the outer one in the body. The parser
accepts it today: a parameter may shadow a module name, as the specification
says ([functions](../README.md#functions)), and a nested function may shadow
the parameter of the function around it.

```js
const a = 1;
export default (...a) => (...a) => a;   // three `a`s, the innermost read
```

A duplicate in one scope, `const a = 1; const a = 2;`, is already refused
(`duplicate id`). Across scopes nothing is, and the reader has to count
arrows to know which `a` a body reads. The cost grows with the language:
once a function can capture ([function-frame](./3111-function-frame.md)), a
name in a body may read its own parameter, an enclosing function's, or a
module constant, and only the absence of shadowing makes the answer the
nearest binding *and* the only binding of that name. A refactoring that
moves an expression out of a body, or into one, changes its meaning exactly
when a name is shadowed, and silently.

## Proposal

A module is a function: its imports are its parameters, its constants are
its body constants, and `export default` is its `return` — which is how the
compiler already reads it, an import being `args[i]` of the module and
linking being application. So there is one rule, for a module and a nested
function alike: a binding must not reuse a name bound in an enclosing
function. A parameter must not repeat an import, a constant, or an
enclosing function's parameter, and neither must a body constant
([body-const](./3130-body-const.md)), which the language now has and which
may take a module's name today — one of the spellings this issue would
refuse, and the one with the least to hide: a body cannot reach the module's
scope at all, a reference out being a capture, so the name it takes was
unreachable rather than visible.
Two modules are two functions with nothing enclosing them both, so they may
bind the same names.

Every FunctionalScript program stays a JavaScript program: the rule refuses
a spelling JavaScript accepts, never reads one another way, so a module that
passes is the same module to both.

Whether the rule is a warning or an error is open:

- *An error.* The simplest: the compiler has errors and nothing else, so the
  rule is one more refusal at the shadowing name, `shadowed name`, and a
  module either compiles or does not. It reverses the sentence in the
  specification that lets a parameter shadow a module name.
- *A warning.* Keeps every accepted module accepted, at the cost of a
  diagnostics channel the compiler does not have — a result that is `ok`
  and carries findings — and of deciding what `fjs compile` and `fjs test`
  do with one. That channel would be the first of its kind, and a rule of
  taste is a thin reason to build it; if other warnings appear, this one
  joins them.

The choice waits on whether any other rule wants a warning. Until then the
error is the default to implement, since it needs nothing new.

## Tasks

- [ ] Decide warning or error, per the above.
- [ ] The parser refuses (or reports) a parameter that repeats a module name
      or an enclosing parameter, at the name, with proofs for each pair:
      module constant, import, enclosing parameter, and a nested function
      two levels down; a name reused in sibling functions is fine.
- [ ] `spec/README.md`: the Functions section's "may shadow a module name"
      replaced by the rule.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

## Related

- [function-frame](./3111-function-frame.md) — captures, which make the
  binding a name reads a question of scope.
- [body-const](./3130-body-const.md) — the second kind of binding a body
  has.
- [parameters](./3120-parameters.md) — named parameters, more names to
  shadow with.

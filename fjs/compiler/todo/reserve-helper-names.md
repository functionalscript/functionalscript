# Reserve the helper names a built-in's replacement takes

**Priority:** P3
**Status:** open

## Problem

A built-in the language lacks is implemented first as an ordinary
FunctionalScript function, in an authored `.f.js`, and taken into the
language later ([`doc/CONVERTING.md`](../../../doc/CONVERTING.md)). The
first two of these that stand in for a JavaScript global, `isNaN_` in
[`fjs/types/number/is_nan`](../../types/number/is_nan/module.f.js) and
`isFinite_` in [`fjs/types/number/is_finite`](../../types/number/is_finite/module.f.js),
end in `_` so that they never shadow the global of the same name: a bare
`isNaN(x)` in a module being converted stays the global's call, refused by
the compiler, instead of silently becoming the helper's.

Nothing stops a module from binding a `const isNaN_` of its own, though.
When the language takes the helper in, a module that had bound the name
changes meaning, which is the breaking change
[`spec/todo/2365-global-names.md`](../../../spec/todo/2365-global-names.md)
reserves a name early to avoid.

## Proposal

Reserve `isNaN_` and `isFinite_` as `Number` is reserved: a module may
import them and may not bind them. Add each name a helper of this kind
takes to the same list when the helper lands, before any module could have
bound it. The list is the compiler's; whether it lives beside
`reservedGlobals` in [`fjs/js/keywords`](../../js/keywords/module.f.js) or in
a list of its own is the implementer's to decide.

The names are a convention as well as a list: a helper that replaces a
JavaScript global takes the global's name with a trailing `_`, so that the
replacement reads as what it replaces and shadows nothing.

## Tasks

- [ ] Reserve `isNaN_` and `isFinite_`, with a parser proof that a module
  binding either is refused and one importing either is accepted.
- [ ] Say in [`doc/CONVERTING.md`](../../../doc/CONVERTING.md) that a new
  global-replacing helper reserves its name in the same pull request.

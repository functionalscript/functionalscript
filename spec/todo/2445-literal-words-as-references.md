# Literal words as references

**Priority:** P5
**Status:** open

## Problem

FunctionalScript reserves `undefined`, `NaN` and `Infinity`: a module may
not bind or shadow them, so each denotes its value wherever a value stands
([numbers](../README.md#numbers)). JavaScript does not reserve them. There
they are globals — properties of the global object, `NaN` and `Infinity`
non-writable — so an `IdentifierReference` may name them, and a module may
shadow `undefined` with a binding of its own.

The two rules give the same answer almost everywhere: `export default NaN;`
is the number in both languages, and `{ NaN: 1 }` and `a.NaN` are a key and
an access in both. They differ where JavaScript wants a reference and
FunctionalScript has only a value, and today that is one place: the
[shorthand member](../README.md#objects). `{ NaN }` is `{ NaN: NaN }` in
JavaScript and `reserved word` in FunctionalScript, which refuses the
shorthand of every reserved word
([shorthand](./2440-shorthand.md)), as JavaScript refuses `{ null }`,
`{ true }` and `{ typeof }`.

The restriction is justified by the rule above, not by the shorthand, and
no authored module writes the three shorthands. What is open is whether a
reserved word that denotes a value may also stand as a reference, which
would admit the three shorthands and nothing else that is known. The
strict-mode restricted names, `arguments` and `eval`, are not part of the
question: JavaScript lets strict code reference them, but FunctionalScript
has no free names, so `{ eval }` is refused under either rule, and only the
message would differ.

## Related

- [shorthand](./2440-shorthand.md) — the one place the difference shows.
- [global-names](./2365-global-names.md) — reserves every global, the
  opposite direction: it lists these three among the names refused already,
  and a rule admitting them as references has to agree with it.
- [`fjs/js/keywords`](../../fjs/js/keywords/module.f.mjs) — the groups:
  `literalGlobals` are the three words, `restrictedNames` the two.

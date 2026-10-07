# Shorthand members

**Priority:** P1
**Status:** proposed — awaiting language-design approval

## Problem and proposal

Repository modules write object members as a name alone, the shorthand
JavaScript reads as the name twice, `{ a }` for `{ a: a }`; `fn` in
`fjs/types/function` returns `{ result, map: … }`. The compiler refuses it at
the `,` or `}` after the name, and it is the first refusal of 23 of the 221
authored `.f.mjs` modules
([the survey](../../todo/fjs-nanvm-integration.md#the-whole-repository)).

Admit a member that is an identifier alone. It denotes the keyed member
`a: a`: the name is the key, and a reference to the name — a `const`, an
import, a parameter — is the value, resolved and refused as any reference is.
`{ b }` with nothing binding `b` is `const not found` at the name; `{ typeof }`
and `{ null }` are `reserved word`, as a reference to a keyword is anywhere.
Only the identifier spelling of a key has the shorthand: `{ "a" }` and
`{ ["a"] }` stay refused, the key alone being no reference. The shorthand
denotes an own property whatever the name, as JavaScript's does, so
`{ __proto__ }` is a property named `__proto__`, accepted where
`{ __proto__: v }` is refused: JavaScript's prototype rule names the keyed
spellings alone ([the `__proto__` key](../README.md#the-__proto__-key)).

```js
const a = 1;
const b = [a];
export default { a, b, c: 3 };   // { a: 1, b: [1], c: 3 }
```

Depends on [property keys](../README.md#property-keys).

## Benefits and drawbacks

It preserves a JavaScript convention the repository writes everywhere, at no
new semantics: a shorthand member is the keyed member it denotes, so the AST,
the EDAG, both writers and the Rust printer need no change, and the source
writer spells it back as `a: a`. It unblocks the 23 modules above at their
first refusal and removes the one feature `fjs/types/function` waits on
besides `iterate`'s loop.

It costs one more branch of the grammar's member rule — the bare identifier
with an optional `: value`, the string and computed keys keeping theirs — and
the syntax's member record saying which spelling the key took, since the
`__proto__` rule has to tell the shorthand from the plain spelling and a
boolean cannot. The grammar rule `key` folds into `member`, and the record's
`computed` boolean becomes `spelling`: a breaking change of the parser's API,
to be declared by the implementing pull request. No other drawback is known:
the shorthand adds no spelling JavaScript lacks and refuses nothing JavaScript
accepts.

## Authorization and approval

The task owner asked for the feature in the session that produced
[#2641](https://github.com/functionalscript/functionalscript/pull/2641),
which implements it. That is implementation authorization, not the
language-design approval DESIGN.md §12 asks for; the proposer is the
implementation agent, and the authorized language designer is
`sergey-shandar`. The implementation was written before this proposal was,
which this document does not claim as compliant: it lands, with the
approval below, before the implementation does.

- [ ] Approved by `sergey-shandar`.

## Tasks

- [ ] Obtain the approval above.
- [ ] Land [#2641](https://github.com/functionalscript/functionalscript/pull/2641)
      on top of this proposal: the grammar, the syntax record, the fold's
      `__proto__` rule, the proofs, the spec's objects section, and this
      file's deletion.

## Related

- [objects](../README.md#objects) — where the spec describes members.
- [`fjs/compiler/parser/README.md`](../../fjs/compiler/parser/README.md) —
  the grammar the member rule belongs to.
- [Integration survey](../../todo/fjs-nanvm-integration.md) — the leaf and
  whole-repository tables the feature changes.

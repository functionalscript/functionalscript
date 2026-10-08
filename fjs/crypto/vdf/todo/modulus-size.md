## Modulus size

**Priority:** P3
**Status:** open

### Problem

The documentation calls the Sloth modulus `p` a 3072-bit safe prime: the
`@module` JSDoc of `module.f.mjs`, the comment on its `p` export, and the
opening line of [README.md](../README.md). The constant is 1024 bits — 256
hexadecimal digits (`p.toString(2).length` is 1024 at `075c0811c`).

The comment on `p` also says it is the "same as reference implementations"
(pulsar's `SlothVDF.ts` and dignity.js's `sloth-vdf.js`, linked from the
README). So one of two things is wrong, and which one is not yet known:

- the documentation, if the references use this same 1024-bit prime; or
- the constant, if the references use a 3072-bit prime and `p` differs from
  theirs — in which case the proof vectors' claim to match the references
  needs checking too.

### Proposal

Compare `p` with the moduli in both reference implementations. If they match,
correct "3072-bit" to "1024-bit" in the three places. If they do not, decide
which modulus the module should use, and correct either the constant (with
its proof vectors) or the claim of matching the references.

### Tasks

- [ ] compare `p` with pulsar's and dignity.js's modulus
- [ ] correct the documentation or the constant accordingly

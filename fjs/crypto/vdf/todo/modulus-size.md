## Modulus size and safety

**Priority:** P3
**Status:** open

### Problem

The documentation calls the Sloth modulus `p` a 3072-bit safe prime: the
`@module` JSDoc of `module.f.mjs`, the comment on its `p` export, and the
opening line of [README.md](../README.md). The constant is 1024 bits — 256
hexadecimal digits (`p.toString(2).length` is 1024 at `075c0811c`).

It is not a safe prime either. A safe prime is `2q + 1` with `q` prime, but
`(p - 1) / 2` is divisible by 3 (measured at `4269034b8`). `p` itself passes a
Fermat test and is `3 (mod 4)`, which is what Sloth's square root needs; it
does not need a safe prime. So "safe" is wrong whichever modulus is kept,
unless the modulus is replaced by one that is safe.

The comment on `p` also says it is the "same as reference implementations"
(pulsar's `SlothVDF.ts` and dignity.js's `sloth-vdf.js`, linked from the
README). So one of two things is wrong, and which one is not yet known:

- the documentation, if the references use this same 1024-bit prime; or
- the constant, if the references use a 3072-bit prime and `p` differs from
  theirs — in which case the proof vectors' claim to match the references
  needs checking too.

### Proposal

Compare `p` with the moduli in both reference implementations. If they match,
correct "3072-bit safe prime" to "1024-bit prime" in the three places. If they
do not, decide which modulus the module should use, and correct either the
constant (with its proof vectors) or the claim of matching the references.

Either way, the word "safe" goes unless the modulus kept is checked to be a
safe prime. The task is not done while any of the three places still
contradicts the constant.

### Tasks

- [ ] compare `p` with pulsar's and dignity.js's modulus
- [ ] correct the size in the documentation, or the constant
- [ ] drop "safe", or use a modulus checked to be a safe prime

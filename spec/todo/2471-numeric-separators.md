# Numeric separators

**Priority:** P1
**Status:** wip — implementation complete; linked language-design approval pending

## Problem and proposal

Repository modules use JavaScript numeric separators that the compiler formerly
refused. Admit a single `_` between digits in decimal integers, fractions and
exponents, and binary and hexadecimal digit runs. Bigints admit separators in
their supported integer spellings. Separators change spelling alone; rounding,
exact bigint values and negative zero remain unchanged. Numeric property keys
use the same values. Keep JSON syntax unchanged.

Reject leading, trailing or repeated separators; separators next to a radix
prefix, decimal point, exponent marker or sign, or bigint suffix; and separators
after a leading decimal zero. Octal and leading/trailing decimal-point spellings
remain separate features.

## Benefits and drawbacks

This preserves JavaScript compatibility and improves readability of long numbers
and grouped bit patterns, unblocking existing repository modules. The cost is
additional digit-run grammar and separator-placement tests, plus removing
separators at numeric conversion boundaries. Number tokens preserve their source
lexemes so consumers retain lossless lexical information.

## Authorization and approval

The task owner explicitly requested “Implement `_` as a separator on top of this
PR” and clarified “I mean in numbers” in the Codex session that produced PR #2639.
This records implementation authorization, not a fabricated independent approval.
The proposer is the implementation agent. The authorized language designer is
`sergey-shandar`; a linked, explicit language-design approval is still required
before landing under DESIGN.md §12. The proposal was recorded during review,
after implementation, rather than before it; this timing is not claimed compliant.

## Tasks

- [x] Implement and prove supported number and bigint spellings and refusals.
- [x] Exercise separated literals through the Rust harness.
- [x] Reconcile the spec and roadmap with the implemented syntax.
- [ ] Obtain and link explicit language-design approval from `sergey-shandar`.

## Related

- [Implementation PR](https://github.com/functionalscript/functionalscript/pull/2639)
- [Design review comment](https://github.com/functionalscript/functionalscript/pull/2639#discussion_r4204163935)
- [Binary literal proposal](./2470-binary-literals.md)
- [Integration survey](../../todo/fjs-nanvm-integration.md)

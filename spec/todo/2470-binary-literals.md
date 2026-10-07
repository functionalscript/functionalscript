# Binary numeric literals

**Priority:** P1
**Status:** wip — implementation complete; linked language-design approval pending

## Problem and proposal

Repository modules use JavaScript binary literals, which the compiler formerly
refused. Admit `0b` and `0B` followed by one or more binary digits, optionally
suffixed with `n`. Use JavaScript Number rounding for numbers and exact BigInt
conversion for bigints. Preserve unary negative zero. Refuse missing or invalid
digits, fractions, exponents and adjacent identifiers.

## Benefits and drawbacks

This preserves familiar JavaScript spelling and makes bit patterns readable,
unblocking compiler compatibility without adding a runtime representation.
The cost is another numeric grammar alternative and its boundary tests.
Numeric separators are a separate feature; octal remains unsupported.

## Authorization and approval

The task owner explicitly requested “Implement a numeric binary literal `0b`
from todo/fjs-nanvm-integration.md” in the Codex session that produced PR #2638.
This records implementation authorization, not a fabricated independent approval.
The proposer is the implementation agent. The authorized language designer is
`sergey-shandar`; a linked, explicit language-design approval is still required
before landing under DESIGN.md §12. The proposal was recorded during review,
after implementation, rather than before it; this timing is not claimed compliant.

## Tasks

- [x] Implement and prove both prefixes, number and bigint semantics and refusals.
- [x] Exercise compilation through the Rust harness.
- [x] Reconcile the spec and roadmap with the implemented syntax.
- [ ] Obtain and link explicit language-design approval from `sergey-shandar`.

## Related

- [Implementation PR](https://github.com/functionalscript/functionalscript/pull/2638)
- [Design review comment](https://github.com/functionalscript/functionalscript/pull/2638#discussion_r4204083800)
- [Integration survey](../../todo/fjs-nanvm-integration.md)

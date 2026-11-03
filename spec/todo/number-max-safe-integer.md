# Desugar Number.MAX_SAFE_INTEGER

**Priority:** P2
**Status:** wip

## Problem

The compiler refuses `Number.MAX_SAFE_INTEGER`, blocking `fjs/types/version`.

## Proposal

Read the Number namespace's MAX_SAFE_INTEGER member as its numeric value in the compiler. Use `Number.MAX_SAFE_INTEGER` in the compiler implementation rather than a handwritten numeric constant. Dot access, constant bracket access, and namespace destructuring follow the existing static-member rules; guarded namespace access and dynamic keys remain refused. No new EDAG operation or runtime implementation is needed.

Benefits: existing JavaScript source compiles unchanged and all output writers reuse numeric literals. Drawback: the closed Number namespace gains one explicitly admitted value member.

The task owner explicitly requested this implementation in [the working session](https://chatgpt.com/local/01a19f98-0942-73e9-86cb-c7b41536801e).

## Tasks

- [ ] Lower the namespace member to its numeric value and prove accepted and refused access forms.
- [ ] Document the admission and migrate any module the compiler now accepts whole.
- [ ] Run type checking, scoped proofs and coverage, and the authored-source compiler check.

## Support asynchronous Node effects natively

**Priority:** P3
**Status:** open

### Problem

Some effects in [`fjs/effects/node/`](../fjs/effects/node/) need asynchronous
execution to preserve their observable contracts. The minimal synchronous
runner does not supply that execution support.

This is the asynchronous part of the [native Node-effects task](./nanvm-effects-node-operations.md),
within its native scope. The referenced directory defines the evolving effect
set; do not duplicate its enumeration here.

### Tasks

- [ ] Define and implement the execution support needed for those effects,
      separately from the minimal synchronous runner.
- [ ] Implement those effects and verify equivalent observable behavior against
      the Node runner.

Execution design and individual effect implementation details remain
unspecified by this TODO. This work is not a prerequisite for completing the
minimal synchronous runner or its synchronous effect implementations.

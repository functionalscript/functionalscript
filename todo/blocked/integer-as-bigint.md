# Integer literal `123` is a `bigint`

**Priority:** P3
**Status:** blocked

### Problem

In JavaScript, `123` is a `number` (IEEE 754 double), which loses precision for large
integers and conflates integer and float semantics. FunctionalScript would prefer `123` to
be a `bigint` for exactness.

### Trigger

Unblocked when ECMAScript introduces a syntax or type-level mechanism that makes integer
literals default to `bigint`, or when a TC39 proposal reaches Stage 4 that enables this
distinction without a suffix (`123n`).

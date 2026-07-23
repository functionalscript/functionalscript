# Integer literal `123` is a `bigint`

**Priority:** P3
**Status:** blocked

### Problem

In JavaScript, `123` is a `number` (IEEE 754 double), which loses precision for large
integers and conflates integer and float semantics. FunctionalScript would prefer `123` to be a `bigint` for exactness.

### Trigger

Most likely, ECMAScript never introduce bigint as the main integer type for such functions as `.length`.

### Related

- [new-pl.md § Numbers](../new-pl.md#numbers) — a from-scratch PL isn't bound by ECMAScript's backward-compatibility constraint and adopts `123` = `bigint` directly instead of waiting on this trigger.
- [fjs/djs/todo/json-bigint-serialization.md](../../fjs/djs/todo/json-bigint-serialization.md) — a buildable-today, JSON-compatible instance of the same underlying idea, scoped to serialization rather than the full language.

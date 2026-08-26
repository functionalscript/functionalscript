## `RequestListener` stateful

**Priority:** P3
**Status:** open

`RequestListener` should not be stateless. Options:

1. Pass a state parameter.
2. In-memory key-value storage accessed via effects.
3. One function for all events that also passes state, similar to a `scan` function.

### Related

- [`fjs/web`](../../../web/README.md) — the first real consumer. It is stateless
  by design, so it is not blocked by this question, but what it needed (and did
  not) is evidence for whichever option is chosen.

# 124. `RequestListener` should not be stateless.

Options:
1. One option is to pass a state.
2. In-memory KeyValue storage with access using effects.
3. One function for all events that also pass a state, similar to a `scan` function.

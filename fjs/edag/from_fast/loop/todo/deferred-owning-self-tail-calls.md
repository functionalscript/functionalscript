## Preserve owning self tails in deferred return recipes

**Priority:** P2
**Status:** open

### Problem

The source-loop ownership fix runs after memo normalization. Current source
normalization establishes computed initializers as required values; its lazy
local definitions are reference aliases. Consequently, source self tail calls
remain visible to the owning-tail pass. Supplied normalized FAST can also have
genuine lazy initializer blocks with owning-function returns. Memo lowering can
hide their self tail calls inside a private recipe before that pass runs.

For example, this illustrative FAST notation has a lazy cell whose first demand
returns from its owning function, rather than yielding normally:

```text
function F(n), self = F {
    lazy cell = block {
        if (n === 0) { return F 7 }
        return F self(n - 1)
    }
    terminal loop L() {
        return F cell
    }
}
```

Constructing this valid FAST directly and emitting general JavaScript returns
`7` for `F(3)`, but `F(100_001)` raises `RangeError`. The recipe captures `F`
and transports a return completion; output recovery does not see an owning
self tail transition. This input does not come from the current source subset.

### Tasks

- Preserve function-owned tail control through deferred return recipes, without
  turning it into an outer-loop transfer hidden inside a value operand.
- Retain first-demand cell behavior, selected evaluations, fresh invocation
  locals and exact return ownership.
- Cover deep native JavaScript and Rust execution for a directly constructed
  lazy FAST input.

### Related

- [Shared lazy demand state](../../loops.md#shared-lazy-demand-state).
- [Owning-tail normalization](../owning/module.f.mjs).
- [Session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).

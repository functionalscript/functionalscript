## Sequence demands owned entirely inside operands

**Priority:** P2
**Status:** open

### Problem

Recipe planning can select a lazy declaration and its loops entirely inside an
operand. A free-binding check on the containing operation cannot see those
bound identities. Hoisting the operand's memo updates before exposing its
evaluation region can execute skipped work or reorder reached work.

For example, this structured FAST should yield `undefined` without demanding
`local`:

```text
lazy outer = null?.(block {
    loop L() -> result {
        lazy local = block { throw "unreached" }
        loop M() -> used { break M(local) }
        break L(used)
    }
    yield result
})
loop demand() -> observed { break demand(outer) }
yield observed
```

`outer` crosses the caller's loop; `local` crosses the inner recipe-owned
loop. Both therefore have cells, but the optional call has no free selected
alias. The normalizer currently refuses such unexposed demands explicitly.
The same boundary applies to array/call/object spreads and non-spread object
entries: expansions and key conversions must precede later operand work.

### Tasks

- [ ] Account for selected loop/declaration occurrences inside operands when
      deciding which evaluation regions to expose.
- [ ] Preserve optional skips, expansion order, key-before-value conversion,
      cell lifetimes and exact control ownership.
- [ ] Admit the refusal fixtures with execution, stable graph round-trip and
      JavaScript/Rust proofs. Keep ordinary function bodies and deferred
      initializer boundaries distinct.

### Related

- [FAST loop construction](../../../../edag/todo/fast-loop-construction.md)
  owns the remaining operand and memo work.

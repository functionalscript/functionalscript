- `emergent_testing`: the browser page runs the same proof traversal as `fjs t`
  instead of its own copy, through a new browser effect interpreter. Its
  per-proof batching is gone, so both runners now schedule identically

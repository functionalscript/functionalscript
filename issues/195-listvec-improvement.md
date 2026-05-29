# 195. Improve `listToVec` from `bit_vec` by changing concatenation order.

**Priority:** P3
**Status:** open

Instead of
`(((((a + b) + c) + d) + e) + f)` which can be very slow for huge bigint, we can do
`(((a + b) + (c + d)) + (e + f))`. The number of operations that works with huge bigints is much smaller, $O(n)$ vs $O(\log n)$. We will still use the `fold` operation, but it will accumulate a binary tree branch. We can make this algorithm generic.

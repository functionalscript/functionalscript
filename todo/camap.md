## An internal representation of a map CAPL

**Priority:** P4
**Status:** open

If properties are ordered (e.g lexicographically), we can use first-bit split (similar to a prefix tree aka trie) to make a structure, then the substructures become stable (don't depend on creation order) and can be deduplicated.

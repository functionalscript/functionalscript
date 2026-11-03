## Explicit octal numeric literals

**Priority:** P2
**Status:** wip

Accept `0o` and `0O` followed by octal digits for numbers and BigInts, with the existing separator and token-boundary rules. Decode through the current Number/BigInt path. Keep legacy leading-zero literals such as `017` rejected, as required in JavaScript modules and strict mode. JSON and DataJS numeric grammars remain unchanged.

Benefit: parses existing Git config and tree proof literals without rewrites. Cost: one radix grammar branch and proofs for malformed digits, separators, rounding and BigInt precision.

The language designer sergey-shandar explicitly approved this feature in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019), under DESIGN.md §12.

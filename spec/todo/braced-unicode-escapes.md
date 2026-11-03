## Braced Unicode escapes

**Priority:** P2
**Status:** wip

Accept ECMAScript `\u{...}` code-point escapes in quoted FJS strings and templates. This removes a dependency-scan failure in the serializer proofs and shares the existing template decoder's bounded Unicode accumulation. Keep JSON's grammar unchanged. Empty, malformed and out-of-range escapes must fail; fixed-width escapes and the ban on `\0` remain unchanged.

Benefit: familiar JavaScript spelling for supplementary code points. Cost: quoted-string decoding must report invalid code-point ranges.

Designer sergey-shandar requested this feature in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019), providing explicit approval under DESIGN.md §12.

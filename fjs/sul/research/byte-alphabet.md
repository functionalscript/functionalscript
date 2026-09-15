# Byte symbols at level zero

Starting from bytes is a useful option in this experiment. Against the preceding
native-bit word hierarchy, the byte variant produces smaller complete encodings
on five of ten inputs, equal sizes on two, and larger sizes on three. Source code
improves by 20.9%, JSON by 21.7%, and repeated sentences by 15.9%. This supports
keeping the starting alphabet as a design choice; it does not establish a
universally better replacement for the current SUL representation.

This follow-up retains the [ordered dictionary procedure](ordered-dictionaries.md):
first occurrence determines compact consecutive IDs and dictionary order, the
encoder tries to compress the dictionary at lower levels, and a level is retained
only when its reconstruction recipe plus encoded lower dictionary pays for itself.
An unhelpful level is skipped; searching continues below it. First-occurrence
order is a fixed rule here, not a proven optimal dictionary permutation.

## What changes

The native implementation at
[`d16a9ebf39b30a42e1b795bc329774d867196841`](https://github.com/functionalscript/functionalscript/tree/d16a9ebf39b30a42e1b795bc329774d867196841/fjs/sul)
starts with three literal levels for the bit alphabet. Its literal constructor
represents an alphabet of size `2^e + 1`; calling it with `e = 8` would mean 257
symbols, not the 256 byte values. Therefore simply changing that argument would
not implement the requested byte alphabet.

The new builder uses unsigned byte values `0..255` as level-zero symbols. Each
byte is represented by the existing `rawId(vec(8)(value))`, which preserves their
numeric ordering. It invokes the pinned SUL hash-level encoder from the first
word generation onward, using the existing raw concatenation, Patricia prefix
construction, and hash transition. Short concatenations remain inline up to the
native raw-ID limit; larger combinations use the existing hash machinery.

A word still consists of a strictly decreasing prefix and the next symbol that
is greater than or equal to its predecessor. Completed words become symbols for
the following generation. Each generation preserves content order, and repeated
IDs at the same generation share a node. The top-down codec sees these word
generations, ending with whole-byte leaves. It does not split those leaves to
perform another dictionary pass over individual bits.

This is an experimental **SUL word/hash variant**, not the native bitstream SUL
identity, and not an implementation of a new mathematical literal-rank encoder
for a 256-symbol alphabet. It changes word boundaries and root IDs. A storage
system adopting it would need to identify its alphabet and construction version
explicitly. The experimental compressed stream itself needs neither those IDs
nor an external dictionary to decode: it transmits the reconstruction information.

For a controlled comparison, the same new builder also runs with raw one-bit
leaves, `rawId(vec(1)(value))`. That control skips the native literal pipeline too.
Thus byte versus matched raw bit tests the starting-symbol width under one
construction; byte versus native bit also includes the change in literal/hash
transition. Only word-generation frontiers are tested in this follow-up; the
previous Patricia-height measurements remain available in their separate report.

## What stays the same

Both widths import the identical ordered dictionary codec and arithmetic coder
from the preceding experiment. They use the same candidate search, raw/arithmetic
alternatives, first-use reference convention, bit-length metadata, dictionary
ordering, 14-byte frame, and whole-document fallbacks. Entry lengths are still
expressed in bits, even for the byte variant; there is no additional optimization
for lengths known to be multiples of eight.

Arithmetic coding remains **adaptive binary arithmetic coding**. Each context
starts with counts `[1, 1]`, updates after every emitted or decoded bit, and
rescales at total 16,384. No precomputed probability table is sent. Recipes start
fresh models, with contexts for counts, lengths, first-use markers, and reference
ID decision trees. The terminal literal body uses the previous eight transmitted
literal bits as its context, continuing across dictionary-entry boundaries.

Bytes are the tree's base alphabet; the entropy coder has not been replaced with
a direct 256-symbol arithmetic model or a byte-context predictor. Comparing those
models would be a separate experiment. As before, a stream can use raw storage
when that is smaller, and biased or uniform inputs can select the direct
arithmetic-only or raw-document fallback.

## End-of-file and bounds

Finalization follows the native encoder's strategy: append padding until a symbol
reaches a newly created highest generation. Bit mode starts with `1`; byte mode
starts with `0x80`. Subsequent symbols are zero, so both append the bit suffix
`10*`. The builder verifies the complete root expansion against input plus padding.
The unchanged decoder verifies that suffix and removes it using the original bit
length in the frame. Whole-document fallbacks bypass padding.

This strategy can add substantial padding. An initial fixed limit of 65,536
padding symbols stopped the raw-bit repeated-phrase run. The final prototype
allows at most `max(65,536, 4 * inputBits)` padding bits and refuses inputs that
exceed that experimental budget; it also limits hierarchy depth. No claim of a
general finalization bound is made. The completed ten-fixture run needed at most
140,965 padding bits for raw-bit mode and 109,032 for raw-byte mode. Every candidate
size below includes the representation of any padding; no padding cost is hidden.

The byte API accepts complete bytes and rejects partial-byte input. The raw-bit
control supports arbitrary bit lengths. Both use the preceding decoder's existing
output and nesting limits. These remain in-memory research implementations, with
no checksum or production archival-format claim.

## Measurements

All ten inputs are byte-identical to the preceding experiment, checked by SHA-256.
They comprise one 64 KiB source-code sample and nine synthetic fixtures, including
repeated sentences and unique sentences sharing phrases. No natural-language
sentence parser is used. The same Node.js `v24.19.0` runtime and pinned SUL snapshot
are used. Previous sizes are reused only after fixture hashes match.

All numbers are **complete encoded bytes**, including framing, recipes, dictionaries,
arithmetic finalization, and selected raw or arithmetic-only fallbacks. The new
run measures 40 encodings: two starting widths times one-level/recursive mode on
ten inputs. All 40 decode to the exact original bits. The search records 3,972
recipe/body cost comparisons; these are internal candidates, not 3,972 separately
decoded complete files.

| Input | Original | Native bit, recursive | Matched raw bit, recursive | Raw byte, one level | Raw byte, recursive |
|---|---:|---:|---:|---:|---:|
| Source code | 65,536 | 44,254 | 43,862 | 38,448 | 35,024 |
| JSON records | 59,164 | 14,726 | 15,664 | 14,354 | 11,536 |
| Repeated phrase | 65,536 | 186 | 184 | 255 | 188 |
| Repeated random block | 131,072 | 4,431 | 4,426 | 4,768 | 4,441 |
| Edited versions | 131,072 | 6,023 | 6,153 | 8,375 | 5,789 |
| Recursive sequence | 65,536 | 187 | 185 | 407 | 209 |
| Biased bits | 65,536 | 5,168 | 5,168 | 5,168 | 5,168 |
| Uniform pseudorandom bytes | 65,536 | 65,550 | 65,550 | 65,550 | 65,550 |
| Repeated sentences | 67,872 | 511 | 652 | 1,283 | 430 |
| Unique sentences | 67,474 | 5,904 | 4,893 | 8,139 | 5,025 |

The byte recursive mode improves eight inputs and ties on two relative to its own
one-level control. It never selects a larger complete encoding because the same
literal-body candidate remains available. That outcome confirms that byte leaves
are compatible with the proposed recursive dictionary compression procedure.

Against the matched raw-bit recursive control, byte mode wins four, ties two, and
loses four. In particular, unique sentences take 5,025 bytes with bytes but only
4,893 with raw bits. Their improvement over native bit SUL's 5,904 bytes therefore
cannot be attributed to byte leaves alone. For source code, JSON, edited versions,
and repeated sentences, bytes improve against both bit constructions.

## A dictionary compressed through several levels

For repeated sentences, the byte representation retains generations
`8 -> 5 -> 4 -> 2`, skipping intervening generations. At each stage the next pass
processes the preceding dictionary in first-occurrence order. The final dictionary
has 1,400 bits (175 bytes), arithmetic-coded to 135 bytes including its tag and
length. The four reconstruction recipes cost 45 + 114 + 54 + 68 bytes. Together
with the 14-byte outer header, that gives the measured 430 bytes.

Stopping after one dictionary level costs 1,283 bytes on the same byte hierarchy;
recursion reduces that by 66.5%. The native-bit recursive result was 511 bytes.
The sizes of the small final dictionary alone would overstate the compression:
all reconstruction recipes are necessary and are included above.

## Comparison with established compressors

| Input | Raw byte, recursive | gzip 9 | Brotli 11 | Zstandard 19 |
|---|---:|---:|---:|---:|
| Source code | 35,024 | 19,231 | 15,869 | 17,963 |
| JSON records | 11,536 | 5,835 | 3,175 | 4,109 |
| Repeated phrase | 188 | 348 | 81 | 99 |
| Repeated random block | 4,441 | 5,127 | 4,131 | 4,121 |
| Edited versions | 5,789 | 5,255 | 4,325 | 4,270 |
| Recursive sequence | 209 | 435 | 103 | 153 |
| Biased bits | 5,168 | 7,040 | 6,634 | 6,858 |
| Uniform pseudorandom bytes | 65,550 | 65,576 | 65,540 | 65,546 |
| Repeated sentences | 430 | 565 | 156 | 189 |
| Unique sentences | 5,025 | 2,238 | 992 | 935 |

Bytes narrow the gap on ordinary source code and JSON, but high-quality Brotli
and Zstandard still produce substantially smaller outputs there and on both
sentence fixtures. Repeated phrases and blocks are strong cases for the SUL
approach, yet the best established codec still wins these measured examples.
The biased-bit result comes from the unchanged arithmetic-only fallback, so it
is not evidence that byte-level deduplication helps sparse bits.

The raw-byte builder used about 3.57 seconds of total tree-building time over the
ten fixtures versus 13.18 seconds for the matched raw-bit builder in this run.
It begins with one eighth as many input symbols and generally fewer generations.
These are one-shot instrumentation results with no warm-up, repeated timing trials,
memory measurements, or optimized implementation; they are not a throughput claim
or a comparison against the native SUL builder. Full timings and tree statistics
are preserved in the result data.

The likely benefit for byte-oriented text is that every node boundary remains
byte-aligned, while the bit hierarchy can choose boundaries within bytes. That is
an interpretation consistent with these fixtures, not an isolated causal proof.
Byte alignment also rules out sub-byte dictionary matches. The larger byte
alphabet does not itself guarantee either better compression or worse overhead;
its effect depends on boundaries, repeated structures, metadata, and the model.

## Implications and next experiments

Keep byte and bit starting alphabets as candidates while the format is experimental.
The complete-byte comparison supports byte mode for these source, JSON, and
sentence workloads, but the repeated phrase, random block, and recursive-sequence
results argue against declaring one alphabet best for every input. The current
frame could represent either hierarchy's reconstruction recipes without an extra
mode byte; choosing the smaller result would require running both encoders.

Useful next controls are a direct adaptive byte-symbol model, length metadata in
byte units, selective dictionary membership, a bounded end-of-file construction,
and representative real corpora. Multi-file deduplication and edit stability would
also need fresh measurement because the byte variant changes boundaries and IDs.
None of these prospective gains is counted in the results above.

## Reproduction and artifacts

Extract [byte-prototype.zip](byte-prototype.zip) outside the repository. With
Node.js 24 and no npm installation, run from its root:

```bash
node --test sul-compression-research/test.mjs sul-ordered-experiment/test.mjs sul-byte-experiment/test.mjs
node sul-byte-experiment/benchmark.mjs
node sul-byte-experiment/cli.mjs compress INPUT OUTPUT.sulo 8
node sul-byte-experiment/cli.mjs decompress OUTPUT.sulo RESTORED
```

Pass `1` instead of `8` to select the matched raw-bit control. The CLI verifies a
compressed file's decoding before writing it. The benchmark regenerates all 40
`.sulo` outputs; those regenerable binaries are omitted from the archive.

- [Source listing](byte-prototype.md) includes all four new files and the small
  supporting change that exports the ordered benchmark's fixtures and guards its
  measurement loop. The existing codec and arithmetic source are unchanged.
- [Measurements](byte-results.json) retain every final size, selected level,
  model mode, fixture hash, candidate count, and one-shot timing. The archive's
  `sul-byte-experiment/results/results.json` includes all 3,972 candidate costs.
- [CSV](byte-summary.csv) contains all ten inputs, both widths, both recursion
  modes, the native bit results, and the established-compressor sizes.
- [Manifest](manifest.json) records the archive and supporting-file SHA-256 hashes.

Five new test cases cover the empty document and every single byte, every bitstring
of length zero through eight for the matched control, full-alphabet and boundary
cases, the longest decreasing byte word, recursive dictionary gains, deterministic
output, and refusal of unsupported widths or incomplete bytes. All 15 cases across
the original and two follow-up suites passed. The ten-fixture benchmark additionally
covers the padding case that exceeded the initial limit. Every new final encoding
was round-trip checked and every reused input hash matched.

The archive includes all three experiment directories and the unchanged MIT-licensed
SUL dependency snapshot. Both previous archives and their measurements remain
unchanged so the comparisons can be independently reproduced. No production SUL
API or compression format is introduced by this research update.

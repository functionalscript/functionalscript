# Brotli's static dictionary as level zero

Using Brotli dictionary entries as the starting symbols improves several of the
byte-alphabet results. With all standard transforms available, source code shrinks
from 35,024 to 31,447 bytes (10.2%), JSON from 11,536 to 10,229 (11.3%), and the
repeated phrase from 188 to 139 (26.1%). On the preceding ten inputs the full
profile wins five, ties two, and loses three against byte leaves. Two new short
text/HTML examples also improve substantially.

This is a useful **optional shared alphabet**. It is not uniformly better:
repeated random blocks, edited binary versions, and the recursive-sequence fixture
become larger. Base entries alone also beat the full transform profile on the
unique-sentence fixture. Established Brotli remains smaller on both short examples
and on source, JSON, and sentence data.

The experiment extends [byte level zero](byte-alphabet.md) and keeps the
[first-occurrence recursive dictionaries](ordered-dictionaries.md). Known base
symbols can now expand through a dictionary already held by the decoder, so their
text does not have to appear in each compressed document.

## Dictionary and provenance

Brotli specifies a fixed dictionary of byte strings and transforms that can alter
case, omit bytes, and add prefixes or suffixes. The dictionary occupies 122,784
bytes, with base lengths from 4 through 24 and 121 transform choices. See
[RFC 7932 section 8](https://www.rfc-editor.org/rfc/rfc7932.html#section-8) and its
[static data](https://www.rfc-editor.org/rfc/rfc7932.html#appendix-A) and
[transform definitions](https://www.rfc-editor.org/rfc/rfc7932.html#appendix-B).

This experiment pins Google's reference implementation at
[`09e1ac6c7eea9d3b53f85bcdde6347358dbe1281`](https://github.com/google/brotli/tree/09e1ac6c7eea9d3b53f85bcdde6347358dbe1281),
including its MIT license. The checked-in
[dictionary layout](https://github.com/google/brotli/blob/09e1ac6c7eea9d3b53f85bcdde6347358dbe1281/c/common/dictionary.c)
contains 13,504 entries. The prototype uses the exact byte operations from the
[transform implementation](https://github.com/google/brotli/blob/09e1ac6c7eea9d3b53f85bcdde6347358dbe1281/c/common/transform.c),
including its specified casing behavior rather than JavaScript Unicode casing.

The dictionary SHA-256 is
`20e42eb1b511c21806d4d227d07e5dd06877d8ce7b3a817f378f313653f35c70`.
Its CRC-32 is `0x5136cb04`, matching RFC 7932. An included C helper extracts
metadata and emits an exhaustive oracle stream. All 13,504 × 121 = 1,633,984
word/transform combinations from the JavaScript implementation match that stream's
length and SHA-256. This count includes duplicate and empty expansions; it is not
a claim of that many distinct usable strings.

## Reversible token alphabet

Two profiles are tested:

| Profile | Literal-byte IDs | Dictionary IDs | Fixed token width |
|---|---|---|---:|
| Base entries | `0..255` | `256 + wordIndex` | 14 bits |
| Full transforms | `0..255` | `256 + transformIndex * 13504 + wordIndex` | 21 bits |

Base-word order follows the official length buckets and then the index within a
bucket. That ID identifies both the word and its original length. The full ID also
identifies the transform, including any affixes; no transform text or separate
length table is transmitted per document. Literal-byte tokens cover every unmatched
byte, including arbitrary binary content.

The tokenizer scans exact bytes. It uses dynamic programming to minimize the
number of fixed-width tokens covering the document, allowing literal bytes at
any position. Equal-cost choices prefer the longer current match, then the lowest
ID for an identical expansion. Empty transformed forms are excluded; one-byte
aliases use their literal IDs. The full lookup contains 1,408,878 distinct
multi-byte expansions and has maximum match length 37 bytes.

This is optimal only for the stated fixed-width token-count objective. It is not
a Brotli encoder, not a natural-language parser, and not an optimizer for the
final adaptive arithmetic or SUL encoding. A different tokenization can produce
better references, probability contexts, or repeated higher-level phrases.
Global parsing also does not establish locality of retokenization after an edit.

## SUL and recursive dictionaries

Each token ID becomes one fixed-width level-zero symbol in the raw/hash SUL
builder from the byte experiment. That builder was generalized to create symbols
lazily and accept these widths; its one-bit/eight-bit wrapper remains available.
The benchmark recomputes all previous byte controls and verifies identical sizes.
The original archives are preserved unchanged.

Word grouping and higher-level Patricia/hash construction are the same as in the
raw byte variant. At each chosen frontier, local dictionaries assign compact IDs
in first-occurrence order. The search tries compressing their retained contents
together at lower levels, counts complete reconstruction costs, and skips levels
that do not pay for themselves. This continues down through token level zero.

The codec stores lengths in bits of the **token representation**, not bits of the
original document. Its final literal dictionary contains token IDs. Only after
reconstructing the entire token stream does the decoder expand IDs through the
shared Brotli dictionary to recover the original bytes. The fixed-width coding
keeps token boundaries unambiguous throughout that process.

Consequently, root IDs describe this token representation. They differ from native
SUL document IDs and depend on the dictionary profile, ID convention, and parsing
policy. A content-addressed system must identify those choices explicitly; this
research does not silently change the existing SUL identity or storage format.

## Adaptive coding and controls

The ordered codec and 32-bit adaptive binary arithmetic coder are imported
unchanged. Counts start at `[1, 1]`, update after each bit, and rescale at total
16,384. Recipe models and resets are unchanged; final literal contexts use the
previous eight transmitted **token-representation bits**. No probability tables
are sent. This does not use Brotli's LZ77/Huffman encoding, and it does not add a
new adaptive model over whole words or a pretrained language model.

Every profile runs three controls:

- **Direct:** encode the token stream with raw or adaptive arithmetic coding,
  without a SUL dictionary recipe.
- **One level:** allow a dictionary at one chosen SUL generation; encode its body
  directly as raw or arithmetic-coded token bits.
- **Recursive:** also try dictionary compression at successively lower levels.

Each mode can fall back to raw original bytes or arithmetic-only original bits.
The byte-SUL control is measured separately, so a losing dictionary profile does
not quietly select the earlier byte hierarchy. Arithmetic coding remains optional
where its own output is larger than raw storage.

## Framing, resource costs, and padding

The new 14-byte outer frame has magic `SULD`, version `1`, a mode byte, original
byte length as a big-endian uint32, and payload byte length as a big-endian uint32.
Modes `0` and `1` contain raw or arithmetic-coded original bytes. Modes `2` and `3`
contain the preceding `SULO` token codec, using base or full dictionary profiles.
The version/profile fixes the dictionary and token-ID mapping.

Dictionary modes include the inner 14-byte `SULO` header as well: **28 bytes total
framing**, before recipes or token payload. The comparisons include both headers,
all token/transform references, unmatched bytes, recipes, and arithmetic finalization.
They do not compare a bare dictionary body with another codec's complete file.

The 122,784-byte static dictionary and its transform tables are decoder resources,
shared across documents, as with normal Brotli's built-in dictionary. They are
included in the runnable archive and are not sent in every measured file. If the
recipient does not already have them, distribution has a one-time cost. Adding
at least 122,784 bytes plus tables to each document would erase the gains in these
small examples. The results assume this exact, versioned shared resource.

SUL padding is applied to the token bitstream and removed before token expansion.
The builder retains its experimental `max(65536, 4 * tokenBits)` padding budget and
depth limit. The wrapper permits that bounded intermediate expansion, then checks
that the unpadded token count and final byte length fit the declared document.
An initial wrapper bound was too tight for repeated random blocks; a regression
test preserves that case. The underlying ordered decoder is unchanged.

The format has basic size/nesting checks and no integrity checksum. This remains
an in-memory research prototype rather than a supported archival codec. The token
parser and lookup construction have not been optimized for production memory or
throughput. One-shot timing measurements are retained without a performance claim.

## Complete output sizes

The original ten fixture hashes match the preceding experiments. The short text
and HTML inputs are two additional deliberately dictionary-friendly examples,
not a representative short-document corpus. Their generators, byte-SUL controls,
and gzip/Brotli/Zstandard round trips are included in the benchmark. All sizes
below are complete bytes, with the same raw/arithmetic fallback policy.

| Input | Original | Byte leaves | Base entries | Full transforms | Brotli 11 | Zstandard 19 |
|---|---:|---:|---:|---:|---:|---:|
| Source code | 65,536 | 35,024 | 33,204 | 31,447 | 15,869 | 17,963 |
| JSON records | 59,164 | 11,536 | 10,318 | 10,229 | 3,175 | 4,109 |
| Repeated phrase | 65,536 | 188 | 182 | 139 | 81 | 99 |
| Repeated random block | 131,072 | 4,441 | 4,865 | 5,196 | 4,131 | 4,121 |
| Edited versions | 131,072 | 5,789 | 6,364 | 6,965 | 4,325 | 4,270 |
| Recursive sequence | 65,536 | 209 | 233 | 259 | 103 | 153 |
| Biased bits | 65,536 | 5,168 | 5,168 | 5,168 | 6,634 | 6,858 |
| Uniform pseudorandom bytes | 65,536 | 65,550 | 65,550 | 65,550 | 65,540 | 65,546 |
| Repeated sentences | 67,872 | 430 | 456 | 396 | 156 | 189 |
| Unique sentences | 67,474 | 5,025 | 3,889 | 4,760 | 992 | 935 |
| Short text | 150 | 136 | 89 | 70 | 68 | 110 |
| Short HTML | 136 | 127 | 90 | 78 | 74 | 118 |

Full-transform controls isolate the effect of recursive dictionary compression:

| Input | Full: direct | Full: one level | Full: recursive |
|---|---:|---:|---:|
| Source code | 46,738 | 34,615 | 31,447 |
| JSON records | 31,432 | 14,810 | 10,229 |
| Repeated phrase | 13,709 | 165 | 139 |
| Repeated random block | 130,601 | 7,460 | 5,196 |
| Edited versions | 130,602 | 12,140 | 6,965 |
| Recursive sequence | 7,568 | 583 | 259 |
| Biased bits | 5,168 | 5,168 | 5,168 |
| Uniform pseudorandom bytes | 65,550 | 65,550 | 65,550 |
| Repeated sentences | 12,914 | 989 | 396 |
| Unique sentences | 17,257 | 6,687 | 4,760 |
| Short text | 70 | 70 | 70 |
| Short HTML | 78 | 78 | 78 |

The full profile's recursion improves eight inputs over its one-level control and
ties on four. On source and JSON, direct token coding is worse than ordinary
arithmetic-only coding: dictionary candidates cost 56,851 and 38,538 bytes,
respectively, so the direct control selects 46,738 and 31,432-byte document
fallbacks. The final gains on those fixtures require the higher-level dictionary
representation; token coverage alone does not establish compression.

With 99.3% byte coverage, the 150-byte short text becomes 16 tokens: 336 raw token
bits (42 bytes) plus 28 framing bytes = 70 bytes. Short HTML becomes 19 tokens:
399 bits rounded to 50 bytes plus framing = 78 bytes. Both choose raw token coding
and retain no SUL dictionary levels. Their gains demonstrate the value of a shared
starting dictionary, not extra arithmetic or recursive SUL compression.

The full profile's matched coverage is 84.8% for source, 85.7% for JSON, and about
6% for the random-block and uniform inputs. Coverage can also be high for binary
patterns: the dictionary includes an eight-zero-byte base entry. The biased-bit
fixture still selects the unchanged arithmetic-only fallback, so its size is not
evidence of a new tree-compression gain.

Full transforms improve source, JSON, repeated phrases, and repeated sentences
relative to base entries, but make the other four non-fallback original inputs
larger. Unique sentences are a clear counterexample: base entries give 3,889 bytes,
full transforms 4,760, and byte leaves 5,025. A bigger token vocabulary changes
both parsing and ID width, and those costs can outweigh longer matches.

## Example: recursively compressing the retained dictionary

For repeated sentences, the full profile selects generations `6 -> 3 -> 1 -> 0`.
Its final ordered dictionary consists of 34 token IDs, or 714 bits. These are
arithmetic-coded into an 81-byte terminal body, including its tag and length.
The four recipes occupy 37 + 95 + 109 + 46 bytes. Including 28 framing bytes gives
396 bytes in total, versus 989 with one dictionary level and 430 with byte leaves.
The shared static dictionary expands those 34 IDs; their text is not retransmitted.

## Interpretation and further work

This tests the user's proposal as a predefined level-zero alphabet, with a real
decoder and explicit reconstruction costs. The results support keeping base-word,
full-transform, and byte profiles as alternatives. They do not establish that
Brotli's dictionary is the best vocabulary for FunctionalScript, nor that this
combination beats a full Brotli compressor. Brotli 11 remains smaller on the
measured source, JSON, sentence, and short-document examples.

The next useful variables are parsing with estimated entropy/reference costs,
separate inexpensive literal-byte escapes, adaptive models over whole token IDs,
and field-aware coding of word/transform IDs. Tests on real source corpora and
many short documents should precede choosing a default. Multi-document savings,
dictionary distribution/amortization, and edit stability require their own
measurements; none is inferred from this single-document size table.

## Reproduction and validation

Extract [brotli-prototype.zip](brotli-prototype.zip) outside the repository. With
Node.js 24 and no npm installation, run from the extracted root:

```bash
node --test sul-compression-research/test.mjs sul-ordered-experiment/test.mjs sul-byte-experiment/test.mjs sul-brotli-experiment/test.mjs
node sul-brotli-experiment/benchmark.mjs
node sul-brotli-experiment/cli.mjs compress INPUT OUTPUT.suld full
node sul-brotli-experiment/cli.mjs decompress OUTPUT.suld RESTORED
```

Use `base` instead of `full` for base entries alone. No C compiler is needed for
normal tests, compression, or benchmarking. To independently regenerate the oracle,
run these commands from `sul-brotli-experiment` with a C compiler:

```bash
cc -O2 -I vendor/brotli/c/include -I vendor/brotli/c/common oracle.c vendor/brotli/c/common/dictionary.c vendor/brotli/c/common/transform.c -o oracle
./oracle > metadata.json
./oracle all > oracle.bin
```

The metadata must match `vendor/brotli/metadata.json`; the oracle stream is
19,295,456 bytes with SHA-256
`3203c526882031773159512c3dba03abc46ff2dd65cef4875b00b9d22c708b9c`.
The tests independently produce that digest from the JavaScript transform code.

All 20 test cases across the four experiment suites passed. The new suite covers
exhaustive transform equivalence, byte-exact tokenization, binary/UTF-8 examples,
all three codec modes, empty documents, invalid references/frames, and intermediate
padding bounds. All 72 final outputs, all 72 dictionary candidates (including
those rejected in favor of fallback), and all 12 recomputed byte controls decoded
exactly. The ten reused fixture hashes and byte-control sizes matched.

- [Source listing](brotli-prototype.md): all six new source files plus the shared
  fixed-width builder change; the vendored MIT reference source is in the archive.
- [Measurements](brotli-results.json): all final sizes, dictionary-candidate sizes,
  model modes, candidate levels, token coverage, fixture hashes, and timings.
  Candidate layers describe the dictionary candidate even if a document fallback
  wins; `selected` identifies the actual representation.
- [CSV](brotli-summary.csv): all twelve inputs, both dictionary profiles, all three
  controls, and established-compressor sizes.
- [Manifest](manifest.json): archive and supporting-file SHA-256 checksums.

The archive contains all four experiment directories, both pinned dependency
snapshots and licenses, and all 2,866 new internal candidate cost comparisons.
Encoded outputs are regenerated by the benchmarks. The three preceding archives
and measurements remain unchanged. No production FunctionalScript API is added.

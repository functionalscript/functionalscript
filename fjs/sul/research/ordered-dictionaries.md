# Ordered dictionaries, compressed at lower levels

This follow-up tests the proposed procedure directly: deduplicate large repeated
structures, retain one copy of each dictionary entry in original first-occurrence
order, then try to compress that dictionary at lower levels. If a level does not
pay for its reconstruction information, skip it and keep descending.

The [earlier experiment](compression.md) used a depth-first grammar stream with
nested definitions. That permits recursive sharing, but does not evaluate this
ordered, level-by-level dictionary representation. The two experiments are
preserved separately so their results and implementations remain traceable.

## Algorithm

At a candidate level, the current frontier is a left-to-right sequence of nodes.
Scan it once, assign consecutive IDs at first occurrence, and retain unique nodes
in that same order. For example:

```text
sequence:   A B A C B
references: 0 1 0 2 1
dictionary: A B C
```

The dictionary includes every distinct frontier node, including those occurring
only once. Concatenate its entries' contents in that order. Save their bit
lengths so decoding can split the concatenation back into entries. At a lower
level, expand the retained nodes and process the resulting sequence together:
shared children can be found across different parent definitions.

For each state, the encoder compares:

1. A literal representation, choosing raw or adaptive arithmetic coding.
2. Every lower-level dictionary candidate with a recursively compressed body.
3. Raw and adaptive arithmetic coding of each candidate's reconstruction recipe.

A recipe contains the occurrence count, dictionary size, entry bit lengths, and
reference sequence. A first occurrence introduces the next ID implicitly; a later
occurrence refers to an already introduced ID. Definitions themselves are stored
in the one ordered body following the recipe.

The decision uses **recipe bytes plus the completely encoded lower dictionary**,
not the raw size of that dictionary. Skipping a level requires no marker: the
lower representation reconstructs the same bit sequence. Memoization reuses the
answer for a dictionary sequence and a level ceiling. The encoder evaluates
alternative retained levels instead of accepting the first repetition or applying
a minimum rule-length threshold.

This searches level choices for a fixed hierarchy, first-occurrence ordering,
and the specified coding models. It does not establish a globally optimal
dictionary permutation, select arbitrary substrings, or selectively dictionary-code
only some nodes within a retained frontier. It also does not build a fresh SUL
tree over the serialized recipe bytes: lower passes follow the retained entries'
existing descendants.

## Two interpretations of level

- **Word generations:** use the actual SUL literal and hash-level word boundaries.
  The builder invokes the pinned literal/hash encoders and checks its reconstructed
  root ID and padded bit sequence against the original SUL encoder. These are
  genuine SUL word generations, not distance from the root.
- **Expanded Patricia heights:** use the earlier prototype's expanded binary DAG,
  assigning each leaf height zero and each parent one plus its maximum child
  height. A frontier includes nodes at or below the current height; shorter nodes
  carry through while taller ones expand. This also tests repetitions inside
  words that the first hierarchy cannot select separately.

The hierarchy affects which phrases become dictionary entries. SUL does not parse
natural-language sentences or words; the sentence fixtures below test whether
its synthetic decomposition captures useful repetition in that kind of data.

Both builders preserve SUL's end padding. Dictionary-body bit counts can therefore
include padding and may exceed the original document length at upper levels.
The frame stores the original bit length; decoding verifies the padding and
removes it. Direct whole-document fallbacks encode the original unpadded bits.

## Adaptive arithmetic coding

All arithmetic streams use the original 32-bit binary arithmetic coder. Counts
start at `[1, 1]`, update after every bit, and rescale at a total of 16,384. The
decoder repeats those updates, so no probability table is transmitted.

Each recipe starts a fresh model. Separate contexts encode the first-use marker,
the gamma-binarized counts and lengths, and a binary decision tree for reference
IDs. The reference alphabet grows as IDs are introduced. New IDs are implicit;
old IDs use `ceil(log2(seen))` bits before arithmetic modeling. Codes outside the
current alphabet are rejected by the decoder.

The final dictionary literals have their own model, conditioned on the previous
eight transmitted literal bits. That context runs across dictionary entry
boundaries. It does not run across separate recipe streams or reconstruct a
natural-language context when a reference is transmitted. These reference models
and stream boundaries differ from the earlier depth-first codec, so comparisons
between the two complete codecs do not isolate traversal order alone.

Independent streams make the candidate costs additive and permit exact byte-size
comparisons for the explored level choices. They also give up possible predictive
information across levels. Every stream can instead use raw bits if arithmetic
coding makes it larger. The complete document has the same 14-byte outer-frame
overhead as the first experiment, with raw-document and arithmetic-only fallbacks.

## Controls and measurements

**One dictionary level** uses the same ordering, recipes, reference models, and
fallbacks, but compresses the dictionary body only as raw or arithmetic-coded
literals. It may choose any starting level; it cannot deduplicate that dictionary
at another level. **Recursive dictionaries** allow that additional work. Comparing
these two modes within one hierarchy isolates the proposed recursive dictionary
compression mechanism.

The original eight fixtures retain exactly the same input hashes. Two additional
fixtures use 768 sentences: one draws from 16 distinct sentences in deterministic
mixed order, and one makes every full sentence unique with a changing sensor
number. Both contain common phrases. Their generator is included in the archive;
these are controlled synthetic examples, not a natural-language corpus.

All sizes are complete output bytes. The previous column uses the earlier codec's
best available grammar/raw/arithmetic-only choice, so fallback gains are not
misattributed to the new structure. The original baseline measurements are reused
only after input hashes match; the two added fixtures have freshly measured and
round-trip-checked baselines.

Using actual SUL word generations:

| Input | Original | Previous codec | One dictionary level | Recursive dictionaries |
|---|---:|---:|---:|---:|
| Source code | 65,536 | 43,540 | 44,679 | 44,254 |
| JSON records | 59,164 | 15,498 | 16,636 | 14,726 |
| Repeated phrase | 65,536 | 187 | 319 | 186 |
| Repeated random block | 131,072 | 4,246 | 5,126 | 4,431 |
| Edited versions | 131,072 | 5,583 | 9,231 | 6,023 |
| Recursive sequence | 65,536 | 158 | 366 | 187 |
| Biased bits | 65,536 | 5,168 | 5,168 | 5,168 |
| Uniform pseudorandom bytes | 65,536 | 65,550 | 65,550 | 65,550 |
| Repeated sentences | 67,872 | 451 | 1,344 | 511 |
| Unique sentences | 67,474 | 7,718 | 7,267 | 5,904 |

The finer Patricia-height experiment gave:

| Input | Patricia: one dictionary level | Patricia: recursive dictionaries |
|---|---:|---:|
| Source code | 45,307 | 45,307 |
| JSON records | 17,178 | 15,962 |
| Repeated phrase | 339 | 226 |
| Repeated random block | 5,112 | 4,598 |
| Edited versions | 9,442 | 6,356 |
| Recursive sequence | 452 | 227 |
| Biased bits | 5,168 | 5,168 |
| Uniform pseudorandom bytes | 65,550 | 65,550 |
| Repeated sentences | 1,362 | 599 |
| Unique sentences | 8,421 | 7,309 |

## Interpretation

Within the word-generation hierarchy, recursively compressing the dictionary
improved eight of ten inputs and tied on the other two. On repeated sentences,
1,344 bytes became 511 bytes, a 62.0% reduction relative to the one-level control.
On unique sentences, 7,267 became 5,904 bytes: smaller repeated structures still
help when no whole sentence repeats. The constructed hierarchy test separately
verifies that an entirely unique upper frontier can be skipped to deduplicate
its children.

The selected repeated-sentence representation retains word generations
`10 -> 8 -> 6 -> 4`. At each retained generation, the next stage processes the
ordered dictionary left by the preceding one. Intervening generations are skipped.
Its final literal dictionary contains 1,675 bits, encoded in 157 bytes including
its literal tag and length. Recipes contribute 47 + 72 + 115 + 106 bytes, and
14 outer-header bytes complete the 511-byte output. Thus the small final dictionary
alone is not the total compressed size.

Against the earlier complete codec, the best new hierarchy improves JSON from
15,498 to 14,726 bytes (5.0%) and unique sentences from 7,718 to 5,904 bytes
(23.5%). The repeated-phrase improvement is only one byte. The earlier codec is
smaller on source code, repeated random blocks, edited versions, the recursive
sequence, and repeated sentences. Both codecs choose the same arithmetic-only
fallback for biased bits and the same raw fallback for uniform pseudorandom data.

The Patricia-height variant did not improve any of these final sizes over word
generations. This does not eliminate the value of Patricia substructures: the
old depth-first codec can select individual rules across different sizes, whereas
the new codec selects a dictionary for an entire frontier. That difference, plus
reference models, entry-length costs, and model resets, prevents attributing the
whole old/new difference solely to dictionary ordering.

The measurements support the proposed mechanism: recursively compressing an
ordered dictionary can produce a much smaller encoding than stopping at one
dictionary level. They do not show that this representation is generally the
smallest grammar, or that it surpasses high-quality Brotli and Zstandard. Both
remain substantially smaller on the sentence fixtures and ordinary source/JSON.

The most useful next design questions are selective dictionary membership within
a level, more compact entry-boundary metadata, and stronger literal/reference
contexts. First-occurrence order was held fixed throughout this experiment; other
permutations would be separate controls, with any reconstruction cost included.


The experiment remains small: nine synthetic fixtures and one source-code sample.
The original gzip/Brotli/Zstandard comparisons are preserved in the result JSON
and CSV, including the two additional inputs. A winning hierarchy or level schedule
on these examples is not a general compression ranking or evidence of optimality.

## Reproduction and files

Extract [ordered-prototype.zip](ordered-prototype.zip) outside the repository.
From the extracted root, with Node.js 24 and no npm installation:

```bash
node --test sul-compression-research/test.mjs sul-ordered-experiment/test.mjs
node sul-ordered-experiment/benchmark.mjs
node sul-ordered-experiment/cli.mjs compress INPUT OUTPUT.sulo
node sul-ordered-experiment/cli.mjs decompress OUTPUT.sulo RESTORED
```

The CLI tries recursive compression with both hierarchies and chooses the smaller
complete output, including the document fallbacks. It verifies decoding before
writing a compressed file. This is an intentionally expensive in-memory research
search, not an optimized streaming compressor.

- [Source listing](ordered-prototype.md): the new codec, builders, tests, benchmark,
  CLI, and the supporting baseline benchmark change.
- [Measurements](ordered-results.json): all final sizes, retained levels,
  hierarchies, model modes, input hashes, candidate counts, and one-shot timings.
  The archive's `sul-ordered-experiment/results/results.json` additionally retains
  all 9,976 candidate recipe/body size comparisons.
- [CSV comparison](ordered-summary.csv): all ten fixtures and baselines.
- [Manifest](manifest.json): SHA-256 checksums and the pinned SUL/runtime versions.

The original six-file prototype is reused. Its benchmark now exports the fixture
table and runs measurements only when invoked directly, allowing the new benchmark
to share its exact inputs. The original [prototype.zip](prototype.zip) is unchanged.
The follow-up archive contains both directories and the unchanged vendored SUL
dependency closure at `d16a9ebf39b30a42e1b795bc329774d867196841`, with its license.
All encoded outputs are regenerated by the benchmarks rather than committed.

The new tests check every bitstring of length zero through eight, first-occurrence
dictionary order, a constructed hierarchy where two dictionary stages are
strictly better than one, skipping a unique upper level to reuse lower entries,
unequal-height Patricia frontiers, non-byte-aligned inputs, and basic frame limits.
Every measured final output is decoded and compared with the exact original bits.
The raw-recipe control also exercises nested decoding without arithmetic-coded
recipes. All ten test cases across the original and follow-up suites passed;
all forty new final encodings reconstructed their inputs exactly.

## Experimental format

The 14-byte outer header contains `SULO`, version `1`, a mode byte, the original
bit length as a big-endian uint32, and payload byte length as a big-endian uint32.
Modes `0` and `1` contain a layered representation without/with SUL padding;
mode `2` is raw original document bits and mode `3` is arithmetic-coded original
bits.

Within a layered representation, tag `0` is raw literal bits and tag `1` is
arithmetic-coded literal bits, followed by a base-128 varint bit length and the
remaining payload. Tag `2` is a raw recipe and tag `3` an arithmetic-coded recipe,
followed by a varint recipe byte length, the recipe, and its nested dictionary-body
representation. Recipe counts, entry lengths, and ID coding are defined in the
source listing. No SUL ID hashes, external dictionaries, or probability tables are
needed to decode. Entry lengths and reference order preserve the document.

As with the first prototype, there is no checksum or embedded root digest. The
decoder has basic output and nesting limits, but is not a hardened archival
decoder for arbitrary untrusted input. Any production format and FunctionalScript
implementation remain separate design work.

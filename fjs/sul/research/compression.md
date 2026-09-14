# SUL compression research and prototype

For the subsequent first-occurrence dictionary experiment, see
[ordered dictionaries at lower levels](ordered-dictionaries.md). The measurements
below remain the original depth-first grammar baseline.

**Finding:** A SUL-derived grammar can compress a document substantially when it contains repeated subtrees. Compact local references eliminate the need to transmit a cryptographic hash for every node. Arithmetic coding can then reduce the grammar stream further. This prototype demonstrates the mechanism, but does not establish superiority over modern compressors: high-quality Brotli and Zstandard generally produced smaller outputs on the tested examples.

This research uses FunctionalScript SUL at commit `d16a9ebf39b30a42e1b795bc329774d867196841`. The comparison is a mechanism experiment on eight small inputs, not a standard-corpus compression ranking.

## 1. The proposed construction

1. Build the SUL representation of the exact input bits and capture its merge operations.
2. Discover candidate repeated subtrees. Hashes are useful here as identities; short inline values can be compared exactly.
3. Select useful dictionary entries, accounting for the cost of definitions and references.
4. Traverse from the root in depth-first, left-before-right order.
5. On the first occurrence of a selected subtree, emit its definition and assign a local integer ID. On subsequent occurrences, emit a reference and stop descending into that occurrence.
6. Coalesce regions with no useful references into literal runs instead of transmitting every binary node.
7. Arithmetic-code the resulting syntax, integer fields, and literal bits using models shared with the decoder.

The decoder can reconstruct the document using the transmitted grammar and its local dictionary. It does not need any external CAS, original input, frequency table, or preinstalled content dictionary.

Conceptual grammar:

```text
node = CONCAT(node, node)
     | LITERAL(bitLength, bits)
     | DEFINE(node)
     | REFERENCE(localId)
```

For example, a root with two identical children needs one child definition plus a reference to that definition. Further sharing can occur inside the definition itself.

### Local IDs are essential

A 256-bit cryptographic identifier usually has little directly exploitable statistical redundancy. Repeated identifiers can be replaced with small dictionary numbers. Better still, definitions contain child references and literal values, so the compressed stream need not contain the hashes at all.

This is a physical encoding choice. After decoding the exact document, its original SUL root can be recomputed with the same SUL version. The prototype does not directly serialize every native SUL node type, so rebuilding the native root currently requires re-encoding the decoded bits. The archive itself has no embedded root digest or integrity checksum; adding one would add its bytes to the size measurements.

## 2. Why counting duplicates is not enough

Let a candidate subtree have `r` effective uses. Let `L` be the encoded cost of its body, `R` the cost of a reference, and `D` the additional definition overhead. A simplified local comparison is:

```text
inline cost     = r * L
dictionary cost = L + D + (r - 1) * R
```

Defining the subtree helps when `(r - 1) * (L - R) > D`. In a real arithmetic coder those costs depend on the contexts and on other choices, so this is a heuristic rather than a global optimality proof.

The counts must be taken after accounting for repeated ancestors. If subtree A is referenced 100 times but contains subtree B only once, encoding A once leaves only one transmitted use of B unless B occurs elsewhere. Counting B 100 times would overstate the saving.

The prototype begins with candidate occurrence counts, selects a minimum rule length, then traverses with repeated selected ancestors pruned. It removes dictionary rules with fewer than two effective uses. It tries minimum lengths of 16, 32, 64, 128, and 256 bits and keeps the smallest actual output. It does not implement a globally optimal grammar-selection algorithm.

## 3. Two SUL representations tested

### Native representation

Hash nodes are expanded into their captured left and right child identifiers. Inline raw values and level-3 literals are treated as literal bit runs. This is the simplest way to use the existing SUL implementation.

### Expanded representation

Captured raw merges are also exposed. Literal levels are decoded to the previous level and their decreasing prefixes are organized with the same Patricia construction used by hash levels, followed by the terminating symbol. This exposes patterns inside the small values that native SUL normally stores inline.

Short identical bitstrings of up to 253 bits are interned by exact contents. Longer nodes are interned by their child pairs. Where an inline value has multiple equivalent derivations, the first encountered derivation is retained. This is an experimental grammar derived from SUL; it is not a new standardized SUL wire format or a claim that all compression choices are canonical.

Both forms reconstruct the exact input. Expanding more structure supplies more candidates, but the selection pass must decide which ones are worth retaining.

## 4. Arithmetic model

`arithmetic.mjs` implements a binary arithmetic coder with a 32-bit interval. Each context starts with counts `[1, 1]`; counts are halved with rounding up when their sum reaches 16,384. Encoder and decoder update the same contexts, so no frequency table is transmitted.

Separate contexts encode:

- two-bit node tags;
- gamma-coded literal lengths;
- gamma-coded reference distances, measured backward in dictionary-definition order;
- literal bits, conditioned on the previous eight **transmitted literal bits**.

The reference model is a model of binarized dictionary distances, not a direct arithmetic alphabet containing every subtree ID. A direct adaptive reference-frequency model is one possible improvement.

Literal context continues across literal runs. It does not recreate the full decompressed-output context when a reference is transmitted. This simple choice loses useful byte alignment and longer text context, and is a likely contributor to weak results on source code and JSON.

The approximate ideal arithmetic cost of an event is `-log2(P(event | context))`. This does not make rare definitions or random payloads free; it only exploits the probability model's predictive information.

## 5. Measurements

Environment: Node.js `v24.19.0`, using the vendored FunctionalScript implementation and Node's built-in compression implementations. All numbers below are complete output bytes. SUL-based and arithmetic-only outputs include a 14-byte header. Baselines use their normal output framing. Checksums and dictionaries differ by format; this is a compressed-size experiment, not a comparison of identical storage services.

“SUL + arithmetic” selects the smaller native/expanded candidate across five rule thresholds. Brotli and Zstandard include high-quality settings to avoid comparing a tuned SUL result only with their faster settings.

| Input | Original | Arithmetic only | SUL + arithmetic | gzip 9 | Brotli 11 | Zstandard 19 |
|---|---:|---:|---:|---:|---:|---:|
| Source code | 65,536 | 46,738 | 43,540 | 19,231 | 15,869 | 17,963 |
| JSON records | 59,164 | 31,432 | 15,498 | 5,835 | 3,175 | 4,109 |
| Repeated phrase | 65,536 | 33,626 | 187 | 348 | 81 | 99 |
| Repeated random block | 131,072 | 130,601 | 4,309 | 5,127 | 4,131 | 4,121 |
| Edited versions | 131,072 | 130,602 | 5,583 | 5,255 | 4,325 | 4,270 |
| Recursive sequence | 65,536 | 7,568 | 158 | 435 | 103 | 153 |
| Biased bits | 65,536 | 5,168 | 6,073 | 7,040 | 6,634 | 6,858 |
| Uniform pseudorandom bytes | 65,536 | 65,693 | 65,739 | 65,576 | 65,540 | 65,546 |

Inputs are fully described and regenerated in `benchmark.mjs`:

- **Source code:** first 64 KiB of the sorted concatenation of the 30 vendored FunctionalScript `.mjs` modules, including proofs. This is the one non-synthetic input.
- **JSON:** 640 generated measurement records with changing numeric fields.
- **Phrase:** repetition of a 108-byte sentence, truncated to 64 KiB.
- **Repeated random block:** one generated 4 KiB block, repeated 32 times.
- **Edited versions:** 32 versions of that block, each with one independently placed byte substitution, concatenated into one input. No pre-shared dictionary or external base is supplied.
- **Recursive sequence:** 16 rounds of the Thue-Morse construction, stored as ASCII `0` and `1`.
- **Biased bits:** generated sparse bytes with approximately 1% of bits set.
- **Uniform bytes:** fixed-seed xorshift32 output, serving as an incompressibility control.

This is seven synthetic examples and one source-code sample, with no statistical sampling claim. The generator, seeds, input hashes, all 160 SUL candidates, parameters, and one-shot timings are included in `results/results.json`.

### Isolating arithmetic coding's contribution

For the **same expanded grammar and rule threshold**, these were the raw-binary versus arithmetic-coded sizes:

| Input | Raw grammar | Arithmetic-coded grammar |
|---|---:|---:|
| Source code | 56,742 | 43,540 |
| JSON records | 24,207 | 15,498 |
| Repeated phrase | 236 | 187 |
| Repeated random block | 4,246 | 4,309 |
| Edited versions | 5,866 | 5,583 |
| Recursive sequence | 237 | 158 |

Arithmetic coding helps several grammar streams, but slightly expands the repeated-random-block case because its remaining literal payload is largely unpredictable. It should be optional, ideally per block or stream.

The biased-bit example demonstrates a different point: arithmetic coding of the input alone beats the SUL grammar. That gain belongs to statistical modeling, not subtree reuse.

### How much does expansion help?

The best native SUL arithmetic outputs were 46,028 bytes for source code and 22,941 bytes for JSON. Exposing the lower-level structure reduced these to 43,540 and 15,498 bytes respectively. The effect was smaller for long exact repetitions, where the native tree already exposes most useful sharing.

### Speed

In this implementation, capturing the SUL graph took roughly 1.4–3.2 seconds per input. The selected expanded grammar's entropy-encoding phase took less than a millisecond to tens of milliseconds. Thus the existing per-bit SUL implementation dominates runtime for these small inputs. Timings are one-shot observations, include no repeated-run confidence interval, and should not be treated as algorithmic lower bounds or a fair optimized throughput ranking.

## 6. Interpretation

The experiment supports three conclusions:

1. **The idea works as lossless compression.** A stored SUL-derived grammar with local references can be far smaller than either the raw document or a naïve table of 256-bit child identifiers.
2. **Arithmetic coding is useful but secondary to representation and modeling.** Good dictionary choices create a compressible event stream; a suitable probability model encodes it efficiently. Arithmetic coding cannot compensate automatically for poor phrase choices.
3. **The present codec is not competitive on ordinary source and JSON.** The tested general-purpose compressors exploit repetitions and contexts that this fixed SUL-derived grammar does not represent as useful shared nodes. Their high-quality settings also match or beat the prototype on the recursive and repeated-block examples.

The most plausible opportunity is a compact physical representation for content-addressed histories, reusable dictionaries, and structured repetition. The advantage of already having a SUL DAG may matter in a system where the structure serves synchronization and identity as well as compression. It remains an engineering hypothesis until measured in that complete system.

## 7. Closely related work

- **SEQUITUR** constructs a grammar by replacing repeated phrases and removing rules used only once. Its compression work shows why a small grammar does not automatically mean a small bitstream, and examines arithmetic coding and implicit first-use rule transmission. This closely matches the proposed root-to-leaf serialization idea. [Nevill-Manning and Witten, Compression and explanation using hierarchical grammars](https://ml.cms.waikato.ac.nz/publications/1997/NM-IHW-Compress97.pdf).
- **Re-Pair** chooses repeated adjacent pairs to build a hierarchical dictionary. The original paper considers encoding dictionary generations as backward-referencing pairs, including arithmetic modeling and interpolative alternatives. This suggests a second SUL experiment: encode unique nodes by level/generation instead of first-use order. [Larsson and Moffat, Offline Dictionary-Based Compression](https://avadeaux.net/larsson.dogma.net/dcc99.pdf).
- **Grammar-based tree coding** formally studies tree straight-line programs and DAG representations. It supplies a theoretical framework for a SUL-derived tree codec, but its results cannot automatically be transferred into a universal compression guarantee for SUL. [Universal Tree Source Coding Using Grammar-Based Compression](https://arxiv.org/html/1701.08785v1).

SUL chooses a reproducible decomposition from local symbol relationships. Re-Pair chooses phrases based on repetition statistics. This difference matters: the most stable content-defined representation need not be the smallest grammar for one particular file. Physical compression can prune or regroup the SUL-derived representation while keeping the decoded document, and therefore its recomputed SUL identity, unchanged.

## 8. Most informative next steps

1. **Cost-based rule selection.** Estimate conditional code lengths, prune rules whose definition/reference overhead exceeds their savings, and iterate after ancestor substitutions. Compare with the current minimum-length sweep.
2. **Preserve literal context.** Try byte-oriented literals with explicit handling of bit-aligned boundaries, longer contexts, and separate models for text, lengths, and references.
3. **Use structural constraints.** At actual SUL word boundaries, symbol order constrains the next symbol. A model for relative ranks or gaps could exploit that. Unique hash bytes remain effectively unpredictable; modeling must focus on known symbols and structural events.
4. **Compare traversal orders.** Measure first-use depth-first coding against level/generation-ordered dictionaries with sorted pairs and delta/interpolative encodings. Include all dictionary and model-description bytes.
5. **Permit multiple physical modes.** Choose raw data, arithmetic-only data, raw grammar, or arithmetic-coded grammar per independently decodable block. The CLI already makes this choice for the whole document.
6. **Study the joint system.** Test multiple actual revisions with shared dictionaries and measure both compressed storage and bytes transferred. Compare with grammar compressors and modern LZ-based compressors under explicit memory budgets.

A single adaptive arithmetic stream can change its suffix after an early edit, even if the logical SUL nodes remain stable. Preserving useful byte-level deduplication of the compressed representation will require independently encoded blocks or explicit model checkpoints. There is a tradeoff between global compression and independent retrieval/synchronization.

## 9. Running the prototype

Extract [prototype.zip](prototype.zip) into a separate working directory and run
the commands below from its `sul-compression-research/` directory. The archive is
a frozen research artifact with its original dependency snapshot, rather than a
module imported by the current FunctionalScript package. The experimental source
is also available as a [reviewable code listing](prototype.md).

Requires Node.js 24 with built-in Zstandard support. No npm installation is needed.

```bash
node --test test.mjs
node benchmark.mjs
node cli.mjs compress INPUT OUTPUT.sulc
node cli.mjs decompress OUTPUT.sulc RESTORED
```

The CLI tries both graph forms, five rule thresholds, and both raw/arithmetic grammar coding. It also tries arithmetic-only and raw-document fallbacks, verifies the selected result by decoding it, then writes the output. This is an intentionally expensive research selection procedure.

Tests cover arithmetic interval renormalization and frequency rescaling; every bitstring of length zero through eight; longer repeated, irregular and non-byte-aligned inputs; grammar references; and basic frame checks. The benchmark separately decodes all 160 grammar candidates and every baseline and checks exact equality with the original inputs. Four Node test cases passed, and the CLI file round-trip was byte-identical.

### File format

All modes begin with a 14-byte header:

| Field | Bytes |
|---|---:|
| ASCII `SULC` | 4 |
| Prototype format version (`1`) | 1 |
| Mode (`0` raw document, `1` raw grammar, `2` arithmetic grammar, `3` arithmetic-only document) | 1 |
| Original bit length, unsigned big-endian | 4 |
| Payload byte length, unsigned big-endian | 4 |

Grammar tags are CONCAT=`00`, LITERAL=`01`, DEFINE=`10`, REFERENCE=`11`. Integers use a zero-based gamma representation: encode `value + 1` as unary bit-length prefix followed by low bits. A definition reserves the next dictionary ID before its body; references may only use completed definitions. The reference field is `dictionarySize - 1 - targetId`.

The reconstructed grammar expansion includes SUL's terminal `1` followed by zeros. The stored original length identifies and verifies that suffix. Adaptive arithmetic models reset at the start of each document. Code details in `arithmetic.mjs` are part of this experimental format definition.

This is a research implementation with in-memory graphs and bitstrings, limited frame lengths, and a decoder intended for these experiments. It is not a production archival format, native SUL CAS serializer, or hardened decoder for arbitrary untrusted archives.

### Contents and attribution

- `arithmetic.mjs`: adaptive arithmetic coder and syntax models.
- `sul-graph.mjs`: capture, graph expansion, and rule selection.
- `codec.mjs`: lossless grammar serialization and decoding.
- `cli.mjs`: compression/decompression commands.
- `test.mjs`: round-trip and coder tests.
- `benchmark.mjs`: deterministic fixture generation and measurements.
- `results/`: complete metrics and summary CSV. Running `benchmark.mjs` regenerates
  all 160 encoded experimental outputs; those regenerable binaries are omitted
  from the archive.
- `vendor/fjs/`: unchanged dependency closure from the inspected FunctionalScript commit; the upstream MIT license is in `vendor/LICENSE`.

See also the [SUL and deduplication background](background.md) and the
[research contents](README.md). The experiments and codec were created for this
investigation of SUL compression. [Upstream FunctionalScript SUL source](https://github.com/functionalscript/functionalscript/tree/d16a9ebf39b30a42e1b795bc329774d867196841/fjs/sul).

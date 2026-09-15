# SUL, deduplication, and content-defined trees

This is the background to the [compression experiment](compression.md).
Implementation observations are pinned to FunctionalScript commit
[`d16a9ebf39b30a42e1b795bc329774d867196841`](https://github.com/functionalscript/functionalscript/tree/d16a9ebf39b30a42e1b795bc329774d867196841/fjs/sul).
Comparisons describe mechanisms and possible applications; they are not measured
rankings of SUL against the other tree constructions.

## What SUL represents

Synthetic Universal Language gives a finite symbol sequence a recursively defined
structure. For a document, the starting symbols are bits. A word consists of a
strictly decreasing prefix followed by a symbol greater than or equal to the
last prefix symbol. For example, `[4, 2, 1, 3]` is one word: `4 > 2 > 1`, then
`1 <= 3`. Each completed word has at least two symbols and becomes a symbol at
the next level.

The literal construction enumerates words exactly. For an alphabet of size `n`,
the next alphabet has `(n - 1) * 2^n + 1` symbols. Starting with two bits gives
alphabet sizes `2`, `5`, `129`, and `2^136 + 1`. These increasingly large literal
symbols carry the encoded content itself.

The inspected implementation uses three literal levels, then hash levels. A
hash level organizes a word's decreasing prefix into a Patricia trie and merges
its root with the terminating symbol. The merge callback exposes the two child
IDs, the resulting ID, and whether this is the terminal merge for a word.
An ID can contain a literal, a short raw bit vector, or a hash. Raw inlining is
limited to 253 bits; hash IDs use a tag bit and a 255-bit hash payload.

This distinction matters: **the mathematical literal construction is reversible,
but a fixed-size hash root is a reference, not a self-contained encoding of an
arbitrary document**. Large documents require the reachable child definitions in
backing storage. Treating hash equality as content equality also assumes no
collision for the data involved. The prototype uses hashes as identifiers under
that assumption and verifies every tested document by exact round-trip.

The root identifies the document under the chosen SUL version and encoding
conventions. Names, authorship, timestamps, and application semantics are separate.
SUL does not infer an AST or the meaning of a document. Where an application
already has useful semantic structure, that structure may be a better basis for
content addressing than a synthetic decomposition of serialized bits.

## Where deduplication comes from

Equal subtrees can share one stored definition, producing a DAG. Sharing can
occur at several scales, including inside larger words, because Patricia merges
are also exposed. A repeated substring is useful to this representation when its
decomposition exposes equal reusable nodes; arbitrary repeated substrings are
not automatically dictionary entries.

Content dependence alone does not establish a strong edit-locality guarantee.
At one SUL level, the increasing sequence `[1, 2, 3, 4, 5, 6]` produces words
`[1, 2]`, `[3, 4]`, `[5, 6]`. Prepending `0` instead produces `[0, 1]`, `[2, 3]`,
`[4, 5]`, with `6` pending. This illustrates boundary propagation at a level;
it is not a complete bitstream counterexample or a measured average-case result.
No worst-case edit-locality theorem for the complete SUL pipeline was established
in this research.

Likewise, shrinking word levels is not by itself a proof of every desired bound
on binary Patricia height, update work, or the memory use of a graph-building
compressor. The experiment records one-shot timings and uses in-memory graphs;
it does not establish an optimized throughput or memory ranking.

## Comparison with other deduplication approaches

| Approach | Reuse unit | Consequence for a SUL comparison |
|---|---|---|
| Whole-document deduplication | An identical complete document | Simple identity-based reuse; misses unchanged regions inside changed documents. |
| Fixed-size chunking | Equal blocks at predetermined boundaries | Simple boundaries, but insertions can shift every later block. SUL uses content-dependent grouping. |
| Content-defined chunking, including FastCDC | Byte chunks with content-dependent boundaries | A strong practical baseline for subdocument reuse. Chunking alone does not specify a recursive index or entropy-coded archive. |
| rsync | Matching ranges in a sender document against blocks of a receiver's base | A base-relative transfer algorithm. Its rolling scan can match at shifted offsets; it is not the same operation as independently partitioning both documents with CDC. |
| SUL | Equal nodes in its recursive decomposition | Supplies hierarchical candidates and identity; storage overhead and boundary behavior still need measurement. |

FastCDC studies faster content-defined chunking while retaining useful
deduplication. The rsync description specifies fixed blocks on the receiver and
a rolling search on the sender. Neither source supplies an experimental ranking
against SUL. [FastCDC, USENIX ATC 2016](https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia),
[the rsync algorithm](https://rsync.samba.org/tech_report/node2.html).

## SUL versus Prolly Trees and CDMT

The references here are Dolt's June 2022 chunker article and the 2021 arXiv
version of the container-delivery CDMT paper, rather than claims about every
current implementation bearing those names.

| Dimension | SUL at the inspected commit | Prolly Trees in the Dolt article | CDMT in the cited paper |
|---|---|---|---|
| Starting representation | Bit sequence, then literal symbols | Ordered key/value sequence | Content-defined data chunks |
| Recursive grouping | Decreasing-prefix words; Patricia merges | Chunk nodes, then recursively chunk separator/address pairs | Window-based boundary tests over child hashes |
| Primary role | Synthetic document structure and identity | Versioned ordered index | Index for identifying container chunks to exchange |
| Retrieval information | Reachable node definitions; offsets need additional bookkeeping | B-tree-like key lookup and Merkle comparison | Deduplicated chunks plus a separate ordered reconstruction recipe |
| Compression in this research | Local rules, references, and arithmetic coding were tested | No Prolly compression benchmark performed | No CDMT compression benchmark performed |

Prolly Trees require history independence: contents determine structure rather
than insertion history. The article also describes Dolt's key-hash boundary
decisions and size-dependent split probabilities. Thus determinism and
content-defined internal nodes are not unique SUL advantages.
[Dolt's Prolly chunker article](https://www.dolthub.com/blog/2022-06-27-prolly-chunker/).

CDMT applies content-dependent grouping above the leaf chunks. The paper
explicitly supports shift robustness with examples and experiments rather than
a formal robustness proof. Its reported storage and network improvements are
specific to its container workload and are not SUL compression results.
[Content-defined Merkle Trees for Efficient Container Delivery](https://arxiv.org/html/2104.02158v1).

The engineering comparison has two separate questions: which logical
decomposition shares useful content, and how efficiently its unique data and
reconstruction instructions are physically encoded. Local dictionary IDs and
entropy coding can be applied to other suitable DAGs too. SUL's opportunity is
to provide a useful reusable decomposition, not exclusive access to that coding
technique.

## Potential applications and what remains to be shown

- **Document revision stores:** share unchanged subtrees across revisions, then
  compress their physical representation. Measure total unique content, index
  overhead, metadata, and garbage collection, not just per-document archives.
- **Synchronization and software distribution:** compare known roots and descend
  through changed structure. Measure discovery requests as well as payload bytes;
  a node dictionary available only to the sender is not a usable receiver cache.
- **Self-contained archives:** encode selected subtrees once and preserve their
  occurrence order with references. This is what the accompanying prototype
  demonstrates, with no external base or shared dictionary.
- **Opaque binary documents:** exploit repetitions without requiring a parser.
  Compare against CDC plus block compression and established grammar compressors.
- **Shared content-addressed computation:** reuse document identities and stored
  content where the computation actually operates on those units. Structural
  equality alone does not establish semantic equivalence or a cache policy.

The current [CAS Strategy 3 plan](../../cas/plan/strategy-3.md) distinguishes SUL
as a boundary provider from using its native tree as the storage format. The
compression experiment is a third, physical-encoding question: its decoded bits
can be re-encoded to recover their SUL identity, but its archive is neither the
Strategy 3 node format nor a native SUL CAS serializer. It does not settle that
plan's byte-alignment, offset lookup, or maximum-chunk-size choices.

For a useful follow-up comparison, run the same real document histories through
SUL, a CDC baseline, and an appropriate content-defined tree. Count all unique
payload and index bytes, reconstruction recipes, CPU time, peak memory, edit
amplification, and bytes exchanged with explicit receiver state. Keep the logical
decomposition and physical compressor parameters visible. The separate
[compression report](compression.md#8-most-informative-next-steps) lists the
specific codec experiments suggested by the measurements.

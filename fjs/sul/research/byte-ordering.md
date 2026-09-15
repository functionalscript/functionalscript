# Reordering the byte alphabet to produce longer SUL groups

Optimizing the level-zero byte order produces fewer level-one groups on nine of
ten inputs and ties on one. Average group length rises from 2.640 to 3.182 bytes
for source code and from 2.734 to 4.388 for JSON. Full compression improves on four
inputs, ties on three, and becomes larger on three. Thus the grouping objective
works on these samples, while group count alone does not determine compressed size.

This follows [the byte-alphabet experiment](byte-alphabet.md). It changes only
the comparison order of the 256 byte symbols at level zero. It does not search
higher-level permutations, replace adaptive arithmetic coding, use the Brotli
static dictionary, or select the order by compressed size.

## Search and objective

An order lists all 256 byte values from lowest to highest rank. A completed SUL
word contains a strictly decreasing prefix followed by the first symbol greater
than or equal to its predecessor. Every word becomes one symbol at the next
level. For N input bytes divided into M groups, the measured mean length is N/M.
The last incomplete word, if any, counts once: these are precisely the level-one
occurrences intersecting real input. Padding-only occurrences are excluded from
the grouping objective but included in every encoded size.

Search is deterministic, using xorshift32 seed 0x53554c31:

1. Start from eight orders: natural, reverse, first occurrence, frequency in both
   directions, and three shuffled observed-byte orders.
2. Refine each with up to 12 insertion sweeps over the directed transition-count
   objective, favoring frequent pairs whose ranks decrease. Keep both initial
   and refined candidates. This proxy is a
   [linear-ordering objective](https://grafo.etsii.urjc.es/optsicom/lolib.html).
3. Score candidates with the actual full-input SUL word count. From the best
   three distinct candidates, run 2,048 proposals each, alternating swaps and
   insertion moves. Bounded simulated annealing permits temporary regressions;
   the best order found is always retained.
4. Finish with up to three sweeps of adjacent observed-symbol swaps, accepted
   only when the actual full-input group count decreases.

There is no claim of a global optimum. Each file is its own fitting sample.
The natural order remains the best result until a strict improvement is found.
Unobserved symbols still appear in every complete 256-value permutation; their
placement is not learned from nonexistent observations.

## How the order enters SUL

The shared raw-byte builder gains an optional byteOrder. Its first-generation
Patricia keys and descending comparisons use byte ranks, while compress receives
the original raw byte identities. Higher generations still compare the existing
numeric SUL IDs. Consequently the payload is never replaced by rank bytes.
Natural order reproduces the previous roots and the previous compressed files.

The recursive first-occurrence dictionary codec, keep/skip search, bit-length
metadata, raw alternatives, and adaptive binary arithmetic coder are unchanged.
All later dictionary frontiers remain eligible, including level zero.

The SULO reconstruction recipes already describe lengths and references and store
the final original bits. The existing decoder therefore restores an optimized
file without knowing its order. No permutation transmission cost is hidden:
the order is an encoder choice, not a decoder prerequisite in this explicit
format. A different format that reconstructs literal SUL symbols from ranks
would need to transmit or pre-share it. These experiment roots are not proposed
as replacements for the canonical native SUL identity.

## Grouping results

The ten fixture SHA-256 values match the previous byte experiment exactly. There
is one 64 KiB source sample plus nine generated fixtures. Measurements use Node
v24.19.0 and the pinned SUL snapshot. Group counts cover original input only.

| Input | Original groups | Optimized groups | Mean length before | Mean length after | Fewer groups |
|---|---:|---:|---:|---:|---:|
| Source code | 24,821 | 20,599 | 2.640 | 3.182 | 17.01% |
| JSON records | 21,642 | 13,483 | 2.734 | 4.388 | 37.70% |
| Repeated phrase | 22,452 | 15,170 | 2.919 | 4.320 | 32.43% |
| Repeated random block | 48,736 | 40,961 | 2.689 | 3.200 | 15.95% |
| Edited versions | 48,736 | 40,676 | 2.689 | 3.222 | 16.54% |
| Recursive sequence | 27,307 | 27,307 | 2.400 | 2.400 | 0.00% |
| Biased bits | 31,531 | 31,517 | 2.078 | 2.079 | 0.04% |
| Uniform pseudorandom bytes | 24,190 | 23,165 | 2.709 | 2.829 | 4.24% |
| Repeated sentences | 24,577 | 16,129 | 2.762 | 4.208 | 34.37% |
| Unique sentences | 24,186 | 17,164 | 2.790 | 3.931 | 29.03% |

## Complete compression results

Sizes below include the full 14-byte frame, recursive dictionaries and recipes,
arithmetic finalization, and any encoded padding. Existing raw or arithmetic-only
fallbacks remain available. A negative change is smaller. Brotli and Zstandard
sizes are the previously verified results for the identical input bytes.

| Input | Natural-order SUL | Optimized-order SUL | Change | Brotli 11 | Zstandard 19 |
|---|---:|---:|---:|---:|---:|
| Source code | 35,024 | 35,570 | +1.56% | 15,869 | 17,963 |
| JSON records | 11,536 | 10,432 | -9.57% | 3,175 | 4,109 |
| Repeated phrase | 188 | 164 | -12.77% | 81 | 99 |
| Repeated random block | 4,441 | 4,395 | -1.04% | 4,131 | 4,121 |
| Edited versions | 5,789 | 5,934 | +2.50% | 4,325 | 4,270 |
| Recursive sequence | 209 | 209 | +0.00% | 103 | 153 |
| Biased bits | 5,168 | 5,168 | +0.00% | 6,634 | 6,858 |
| Uniform pseudorandom bytes | 65,550 | 65,550 | +0.00% | 65,540 | 65,546 |
| Repeated sentences | 430 | 464 | +7.91% | 156 | 189 |
| Unique sentences | 5,025 | 4,250 | -15.42% | 992 | 935 |

Selecting the smaller of natural and optimized encodings would give four wins
and six ties against natural order, at the cost of running both encoders. The
optimized column itself reports the group-count winner, even when it compresses
worse; it is not cherry-picked by compressed size.

Source code is a useful counterexample: its level-one group count falls 17.01%,
but the number of distinct real-input groups rises from 3,847 to 4,598 and the
complete file grows by 546 bytes. Group lengths, dictionary contents, references,
higher-level grouping, and padding all contribute. Unique sentences improve by
775 bytes even though their distinct level-one groups rise from 153 to 532, so
unique-group count alone is not sufficient either.

Brotli 11 remains smaller on nine of these ten inputs. The exception is biased
bits, which selects the unchanged arithmetic-only fallback in both SUL runs;
that result is not an alphabet-ordering gain.

## Fitting versus generalization

The uniform pseudorandom fitting sample also shows a 4.24% group-count reduction.
This reflects fitting to finite-sample patterns. It does not contradict the
order-invariant expected word length for a fixed order under independent draws,
and it does not yield compression: both runs select the same raw fallback.

A separate grouping-only check applies the fitted order to previously unused
input, without any new search:

| Input | Bytes | Natural groups | Fitted-order groups | Natural mean | Fitted-order mean |
|---|---:|---:|---:|---:|---:|
| Source code | 65,536 | 24,614 | 23,441 | 2.663 | 2.796 |
| Uniform pseudorandom bytes | 65,536 | 24,216 | 24,142 | 2.706 | 2.715 |

The source check uses the next 64 KiB of the sorted vendored source stream. The
random check uses an independent xorshift32 seed, 0x81ac339b. The source order
retains a smaller grouping gain; the random result is close to the expected
uniform-byte mean of (1 + 1/256)^256, approximately 2.713. These two checks do not
establish generalization across source projects or natural data distributions.

## Validation and reproducibility

- All 20 complete files decoded to the original bytes with the unchanged decoder.
- All ten natural-order controls reproduced previous encoded files byte for byte.
- For both orders on every input, a tree-occurrence traversal confirmed that the
  search's group counter matches the level-one groups intersecting original data.
- Six prototype tests check permutation validation, an independent exhaustive
  three-symbol stopping-rule oracle, natural-root compatibility, a 257-byte word
  crossing the inline/hash threshold, decoding without an order table, and
  deterministic search with a natural-order bound.
- The run records 2,772 internal recipe cost comparisons. These are not 2,772
  separately decoded files. Search evaluations and every selected order are in
  the complete measurements.
- Search consumed about 17.3 seconds in total across ten files in this one run.
  This is not a steady-state performance or memory benchmark. All prototype
  padding and depth limits from the earlier byte experiment still apply.

Extract [order-prototype.zip](order-prototype.zip) outside the repository and
follow its README. See [the source listing](order-prototype.md),
[complete results](order-results.json), [summary CSV](order-summary.csv),
[held-out grouping check](order-heldout.json), and
[all ten complete byte orders](byte-orders.json).

## Successor graphs and starting frequency

The follow-up asks whether likely successors should determine the byte order,
starting with either the most frequent or the least frequent symbol. Define
C(a,b) as the count of adjacent a,b pairs. For a fixed a, ranking successors by
P(b | a) is equivalent to ranking by C(a,b). Across different sources, raw
conditional probabilities ignore how often each source occurs; counts preserve
that contribution.

The observed transition graph generally contains cycles and self-loops, so it
is not automatically a DAG. A static strict total order cannot make every edge
of a directed cycle descend, and equal successive symbols cannot descend under
any permutation. After selecting an acyclic subset of desired transitions, a
topological sort supplies a total order; the DAG itself may permit many such
orders. Favor a -> b by assigning rank(a) > rank(b), because SUL words extend on
strict descent. Reverse a source-first topological traversal to print ascending
ranks.

Five deterministic candidates are compared without further local search:

- Successor chain: start with the most frequent observed byte, then repeatedly
  choose the most frequent unvisited successor. Break ties by marginal frequency,
  then byte value. Reverse the traversal for ascending ranks.
- Rare-start chain: change only the first choice to the least frequent observed
  byte. Zero-frequency bytes are never selected as observed starting symbols.
- Frequent-first DAG: process source symbols in descending frequency and their
  successors in descending conditional probability; reject any edge that would
  close a cycle. Topologically sort with frequency tie-breaking.
- Rare-first DAG: process sources in ascending frequency and use that priority
  for topological ties; successor probabilities still descend.
- Margin DAG: for each unequal pair of counts, favor the orientation with the
  larger count, prioritized by the difference C(a,b)-C(b,a). Greedily reject
  cycles, then topologically sort. This is a heuristic for the globally weighted
  transition objective, not its optimal solution.

All absent bytes are included deterministically in each complete permutation.
The following counts cover real-input level-one groups; lower is better. These
are additional grouping-only measurements, not new compressed-file sizes.

| Input | Natural | Frequent chain | Rare-start chain | Frequent DAG | Rare-first DAG | Margin DAG | Earlier full search |
|---|---:|---:|---:|---:|---:|---:|---:|
| Source code | 24,821 | 25,381 | 25,180 | 25,562 | 25,177 | 21,394 | 20,599 |
| JSON records | 21,642 | 20,461 | 19,099 | 18,416 | 20,284 | 16,099 | 13,483 |
| Repeated phrase | 22,452 | 20,026 | 21,846 | 23,058 | 23,058 | 17,599 | 15,170 |
| Repeated random block | 48,736 | 47,040 | 47,744 | 44,672 | 45,152 | 44,096 | 40,961 |
| Edited versions | 48,736 | 46,788 | 46,979 | 44,701 | 45,088 | 43,998 | 40,676 |
| Recursive sequence | 27,307 | 27,307 | 27,307 | 27,307 | 27,307 | 27,307 | 27,307 |
| Biased bits | 31,531 | 31,530 | 31,553 | 31,533 | 31,537 | 31,547 | 31,517 |
| Uniform pseudorandom bytes | 24,190 | 24,078 | 24,018 | 24,078 | 24,067 | 23,684 | 23,165 |
| Repeated sentences | 24,577 | 25,344 | 24,576 | 20,737 | 22,273 | 21,504 | 16,129 |
| Unique sentences | 24,186 | 24,844 | 24,881 | 21,773 | 21,881 | 21,090 | 17,164 |

Starting the chain with the rarest observed symbol wins on four inputs, ties on
one, and loses on five relative to starting with the most frequent. The rare-first
DAG wins twice, ties twice, and loses six times against the frequent-first DAG.
Thus neither starting-frequency rule is uniformly better on these fixtures.
None of these unrefined candidates improves on the earlier searched order.
The earlier search already uses weighted transition insertion refinement to
seed its exact group-count search; it is not based on marginal frequencies alone.

The margin DAG is a useful inexpensive candidate: source code has 21,394 groups
versus 24,821 naturally and 20,599 after the earlier full search. However, global
pair weights are still a proxy because SUL consumes the terminating symbol and
restarts the next word after it. Candidate orders must be scored with the real
parser, and compression decisions must ultimately use complete encoded size.

The companion script checks a known directed cycle, a descending chain, empty
input, every complete permutation, fixture hashes, and the rank direction of all
accepted graph edges. All five full orders per fixture and graph statistics are
preserved in [successor results](successor-results.json). The runnable archive and
source listing include the script. The preceding full compression measurements
and printed 256-value source order remain the original search results.

## Further tuning

The measurements support further tuning, rather than a conclusion that the
current codec is competitive with Brotli. Useful independent variables are
alphabet choice, comparison order, and probability model. A next compression
search should retain several promising groupings and select by complete encoded
size, including the costs of any model or dictionary descriptions.

Shared fixed-frequency tables are a separate hypothesis: train them on emitted
literal, reference, new-entry, and length streams, then evaluate on held-out
documents. Their version and distribution cost must be explicit. Compare them
with both per-block measured tables and adaptation initialized from trained
priors. The present experiment changes only byte ordering and establishes no
compression gain from those untested probability-model combinations.

## Complete source-code byte order

This order was fitted to the original 64 KiB source sample. All 256 decimal byte
values appear exactly once, from lowest to highest comparison rank. The sample
contains 105 observed byte values. Array position gives rank; the number stored
at that position is the original byte value, not an output-byte substitution.

```json
[
   76,  86, 112, 137, 226,  83,  36, 128,  60,  77, 119,  79,  47, 120,  48,  61,
   94,  33, 118,  45,  91,  39,  40,  87, 126, 123,  42,  43,  38,  32,  10,  34,
   44,  58, 125,  72,  96, 181,  59,  85, 109,  41, 146, 100,  95, 178, 107,  62,
   46,  93, 121, 101, 134,  73, 104, 122,  74, 116, 115, 183,  64, 106, 103,  88,
  110, 105, 148,  35, 108, 164,  50,  49,  56, 194,  63,  51,  65,  97,  71,  52,
   66,  82,  69, 195, 111,  98,  78, 114,  84,  57,  68, 117,  80,  67,  99,  70,
  124,  55, 102, 147, 113, 165,  54, 206,  53,   0,   1,   2,   3,   4,   5,   6,
    7,   8,   9,  11,  12,  13,  14,  15,  16,  17,  18,  19,  20,  21,  22,  23,
   24,  25,  26,  27,  28,  29,  30,  31,  37,  75,  81,  89,  90,  92, 127, 129,
  130, 131, 132, 133, 135, 136, 138, 139, 140, 141, 142, 143, 144, 145, 149, 150,
  151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 166, 167, 168,
  169, 170, 171, 172, 173, 174, 175, 176, 177, 179, 180, 182, 184, 185, 186, 187,
  188, 189, 190, 191, 192, 193, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205,
  207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222,
  223, 224, 225, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239,
  240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255
]
```

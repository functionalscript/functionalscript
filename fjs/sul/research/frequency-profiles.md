# Shared frequency profiles as compression metadata

A registry can hold immutable statistical profiles for generic documents, text,
ASCII and JSON. An encoder can try their models, select the smallest complete
representation, and include the chosen profile's hash. This experiment implements
that design with the existing SUL dictionary codec.

The mechanism works, but these first profiles do not improve compression. On
12 separate test documents, the unchanged adaptive model beats every fixed-profile
candidate and every candidate initialized from a trained prior. The selector
therefore chooses adaptive coding for all 12 documents. This is a negative result
for these specific models and this small corpus, not a search for the best
possible profiles or evidence that shared profiles cannot help.

## What stays in the dictionary and what becomes metadata

The byte alphabet, comparison order, raw-byte SUL hierarchy, original document
bytes, and first-occurrence dictionary construction are unchanged. Frequency
profiles live separately from those objects. A profile reference belongs to the
compressed representation; it need not alter the identity of a dictionary or of
the decoded document. The encoded transport bytes naturally have their own hash.

The prototype's profile schema describes the existing binary arithmetic contexts:
first-use decisions, integer representations of counts and lengths, reference-ID
prefixes, and literal bits conditioned on the previous eight transmitted bits.
It does not claim that local dictionary ID 17 represents the same content in two
different documents. A content-specific word-frequency table would need a shared
alphabet/dictionary, stable content identifiers, or a defined mapping into the
current dictionary. This pilot instead models stable coding-event definitions.

A dictionary entry's contents and order do not depend on which frequency profile
is tried. The codec still evaluates complete recipe-plus-dictionary costs, so the
selected retained levels and raw/arithmetic alternatives can change with a model.
That is an encoding choice over the same candidate hierarchy.

## Registry and decoding

The registry maps friendly labels to immutable profile objects. Each profile has
schema `sul-ordered-binary-contexts-v1`, total weight 4096, and sorted rows of
`[context, zeroWeight, oneWeight]`. Canonical serialization has exactly these
fields in this order: `schema`, `total`, `rows`, followed by a newline. SHA-256 of
those bytes identifies the profile. Training provenance is separate registry
metadata, so labels can change without changing a profile's mathematical content.

The local prototype registry can be served centrally, while encoders and decoders
cache or mirror the immutable objects. No central service is deployed by this
experiment. Correct decoding uses the selected hash, not a mutable label such as
`json/latest`; the decoder rejects a missing or mismatching profile.

A profiled representation contains:

| Field | Bytes |
|---|---:|
| `SULP` magic | 4 |
| Coding policy: 1 fixed, 2 adaptive from a prior of total 16 | 1 |
| SHA-256 profile identifier | 32 |
| Complete inner `SULO` representation | variable |

The added reference cost is 37 bytes. An adaptive winner remains the original
`SULO` format, with its existing 14-byte frame and no profile reference. The
encoder compares every candidate's actual complete size; adaptive wins a tie.
Selection is per document. Block switching and negotiation of compact registry
indices are not implemented.

## Training data and probability models

The pilot uses 22 training documents totaling 61,466 bytes and 12 different test
documents totaling 26,537 bytes. Whole files and their licenses are included in
the archive. No input-content hash occurs in both splits.

For FunctionalScript source and Markdown, and Brotli C sources, eligible whole
files have 512..8192 bytes. Relative paths are sorted by SHA-256; the first six
files train and the next three test in each category. Six named real JSON package
and configuration documents are sorted by the hash of project/path; four train
and two test. A pre-existing 632-byte compressed Brotli test file is an additional
binary control. Selection does not use compressed sizes. This is a small
convenience corpus, with same-project related material and only two JSON tests;
it does not establish broad cross-project or binary-format generalization.

Corpus sources are pinned independently from the SUL dependency: see
[the corpus manifest](profile-corpus.json). FunctionalScript corpus content comes
from commit `53d792ba4df9c7530994ff37f77ce3f19fb127ed`, Brotli from
`09e1ac6c7eea9d3b53f85bcdde6347358dbe1281`, and the TypeScript package version is
recorded in that manifest. The codec still uses SUL snapshot
`d16a9ebf39b30a42e1b795bc329774d867196841` and Node.js v24.19.0.

Each training document is encoded with the unchanged adaptive codec. Its final
encoding is then decoded with an observer that counts arithmetic events by
context. Discarded search candidates and raw-coded streams contribute no events.
For a context observed at least 16 times, add one to each binary count, normalize
to total 4096, and clamp each weight to at least one. Unobserved or rarer contexts
use the implicit uniform model `[1,1]`. These thresholds were not fitted to test
compression sizes.

| Profile | Training documents | Context rows | Profile JSON bytes |
|---|---:|---:|---:|
| generic | 22 | 450 | 7,537 |
| text | 6 | 182 | 3,090 |
| ascii | 13 | 352 | 5,875 |
| json | 4 | 111 | 1,897 |

`generic` pools every training category. It is a mixed textual-data profile, not
representative statistics for all possible files. `text` uses the six Markdown
documents, `ascii` uses the 13 training documents whose bytes are all below 128,
and `json` uses the four JSON documents. Every profile can still represent any
byte sequence because all modeled outcomes and fallback contexts have positive
probability; the label is a selection hint rather than an input restriction.

Fixed mode never updates the probabilities. After the fixed-profile losses were
observed, an additional control used the same tables as small priors: initialize
each modeled context to total 16, then use the original adaptive updates and
rescaling independently in each arithmetic stream. The shared objects remain
immutable. This control was added after inspecting the fixed results, without
refitting tables, so its test-set comparison is exploratory.

## Complete test results

The fixed and prior columns show the smallest result among the four profiles in
that policy. Their 37-byte reference wrappers are included. This is the same
per-document choice available to an encoder, not an untransmitted choice of model.
All sizes are bytes.

| Test document | Input | Adaptive SUL | Best fixed profile | Best prior-16 profile | Brotli 11 | Zstandard 19 |
|---|---:|---:|---:|---:|---:|---:|
| source-06 | 2,112 | 1,445 | 1,697 | 1,503 | 792 | 1,006 |
| source-07 | 3,615 | 2,259 | 2,734 | 2,331 | 1,150 | 1,377 |
| source-08 | 982 | 753 | 934 | 810 | 408 | 481 |
| text-06 | 1,549 | 1,184 | 1,324 | 1,223 | 677 | 875 |
| text-07 | 1,786 | 1,391 | 1,557 | 1,431 | 799 | 1,019 |
| text-08 | 512 | 408 | 551 | 445 | 271 | 360 |
| c-06 | 2,275 | 1,496 | 1,829 | 1,560 | 691 | 830 |
| c-07 | 1,458 | 1,093 | 1,344 | 1,152 | 530 | 657 |
| c-08 | 7,983 | 1,765 | 2,429 | 1,879 | 673 | 782 |
| json-04 | 546 | 382 | 483 | 428 | 215 | 232 |
| json-05 | 3,087 | 1,570 | 1,926 | 1,647 | 724 | 829 |
| binary-00 | 632 | 646 | 683 | 683 | 636 | 642 |

The selector's complete output totals 14,392 bytes, identical to the adaptive
baseline; Brotli totals 7,566 bytes and Zstandard 9,090 bytes. All 12 documents
select the adaptive baseline. Even after removing the 37-byte profile reference,
no fixed or prior candidate is smaller than that baseline. Some prior/raw
fallback cases tie before the wrapper. Thus identifier size alone does not
explain the losses.

The dictionary-registry mechanism and the quality of the registered models are
separate questions. These results establish lossless selection and decoding,
but provide no compression improvement from the four tables. Possible causes
to test include pooling contexts from different dictionary levels and stream
sizes, a training objective biased toward the adaptive codec's selected streams,
and inadequate corpus coverage. These are hypotheses, not measured attributions.

## Cached and uncached profile costs

Warm sizes assume the decoder already has the referenced profile. A cold
single-document comparison additionally charges the profile's exact canonical
JSON bytes, as recorded for every candidate in the results. Those objects range
from 1,897 to 7,537 bytes. The best cold choice is also adaptive for every test.
For a batch, count each newly obtained distinct profile once, not once per file.
Registry transport overhead and compression of the profile objects themselves
are not measured. No profile-distribution saving is claimed.

The existing Brotli dictionary experiment already showed that supplying common
words can help SUL while leaving a large gap to Brotli. Brotli combines LZ77,
context modeling, and static dictionary references, so the static dictionary
alone cannot be assumed to explain that gap. See
[RFC 7932](https://www.rfc-editor.org/rfc/rfc7932.html), especially sections 2, 7
and 8. The next profile search should optimize complete encoded size on validation
documents and reserve an additional corpus for final evaluation.

## Relationship to the dictionary discussion

Top-down first-occurrence deduplication remains the underlying algorithm. Each
lower pass processes only retained dictionary contents and preserves enough
boundaries to reconstruct the upper entries. Higher-level matches can save more
content per reference, but a repetition is retained only when its complete cost
wins. At a byte-level frontier with 64 occurrences and 63 distinct literal byte
entries, the dictionary takes 504 bits and there are 2,016 first-occurrence-order
reconstruction patterns; a fixed-width pattern index takes 11 bits. This example
already grants the counts for free and shows why one duplicate alone need not pay
for the reconstruction when the unique dictionary is kept literally.

For the SUL stopping rule, an n-symbol alphabet has `(n-1)*2^n + 1` completed
words. That count does not require representing a whole word as one indivisible
integer: Patricia subtrees expose partial sharing. The latest byte builder does
not retain their internal nodes in the compression hierarchy; earlier bit-based
experiments examined finer Patricia frontiers. Direct coding of those subtrees
with richer profiles remains a separate experiment.

Shrinking legal ranges by themselves do not provide an additional entropy gain
under an unchanged probability model. For a continuation probability q and an
allowed symbol probability p, signaling continuation and coding the restricted
symbol costs `-log2(q) - log2(p/q) = -log2(p)`; the terminal case is analogous.
Any already-known shape carries that decision information elsewhere. Subtree
reuse and improved statistical modeling are the compression opportunities.

## Validation and reproduction

- All 108 SUL candidates decoded exactly, as did all 24 standard-codec outputs.
- All 22 training encodings decoded exactly while collecting statistics.
- Five profile tests cover fixed probabilities, rare outcomes, unseen contexts,
  immutable canonical profile IDs, invalid tables, missing/mismatched profiles,
  empty input, every byte value, selection overhead, and adaptive prior updates.
- The existing ordered/byte suites passed all 11 cases after adding optional
  arithmetic encoder/decoder factories. Their defaults remain unchanged.
- The adaptive factory reproduced the previous repeated-phrase byte encoding
  byte for byte.
- An extracted rerun reproduced all four profile objects and the registry exactly,
  all 108 encoded files byte for byte, and every non-timing measurement. The
  extracted CLI encoded a document and restored an explicitly profiled document
  exactly using its hash-selected cached profile.

The archive includes the complete corpus, profiles, registry, code, and recorded
measurements. Extract it outside the repository and follow its README. Training
and benchmarking need no npm installation or network access. The corpus-selection
Python script records how the snapshot was chosen; rerunning that selector needs
the original external checkouts, whereas reproduction uses the included files.

See [the registry](profile-registry.json), [complete results](profile-results.json),
[summary CSV](profile-summary.csv), [corpus manifest](profile-corpus.json),
[source listing](profile-prototype.md), and [runnable archive](profile-prototype.zip).

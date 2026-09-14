# SUL compression research

SUL can supply a grammar whose repeated subtrees are encoded once and reused
through local references. Arithmetic coding can compress that grammar further.
The experiment demonstrates lossless reconstruction and substantial compression
on repeated structures, but high-quality Brotli and Zstandard generally produce
smaller outputs on the tested inputs.

This directory preserves the complete investigation: what SUL provides, how it
compares with deduplication and content-defined trees, how the proposed codec
works, its measurements, and the unresolved design questions.

## Contents

- [Brotli dictionary at level zero](brotli-dictionary.md): test shared base
  entries and the full transform vocabulary with literal-byte fallback, direct
  coding, and recursive SUL dictionaries, including two short-document examples.

- [Byte symbols at level zero](byte-alphabet.md): test a byte-alphabet word/hash
  variant against both native SUL and a matched bit control, using the same
  ordered dictionaries and adaptive coder. Includes all ten fixture results.

- [Ordered dictionaries at lower levels](ordered-dictionaries.md): the follow-up
  experiment, with first-occurrence order, full keep/skip size comparisons,
  adaptive coding, and a control that disables dictionary recursion. Includes
  both word generations and finer Patricia frontiers, plus sentence fixtures.

- [Background and comparisons](background.md): SUL's construction, backing
  storage requirements, deduplication potential, Prolly Trees, CDMT, and possible
  applications.
- [Compression report](compression.md): algorithm, cost model, traversal,
  arithmetic coding, all benchmark summaries, limitations, related research,
  reproduction commands, and proposed next experiments.
- [Prototype source listing](prototype.md): all six experimental JavaScript
  files, verbatim, for review in a text diff.
- [Prototype archive](prototype.zip): runnable codec, tests, benchmark generator,
  the pinned SUL dependency snapshot with its MIT license, and recorded metrics.
- [Complete measurements](results.json): every candidate's parameters, sizes,
  input hashes, graph statistics, and one-shot timings.
- [Summary CSV](summary.csv): the eight inputs and compressor comparisons.
- [Artifact manifest](manifest.json): the inspected SUL commit, runtime version,
  and SHA-256 checksums for the archive and supporting artifacts.

## Scope and reproduction

The measurements use FunctionalScript commit
[`d16a9ebf39b30a42e1b795bc329774d867196841`](https://github.com/functionalscript/functionalscript/tree/d16a9ebf39b30a42e1b795bc329774d867196841/fjs/sul)
and Node.js `v24.19.0`. They are observations of that snapshot and the archived
prototype, not measurements of whichever commit currently contains this report.

Extract the archive outside the repository and follow its README. This keeps the
old dependency snapshot separate from the current package and proof discovery.
No npm installation is needed for the experiment. The benchmark regenerates the
160 encoded grammar outputs and verifies their decoding; those regenerable
binaries are omitted from the archive. The recorded sizes and input hashes can
be compared across runs; timings vary with the environment.

The archive and source listing deliberately preserve a research prototype rather
than install a new `fjs` command or declare a supported compression format. A
production implementation would need its own design, FunctionalScript modules,
proofs, resource limits, and integrity policy. The research does not claim an
optimal grammar, a universal compression guarantee, or a measured superiority
over Prolly Trees, CDMT, or CDC-based deduplication.

The existing [constant-reference serialization issue](../todo/080-serialization-const-ref.md)
and [single serialization mapping issue](../todo/076-serialization-mapping-once.md)
remain open. The experiment is evidence for further design work, not completion
of those tasks. Its relationship to the existing CAS Strategy 3 plan is explained
in [the background](background.md#potential-applications-and-what-remains-to-be-shown).

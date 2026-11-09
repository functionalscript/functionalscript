# Shared coverage graph: preparation measurements

Measured on 2026-11-09 against `e35f6e9aac557e5fef25c01fc2d79d84b9aff63b`,
before sharing the dependency graph. The final implementation includes loader
source fingerprints, runtime resolution and package-scope validation, and the
initial probe-entry byte check.

| Selected jobs | Preparation path | Baseline median | Shared graph median | Change |
| --- | --- | ---: | ---: | --- |
| Three | Successful miss | 21.313 s | 7.414 s | 65.2% less time; 2.87× faster |
| Three | Existing hit | 10.957 s | 6.688 s | 39.0% less time; 1.64× faster |
| One | Successful miss | 7.375 s | 6.936 s | 6.0% less time |
| One | Existing hit | 3.865 s | 6.715 s | 73.7% more time |

The three jobs are `fjs/types/result`, `fjs/types/function`, and
`fjs/types/nullable`; the single job is `fjs/types/result`. Their dependency
closures overlap. Sharing reduces runtime probes from six to one for the
three-job miss path, and from three to one for hit preparation. A single cached
job pays the shared framework snapshot and certification cost without amortizing
it across other jobs, so that case regresses.

The measurements call the real coverage context API, with no coverage children:

- Baseline: open the cache once; call `prepare(command)` before each job and
  again after each simulated successful miss.
- Shared graph: call `openCoverageCache(options, false, commands)` once, including
  the runtime probe and complete graph build; extract each command's manifests
  and validate before lookup and after each simulated successful miss.
- Hit preparation uses only the first baseline preparation, or the shared
  manifest extraction and pre-lookup validation. It excludes the post-run check.

Every final shared validation returned `true`. Validation rereads relevant input
bytes and resolutions; it does not reparse sources, rehash the graph, or probe
the runtime again. Unchanged native read chunks compare directly, with an exact
byte comparison when chunk layouts differ. The initial native source fingerprints
bind the probe's discovered framework inventory to the graph snapshot.

Times are medians of three fresh-process samples per scope and version, using
Node 26.13.0 on Linux x86_64, Intel Xeon Platinum 8573C, pinned to CPU 2. The
quiet baseline samples were collected in alternating baseline/shared order;
the final shared samples were rerun after runtime validation was completed.
Filesystem caches were warm. Timing includes context opening and graph building;
initial module imports, target discovery, cache lookup/save, synchronization,
and native coverage execution are excluded. This measures preparation rather
than total CI duration.

Parent-process read counters exclude the runtime subprocess's reads, so they
are unsuitable for comparing total I/O between versions.

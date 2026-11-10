# Isolated coverage measurements

## Production planning

Measured on 2026-11-09 against the three-phase implementation based on
`f8480dac3`, using its actual `openCoverageCache` and `createPlan` APIs. An
isolated Git checkout held the complete selected source set and the packed
`build-cache` tip `fe85eef21f49d0672bc7dbdf6336f1cc28a01b12`, containing 16,498
entries. The cache was seeded before timing; no network fetch was measured.

| Phase | Time |
| --- | ---: |
| Cold imports | 2.243 s |
| Discover and resolve all targets | 4.213 s |
| Shared graph, source hashes and runtime certification | 95.710 s |
| `createPlan`: all manifest keys and batch admission | 11.237 s |
| **Complete production plan** | **113.413 s (1 min 53 s)** |

This single local Node 26.13.0, Linux x86_64 sample planned 486 directories and
529 targets. It prepared 325 admitted manifest keys; 186 directories remained
uncacheable under the existing admission rules. No target hit, so all 486
directories were planned to run.

The command performed one runtime probe and one native Git tree inventory.
The inventory took 87.4 ms and returned 1,864,274 bytes. Because every key
missed, no `cat-file` verification was needed; runs with candidate hits verify
their complete prepared manifest contents in one batch.

The timing includes cold imports and all planning phases. It excludes
per-child input validation, coverage execution, successful-entry recording and
publication. No coverage child, `fast-import`, or synchronization ran. This is
a measurement of the complete production planning path, not an end-to-end CI
run or a measurement of warm-cache hit verification.

## Reporter startup

Fresh-process imports of `cov/reporter.mjs` on Node 26.13.0, measured locally on
2026-11-09, isolate the startup cost paid by each native coverage process:

| Implementation | Median import time |
| --- | ---: |
| `84a649218`, before coverage caching | 49.6 ms |
| `f8480dac3`, before reporter extraction | 2,361.0 ms |
| Current small admission-check module | 21.8 ms |

Each median uses three fresh processes, with no proofs executed. The current
samples were 21.805, 22.922 and 17.947 ms. Before extraction, the reporter
imported helpers from the full coverage runner, pulling its parser, hashing and
Git cache dependencies into each child. It now imports the small checks module
instead. The full planner's cold imports remain in the production planning
measurement above and are paid once.

## Historical measurements

A scratch full-plan prototype against `f8480dac3` took 121.619 s on 2026-11-09
for 485 directories and 528 targets, also with zero hits. It used the actual
shared graph and manifest-key APIs, then a proposed native Git batch membership
stage that was not yet the production lookup. That prototype excluded network
fetch, per-child validation, coverage execution, recording and publication.
The production measurement above supersedes it.

Earlier preparation-only measurements compared `e35f6e9aa` with the shared graph
in `f8480dac3`. For `fjs/types/result`, `fjs/types/function` and
`fjs/types/nullable` together, preparation for successful misses fell from a
21.313 s median to 7.414 s; hit preparation fell from 10.957 s to 6.688 s. For
`fjs/types/result` alone, hit preparation increased from 3.865 s to 6.715 s
because the framework snapshot cost was not shared across other jobs.

Those were three-sample fresh-process medians on Node 26.13.0, Linux x86_64,
Intel Xeon Platinum 8573C, pinned to CPU 2 with warm filesystem caches. They
included context opening and graph preparation but excluded initial imports,
discovery, cache lookup, coverage children, saving and synchronization. In
particular, they did not measure the expensive per-target Git CAS lookup left
in that revision and cannot establish an end-to-end speedup.

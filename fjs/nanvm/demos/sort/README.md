# Sorting

A quicksort of 100,000 pseudo-random integers, which reports the smallest
and the largest. It allocates as it goes, so it measures the NaNVM
runtime's allocation as much as its arithmetic. The demo below runs it as
JavaScript, as Rust→WebAssembly (`fjs compile`), and as IR→WebAssembly
(`from_fast` + `linkAny` on NaNVM L0), and shows what each run wrote, how
long each took, and the WASM times as multiples of the JavaScript one.
Containers stay on NaNVM imports on the IR route.

Node remasure of the IR entry vs JavaScript (median of 5 after warm-up, this
container, 2026-11-24 PT): about **35×** JavaScript (~49 ms JS, ~1.7 s IR) —
expected while array work remains L0 imports. Live page Run times remain the
user-facing metric.

See [WASM demos](../README.md) for the other pages.

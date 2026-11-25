# Collatz

The longest Collatz chain that starts below 30,000: arithmetic and a loop,
with no allocation, so it measures the NaNVM runtime's number handling
alone. The demo below runs it as JavaScript, as Rust→WebAssembly
(`fjs compile`), and as IR→WebAssembly (`from_fast` + `linkAny` on NaNVM
L0), and shows what each run wrote, how long each took, and the WASM times
as multiples of the JavaScript one.

Node remasure of the IR entry vs JavaScript (median of 5 after warm-up, this
container, 2026-11-24 PT): about **2.9×** JavaScript (~11 ms JS, ~31 ms IR).
Live page Run times include the browser host and remain the user-facing
metric.

See [WASM demos](../README.md) for the other pages.

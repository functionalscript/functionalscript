# Collatz

The longest Collatz chain that starts below 30,000: arithmetic and a loop,
with no allocation, so it measures the NaNVM runtime's number handling
alone. The demo below runs it as JavaScript, as Rust→WebAssembly
(`fjs compile`), and as IR→WebAssembly (`from_fast` + `linkAny` on NaNVM
L0), and shows what each run wrote, how long each took, and the WASM times
as multiples of the JavaScript one.

See [WASM demos](../README.md) for the other pages.

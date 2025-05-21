export default {
  add: /** @type {(_: number) => (_: number) => number} */ a => b => a + b,
  mul: /** @type {(_: number) => (_: number) => number} */ a => b => a * b,
}

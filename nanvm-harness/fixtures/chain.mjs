// A chain of calls and reads: each step over the whole value before it.
/** @type {(...a: readonly unknown[]) => { readonly h: (...b: readonly unknown[]) => readonly unknown[] }} */
const g = (...a) => ({ h: (...b) => b });
const o = { g: g };
export default [o.g(1).h(2, 3), o.g(4).h().length];

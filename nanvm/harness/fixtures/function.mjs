/** No-argument function exports, including distinct undefined-returning closures. */
export const noop = () => undefined;
export const repeated = noop;
export const other = () => undefined;
export const make = () => () => undefined;
export default () => 42;

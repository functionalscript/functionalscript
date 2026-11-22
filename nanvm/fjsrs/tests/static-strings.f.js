const x = /** @type {const} */ ('very long string')
const f = () => x + x
export const same = () => Object.is(x, 'very long string')
const wide = /** @type {const} */ (0x1_0000_0000_0000_0002n)
export const integers = () => [0n, -1n, wide, wide]
export const defaultKey = () => ({ default: 'default' }).default

export const first = /** @type {const} */ ([])
export const alias = first
export const second = /** @type {const} */ ([])
export const fresh = () => []
export const mixed = /** @type {const} */ ([1, 'very long string', wide])
export const record = /** @type {const} */ ({ name: 'very long string', count: wide })
export const recordAlias = record
export const emptyObject = () => ({})
export const left = /** @type {const} */ ({})
export const right = /** @type {const} */ ({})
/** @type {(x: unknown) => unknown} */
export const id = x => x
export const idAlias = id
export const capturedId = () => idAlias
export const capturedWrapper = () => capturedId
/** @type {() => (x: unknown) => unknown} */
export const make = () => x => x
/** @type {() => (x: unknown) => boolean} */
export const makeBoolean = () => x => Boolean(x)
export default () => f()

const x = 'very long string'
const f = () => x + x
export const same = () => Object.is(x, 'very long string')
const wide = 0x1_0000_0000_0000_0002n
export const integers = () => [0n, -1n, wide, wide]
export default () => f()

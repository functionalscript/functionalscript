const x = 'very long string'
const f = () => x + x
export const same = () => Object.is(x, 'very long string')
export default () => f()

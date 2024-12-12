import * as _ from './module.f.mjs'
const { unsafeCmp } = _

export default () => {
    const result = unsafeCmp(true)(false)
    if (result !== 1) { throw result }
}

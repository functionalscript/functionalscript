import * as _ from './module.f.ts'
const { unsafeCmp } = _

export default () => {
    const result = unsafeCmp(true)(false)
    if (result !== 1) { throw result }
}

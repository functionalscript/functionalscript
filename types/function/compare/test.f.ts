import { unsafeCmp } from './module.f.ts'

export default () => {
    const result = unsafeCmp(true)(false)
    if (result !== 1) { throw result }
}

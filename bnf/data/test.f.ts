import { classic, deterministic } from '../testlib.f.ts'
import { toData } from './module.f.ts'

export default {
    toData: () => {
        const c = toData(classic())
        const d = toData(deterministic())
    }
}

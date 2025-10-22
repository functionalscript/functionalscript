import { classic, deterministic } from './testlib.f.ts'

export default {
    test: () => {
        classic()
        deterministic()
    }
}

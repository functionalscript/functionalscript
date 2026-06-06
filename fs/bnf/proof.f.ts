import { classic, deterministic } from './testlib.f.ts'

export const proof = {
    test: () => {
        classic()
        deterministic()
    }
}

import { patriciaTrie, type Create, type State } from '../../../patricia_trie/module.f.ts'
import { compress } from '../../hash/module.f.ts'

export type Add<S> = (left: bigint, right: bigint, merged: bigint, storage: S) => S

export type EncodeState<S> = State<S, bigint>

export const encode = <S>(add: Add<S>) => {
    const create: Create<S, bigint> = (a, b, s) => {
        const m = compress(a, b)
        return [m, add(a, b, m, s)]
    }
    const { push, end } = patriciaTrie(create)
    return (symbol: bigint, state: EncodeState<S>): readonly[bigint|undefined, EncodeState<S>] => {
        const [, stack] = state
        const last = stack.at(-1)
        if (last === undefined || last[0] > symbol) {
            return [undefined, push([symbol, symbol], state)]
        }
        const [root1, storage1] = end(state)
        const [root2, storage2] = create(root1!, symbol, storage1)
        return [root2, [storage2, []]]
    }
}

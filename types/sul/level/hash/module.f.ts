import { todo } from '../../../../dev/module.f.ts'
import type { State } from '../../../patricia_trie/module.f.ts'

export type EncodeState<S> = State<S, bigint>

export const encode = <S>(symbol: bigint, state: EncodeState<S>): readonly[bigint|undefined, EncodeState<S>] => {
    return todo()
}

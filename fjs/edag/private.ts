/**
 * Private schema-builder types; the public grammar remains in `types.ts`.
 *
 * @module
 */

import type { Type, Array as RttiArray, Number as RttiNumber, String as RttiString } from '../rtti/types.ts'
import type { Phantom } from '../types/phantom/types.ts'
import type { OptionLambda, OptionPropertyLambda } from './types.ts'

type Items<E extends Type> = () => readonly ['or', E, readonly ['...', E]]
type Args<E extends Type> = RttiArray<Items<E>>
type Index<E extends Type> = () => readonly ['or', readonly ['Number', E], RttiString, RttiNumber]

export type _OptionLambdaSchema<E extends Type> = () => readonly ['or',
    readonly ['|()', Args<E>],
    readonly ['|()', Args<E>, Phantom<_OptionLambdaSchema<E>, OptionLambda>],
    readonly ['|.', Index<E>],
    readonly ['|.', Index<E>, Phantom<_OptionPropertyLambdaSchema<E>, OptionPropertyLambda>],
]

export type _OptionPropertyLambdaSchema<E extends Type> = () => readonly ['or',
    readonly ['|()', Args<E>],
    readonly ['|()', Args<E>, Phantom<_OptionLambdaSchema<E>, OptionLambda>],
    readonly ['|.', Index<E>],
    readonly ['|.', Index<E>, Phantom<_OptionPropertyLambdaSchema<E>, OptionPropertyLambda>],
    readonly ['|?.()', Args<E>],
    readonly ['|?.()', Args<E>, Phantom<_OptionLambdaSchema<E>, OptionLambda>],
    readonly ['|!()', Args<E>],
]

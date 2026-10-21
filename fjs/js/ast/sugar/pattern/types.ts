/** Source pattern planning, independently of source admission policy. @module */

import type { Result } from '../../../../types/result/types.ts'
import type { ParseError } from '../../../../compiler/parser/types.ts'
import type { DjsTokenWithMetadata } from '../../../../compiler/tokenizer/types.ts'
import type { StaticId } from '../../../../edag/types.ts'
import type { ExpansionPlan } from '../source.ts'

/** Tokens and declaration names remain available to the source admission owner. */
export type PatternPlan = ExpansionPlan & {
    readonly names: readonly (readonly [DjsTokenWithMetadata, number])[]
    readonly metadata: DjsTokenWithMetadata['metadata']
}

/** Syntax structure belongs here; source name/key legality remains with the parser. */
export type Policy = {
    readonly name: (token: DjsTokenWithMetadata) => Result<string, ParseError>
    readonly key: (token: DjsTokenWithMetadata) => Result<string | number, ParseError>
    readonly namespaceMember: (namespace: DjsTokenWithMetadata, key: DjsTokenWithMetadata) => Result<readonly [StaticId], ParseError>
    readonly refused: (reason: 'invalid' | 'rest' | 'computed' | 'duplicate', token: DjsTokenWithMetadata) => ParseError
}

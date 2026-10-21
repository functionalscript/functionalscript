/** Resolution state. Source identities remain lexical until sugar normalizes them. */
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { BindingId, BindingScope, FunctionTarget, Item, Entry, Key, Step, _Access, _Call, _Conditional, _Binary, _Unary, _InstanceOf, _Comma, _Array, _Object } from '../../js/ast/types.ts'
import type { SourceValue, SourceParameter, SourceStatement, SourceBlock, SourceCase } from '../../js/ast/sugar/source.ts'
import type { PatternPlan } from '../../js/ast/sugar/pattern/types.ts'
import type { StaticId, IntrinsicId } from '../../edag/types.ts'
import type { BinaryTag, UnaryTag } from '../ast/types.ts'
import type { ModuleTokenWithMetadata } from '../tokenizer/types.ts'
import type { BindingOrigin, ParseError } from './types.ts'
import type { BindingElement, BindingProperty, BindingTarget, Block, Chain, Container, If, Item as SyntaxItem, Key as SyntaxKey, Let, LoopBlock, Node, Switch, While } from './syntax/types.ts'

export type ValueItem = Item<SourceValue>
export type ValueEntry = Entry<SourceValue>
export type ValueMember = readonly [':', SourceValue, SourceValue]
export type ValueKey = Key<SourceValue>
export type ValueStep = Step<SourceValue>
export type ValueSpread = readonly ['...', SourceValue]
export type ValueStatic = readonly [StaticId]
export type ValueEntryFunction = readonly ['entry']
export type ValueHasEntryFunction = readonly ['hasEntry']
export type ValueIntrinsic = readonly [IntrinsicId]
export type ValueAccess = _Access<SourceValue>
export type ValueCall = _Call<SourceValue>
export type ValueConditional = _Conditional<SourceValue>
export type ValueBinary = _Binary<SourceValue>
export type ValueUnary = _Unary<SourceValue>
export type ValueInstanceOf = _InstanceOf<SourceValue>
export type ValueComma = _Comma<SourceValue>
export type ValueArray = _Array<SourceValue>
export type ValueObject = _Object<SourceValue>

/** Remembering reads through a scope preserves the existing shadowing admission. */
export type _Ref = { readonly id: BindingId; readonly kind: 'own' | 'capture' | 'self' }
export type _Env = OrderedMap<_Ref>
export type _Plan = PatternPlan

export type _Scope = {
    readonly names: _Env
    readonly origins: OrderedMap<BindingId>
    readonly trace: BindingScope
    readonly sourceOrigins: readonly BindingOrigin[]
    readonly region: boolean
    readonly count: number
    readonly parameters: readonly SourceParameter[]
    readonly rest: _Plan | null
    readonly enclosing: List<_Env>
    readonly outer: _Scope | null
    readonly self: string | null
    readonly selfBinding: BindingId | null
    readonly loop: string | null
    readonly loopReads: readonly (readonly [word: string, refusal: ParseError])[]
}
export type _Counted<T> = { readonly index: number; readonly done: List<T> }
export type _ContainerFrame = _Counted<ValueItem | ValueMember> & { readonly container: Container; readonly key: readonly [SourceValue] | null }
export type _CallFrame = _Counted<ValueItem> & { readonly call: readonly ['()', Node, readonly SyntaxItem[]] }
export type _AccessFrame = { readonly key: SyntaxKey; readonly method: boolean }
export type _IndexFrame = { readonly indexed: SourceValue }
export type _ChainPart = { readonly value: Node } | { readonly key: SyntaxKey, readonly method: boolean }
export type _ChainFrame = _Counted<SourceValue> & { readonly chain: Chain; readonly parts: readonly _ChainPart[] }
export type _FunctionFrame = { readonly function: true }
export type _Late = { readonly plan: _Plan; readonly init: Node | null; readonly rest: boolean }
export type _Bound = {
    readonly names: _Env
    readonly count: number
    readonly parameters: readonly SourceParameter[]
    readonly rest: _Plan | null
    readonly late: readonly _Late[]
    readonly origins: OrderedMap<BindingId>
    readonly bindings: readonly BindingId[]
    readonly sourceOrigins: readonly BindingOrigin[]
    readonly initialized: readonly BindingId[]
}
export type _LateFrame = { readonly late: readonly _Late[]; readonly index: number; readonly body: Node }
export type _BodyFrame = _Counted<SourceStatement> & { readonly statements: Block[1]; readonly first: number; readonly plan: _Plan | null }
export type _LetFrame = { readonly let: Let; readonly body: _BodyFrame; readonly word: string; readonly binding: BindingId }
export type _LoopFrame = { readonly loop: While; readonly body: _BodyFrame; readonly word: string; readonly binding: BindingId; readonly condition: readonly [SourceValue] | null }
export type _LoopBodyFrame = _Counted<SourceStatement> & { readonly block: LoopBlock[1]; readonly word: string; readonly plan: _Plan | null }
export type _GuardFrame = { readonly guard: If; readonly body: _BodyFrame; readonly condition: SourceValue; readonly then: SourceBlock | null }
export type _SwitchFrame = { readonly switch: Switch; readonly body: _BodyFrame; readonly discriminant: SourceValue; readonly index: number; readonly label: number; readonly labels: readonly SourceValue[]; readonly arms: List<SourceCase> }
export type _UnaryFrame = { readonly unary: UnaryTag }
export type _InstanceOfFrame = { readonly instanceof: Node; readonly at: ModuleTokenWithMetadata }
export type _BinaryLeftFrame = { readonly tag: BinaryTag; readonly right: Node }
export type _BinaryRightFrame = { readonly tag: BinaryTag; readonly left: SourceValue }
export type _ConditionalFrame = _Counted<SourceValue> & { readonly conditional: readonly ['?:', Node, Node, Node] }
export type _CommaFrame = _Counted<SourceValue> & { readonly comma: readonly Node[] }
export type _Frame = _ContainerFrame | _CallFrame | _AccessFrame | _IndexFrame | _ChainFrame | _UnaryFrame | _InstanceOfFrame | _BinaryLeftFrame | _BinaryRightFrame | _ConditionalFrame | _CommaFrame | _FunctionFrame | _LateFrame | _BodyFrame | _GuardFrame | _SwitchFrame | _LetFrame | _LoopFrame | _LoopBodyFrame
export type _Stack = { readonly top: _Frame; readonly rest: _Stack } | null
export type _Step = readonly ['enter', Node] | readonly ['define', Node, readonly [string, BindingId]] | Result<SourceValue, ParseError>
export type _State = readonly [stack: _Stack, scope: _Scope, step: _Step]
export type _Evaluated = { readonly value: SourceValue; readonly scope: _Scope }

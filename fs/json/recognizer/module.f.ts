/**
 * A payload-free, O(depth) streaming JSON validity recognizer.
 *
 * `parse` (`../parser/module.f.ts`) answers "what value is this?" and pays for
 * it: O(n) for the value tree, plus the shared `fs/js` tokenizer's O(token
 * length) payload buffers for strings and numbers. This module answers the
 * cheaper question — "is this stream a complete, valid JSON document?" — with
 * neither cost. It never stores token text, only which lexical sub-state a
 * token scan is in (e.g. "inside a string escape", "after the exponent sign"),
 * and it never stores a value tree, only a stack of the enclosing containers'
 * resume states. Space is O(nesting depth), optionally bounded by a max-depth
 * cap for use as a DoS guard.
 *
 * The recognizer is driven one Unicode code point at a time via `recognizerStep`
 * — it does not consume `fs/json/tokenizer`'s `JsonToken`s, so it can be fed
 * directly from a decoder (e.g. `fs/text/utf8`) without materializing a token
 * list. It implements the same grammar as `../parser/module.f.ts`, including
 * strict RFC 8259 rules the parser inherits from the shared tokenizer: no
 * trailing commas, no bare leading zeros, a required digit after `.`/`e`/`E`,
 * and no unescaped control characters (U+0000-U+001F) inside strings.
 *
 * @module
 */

/** A container frame: an object or an array. */
type Frame = '{' | '['

/**
 * The recognizer's control status — which grammar position it is at, mirroring
 * `StateParse['status']` in `../parser/module.f.ts` one for one, plus the two
 * terminal statuses `parse` represents with a different state shape
 * (`'done'` for `'result'`, `'error'` for `'error'`).
 */
type Status = |
    '' | 'done' | 'error' |
    '[' | '[v' | '[,' |
    '{' | '{k' | '{:' | '{v' | '{,'

/** The stack of enclosing containers' resume statuses. O(nesting depth). */
type Stack = null | { readonly first: Status, readonly tail: Stack }

type StringSub = 'in' | 'esc' | 'u1' | 'u2' | 'u3' | 'u4'

type NumberPhase = |
    // no digit consumed yet after a leading `-`
    'sign' |
    // the single leading `0`: no further integer digits may follow
    'zero' |
    // one or more leading `1`-`9` digits: more digits may follow
    'int' |
    // just consumed `.`: a fraction digit is required
    'dot' |
    // one or more fraction digits: more digits may follow
    'frac' |
    // just consumed `e`/`E`: a sign or digit is required
    'expStart' |
    // just consumed the exponent sign: a digit is required
    'expSign' |
    // one or more exponent digits: more digits may follow
    'exp'

type LiteralWord = 'true' | 'false' | 'null'

/**
 * The lexical sub-state. `'value'` means "not mid-token" — the next code point
 * is dispatched against the container `Status`. Every other tag is mid-token:
 * incoming code points are consumed by the token's own step function instead,
 * until the token completes (or the stream proves it can never complete).
 *
 * `done` is the container `Status` to resume once the in-progress token
 * completes — precomputed at token start so completion never needs to
 * re-derive "value" vs. "object key" position.
 */
type Scan = |
    { readonly kind: 'value' } |
    { readonly kind: 'string', readonly sub: StringSub, readonly done: Status } |
    { readonly kind: 'number', readonly phase: NumberPhase, readonly done: Status } |
    { readonly kind: 'literal', readonly word: LiteralWord, readonly pos: number, readonly done: Status }

/** The recognizer's full state: lexical sub-state × container status × depth. */
export type JsonRecognizerState = {
    readonly scan: Scan
    readonly container: { readonly status: Status, readonly stack: Stack }
    readonly depth: number
    readonly maxDepth: number | null
}

const errorState = (s: JsonRecognizerState): JsonRecognizerState =>
    ({ scan: { kind: 'value' }, container: { status: 'error', stack: null }, depth: s.depth, maxDepth: s.maxDepth })

/** The initial recognizer state, with no depth cap. */
export const recognizerInit: JsonRecognizerState = {
    scan: { kind: 'value' },
    container: { status: '', stack: null },
    depth: 0,
    maxDepth: null,
}

/**
 * The initial recognizer state with a max-depth cap: a document nesting deeper
 * than `maxDepth` containers is rejected, even if it would otherwise be valid.
 * Use this as a DoS guard against unbounded-depth input.
 */
export const recognizerInitWithMaxDepth = (maxDepth: number): JsonRecognizerState =>
    ({ ...recognizerInit, maxDepth })

const isDigit = (cp: number): boolean => cp >= 0x30 && cp <= 0x39

const isHexDigit = (cp: number): boolean =>
    isDigit(cp) || (cp >= 0x41 && cp <= 0x46) || (cp >= 0x61 && cp <= 0x66)

/** JSON whitespace: space, tab, LF, CR (RFC 8259 §2). */
export const isJsonWhitespace = (cp: number): boolean =>
    cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d

// The status a value-expecting position becomes once its value is supplied.
// Only ever invoked from `''`/`'['`/`'[,'`/`'{:'` — the four value positions.
const afterValue = (status: Status): Status => {
    switch (status) {
        case '': return 'done'
        case '[': case '[,': return '[v'
        case '{:': return '{v'
        default: return 'error'
    }
}

// The status an object-key position becomes once its key string is supplied.
// Only ever invoked from `'{'`/`'{,'` — the two key positions.
const afterKey = (status: Status): Status => {
    switch (status) {
        case '{': case '{,': return '{k'
        default: return 'error'
    }
}

const startString
    : (status: Status, stack: Stack, depth: number, maxDepth: number | null, done: Status) => JsonRecognizerState
    = (status, stack, depth, maxDepth, done) =>
        ({ scan: { kind: 'string', sub: 'in', done }, container: { status, stack }, depth, maxDepth })

const startNumber
    : (status: Status, stack: Stack, depth: number, maxDepth: number | null, phase: NumberPhase, done: Status) => JsonRecognizerState
    = (status, stack, depth, maxDepth, phase, done) =>
        ({ scan: { kind: 'number', phase, done }, container: { status, stack }, depth, maxDepth })

const startLiteral
    : (word: LiteralWord, status: Status, stack: Stack, depth: number, maxDepth: number | null, done: Status) => JsonRecognizerState
    = (word, status, stack, depth, maxDepth, done) =>
        ({ scan: { kind: 'literal', word, pos: 1, done }, container: { status, stack }, depth, maxDepth })

const openContainer
    : (frame: Frame, status: Status, stack: Stack, depth: number, maxDepth: number | null) => JsonRecognizerState
    = (frame, status, stack, depth, maxDepth) => {
        const newDepth = depth + 1
        if (maxDepth !== null && newDepth > maxDepth) {
            return { scan: { kind: 'value' }, container: { status: 'error', stack: null }, depth, maxDepth }
        }
        const resume = afterValue(status)
        return {
            scan: { kind: 'value' },
            container: { status: frame, stack: { first: resume, tail: stack } },
            depth: newDepth,
            maxDepth,
        }
    }

const closeContainer
    : (stack: Stack, depth: number, maxDepth: number | null) => JsonRecognizerState
    = (stack, depth, maxDepth) => {
        if (stack === null) {
            return { scan: { kind: 'value' }, container: { status: 'error', stack: null }, depth, maxDepth }
        }
        return { scan: { kind: 'value' }, container: { status: stack.first, stack: stack.tail }, depth: depth - 1, maxDepth }
    }

// Dispatches a code point against a value-expecting position (`''`, `'['`,
// `'[,'`, `'{:'`). `'['` additionally accepts an immediate `]` (empty array).
const startValue
    : (status: Status, stack: Stack, depth: number, maxDepth: number | null, cp: number) => JsonRecognizerState
    = (status, stack, depth, maxDepth, cp) => {
        if (status === '[' && cp === 0x5d) { return closeContainer(stack, depth, maxDepth) }
        if (cp === 0x7b) { return openContainer('{', status, stack, depth, maxDepth) }
        if (cp === 0x5b) { return openContainer('[', status, stack, depth, maxDepth) }
        if (cp === 0x22) { return startString(status, stack, depth, maxDepth, afterValue(status)) }
        if (cp === 0x2d) { return startNumber(status, stack, depth, maxDepth, 'sign', afterValue(status)) }
        if (cp === 0x30) { return startNumber(status, stack, depth, maxDepth, 'zero', afterValue(status)) }
        if (isDigit(cp)) { return startNumber(status, stack, depth, maxDepth, 'int', afterValue(status)) }
        if (cp === 0x74) { return startLiteral('true', status, stack, depth, maxDepth, afterValue(status)) }
        if (cp === 0x66) { return startLiteral('false', status, stack, depth, maxDepth, afterValue(status)) }
        if (cp === 0x6e) { return startLiteral('null', status, stack, depth, maxDepth, afterValue(status)) }
        return { scan: { kind: 'value' }, container: { status: 'error', stack: null }, depth, maxDepth }
    }

const dispatchContainer = (s: JsonRecognizerState, cp: number): JsonRecognizerState => {
    const { status, stack } = s.container
    const { depth, maxDepth } = s
    if (isJsonWhitespace(cp)) { return s }
    switch (status) {
        case 'error': return s
        case 'done': return errorState(s)
        case '': case '[': case '[,': case '{:':
            return startValue(status, stack, depth, maxDepth, cp)
        case '{': case '{,':
            if (cp === 0x22) { return startString(status, stack, depth, maxDepth, afterKey(status)) }
            if (status === '{' && cp === 0x7d) { return closeContainer(stack, depth, maxDepth) }
            return errorState(s)
        case '{k':
            if (cp === 0x3a) { return { scan: { kind: 'value' }, container: { status: '{:', stack }, depth, maxDepth } }
            return errorState(s)
        case '{v':
            if (cp === 0x2c) { return { scan: { kind: 'value' }, container: { status: '{,', stack }, depth, maxDepth } }
            if (cp === 0x7d) { return closeContainer(stack, depth, maxDepth) }
            return errorState(s)
        case '[v':
            if (cp === 0x2c) { return { scan: { kind: 'value' }, container: { status: '[,', stack }, depth, maxDepth } }
            if (cp === 0x5d) { return closeContainer(stack, depth, maxDepth) }
            return errorState(s)
    }
}

const stepString = (s: JsonRecognizerState, scan: { readonly sub: StringSub, readonly done: Status }, cp: number): JsonRecognizerState => {
    const { sub, done } = scan
    switch (sub) {
        case 'in':
            if (cp === 0x22) { return { scan: { kind: 'value' }, container: { status: done, stack: s.container.stack }, depth: s.depth, maxDepth: s.maxDepth } }
            if (cp === 0x5c) { return { ...s, scan: { kind: 'string', sub: 'esc', done } } }
            if (cp <= 0x1f) { return errorState(s) }
            return s
        case 'esc':
            if (cp === 0x22 || cp === 0x5c || cp === 0x2f || cp === 0x62 || cp === 0x66 ||
                cp === 0x6e || cp === 0x72 || cp === 0x74) {
                return { ...s, scan: { kind: 'string', sub: 'in', done } }
            }
            if (cp === 0x75) { return { ...s, scan: { kind: 'string', sub: 'u1', done } } }
            return errorState(s)
        case 'u1': case 'u2': case 'u3': case 'u4': {
            if (!isHexDigit(cp)) { return errorState(s) }
            const next: StringSub = sub === 'u1' ? 'u2' : sub === 'u2' ? 'u3' : sub === 'u3' ? 'u4' : 'in'
            return { ...s, scan: { kind: 'string', sub: next, done } }
        }
    }
}

const stepLiteral
    : (s: JsonRecognizerState, scan: { readonly word: LiteralWord, readonly pos: number, readonly done: Status }, cp: number) => JsonRecognizerState
    = (s, scan, cp) => {
        const { word, pos, done } = scan
        if (cp !== word.charCodeAt(pos)) { return errorState(s) }
        if (pos + 1 === word.length) {
            return { scan: { kind: 'value' }, container: { status: done, stack: s.container.stack }, depth: s.depth, maxDepth: s.maxDepth }
        }
        return { ...s, scan: { kind: 'literal', word, pos: pos + 1, done } }
    }

// Finalizes an accepting mid-number state and re-dispatches `cp` — the code
// point that proved the number was over — against the resumed container
// status. Numbers have no terminator character of their own.
const finishNumber = (s: JsonRecognizerState, done: Status, cp: number): JsonRecognizerState => {
    const resumed: JsonRecognizerState =
        { scan: { kind: 'value' }, container: { status: done, stack: s.container.stack }, depth: s.depth, maxDepth: s.maxDepth }
    return dispatchContainer(resumed, cp)
}

const stepNumber
    : (s: JsonRecognizerState, scan: { readonly phase: NumberPhase, readonly done: Status }, cp: number) => JsonRecognizerState
    = (s, scan, cp) => {
        const { phase, done } = scan
        const digit = isDigit(cp)
        const to = (phase: NumberPhase): JsonRecognizerState => ({ ...s, scan: { kind: 'number', phase, done } })
        switch (phase) {
            case 'sign':
                if (cp === 0x30) { return to('zero') }
                if (digit) { return to('int') }
                return errorState(s)
            case 'zero':
                if (digit) { return errorState(s) }
                if (cp === 0x2e) { return to('dot') }
                if (cp === 0x65 || cp === 0x45) { return to('expStart') }
                return finishNumber(s, done, cp)
            case 'int':
                if (digit) { return s }
                if (cp === 0x2e) { return to('dot') }
                if (cp === 0x65 || cp === 0x45) { return to('expStart') }
                return finishNumber(s, done, cp)
            case 'dot':
                if (digit) { return to('frac') }
                return errorState(s)
            case 'frac':
                if (digit) { return s }
                if (cp === 0x65 || cp === 0x45) { return to('expStart') }
                return finishNumber(s, done, cp)
            case 'expStart':
                if (cp === 0x2b || cp === 0x2d) { return to('expSign') }
                if (digit) { return to('exp') }
                return errorState(s)
            case 'expSign':
                if (digit) { return to('exp') }
                return errorState(s)
            case 'exp':
                if (digit) { return s }
                return finishNumber(s, done, cp)
        }
    }

/**
 * Advances the recognizer by one Unicode code point. Once the state is
 * rejected (`'error'`), it is absorbing — further code points do not change
 * the verdict.
 */
export const recognizerStep = (s: JsonRecognizerState, cp: number): JsonRecognizerState => {
    if (s.container.status === 'error') { return s }
    switch (s.scan.kind) {
        case 'value': return dispatchContainer(s, cp)
        case 'string': return stepString(s, s.scan, cp)
        case 'number': return stepNumber(s, s.scan, cp)
        case 'literal': return stepLiteral(s, s.scan, cp)
    }
}

const numberAccepts = (phase: NumberPhase): boolean =>
    phase === 'zero' || phase === 'int' || phase === 'frac' || phase === 'exp'

/**
 * Whether the code points fed so far form a complete, valid JSON document.
 * A mid-token state (string, literal) never accepts; a mid-number state
 * accepts only in a phase where the number itself is already complete
 * (e.g. `1`, `1.5`, `1e5`, but not `1.` or `1e`) *and* completing it would
 * finish the whole document (no unclosed container, no pending key/value).
 */
export const recognizerAccepts = (s: JsonRecognizerState): boolean => {
    switch (s.scan.kind) {
        case 'value': return s.container.status === 'done'
        case 'number': return numberAccepts(s.scan.phase) && s.scan.done === 'done'
        default: return false
    }
}

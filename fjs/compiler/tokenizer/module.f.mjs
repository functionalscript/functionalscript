/**
 * The module tokenizer: the JavaScript token stream of
 * [`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs), folded once more.
 *
 * ```text
 * code points ==fjs/js/tokenizer: the grammar, then its fold==> JsToken stream
 *             ==fold: keywords demoted, trivia dropped, newlines marked==> ModuleToken stream
 * ```
 *
 * The grammar is [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs) and
 * the tokens are its too, `fjs/ebnf/lib/js/types.ts`; the two layers below
 * this one — the grammar read one token at a time, and the fold that
 * merges trivia, classifies words and checks the number boundary — are
 * the JavaScript tokenizer's, shared with every other reader of JavaScript
 * text. What this layer adds is the language's: every keyword is demoted
 * to an identifier but the literals — `true`, `false`, `null`,
 * `undefined`, `NaN`, `Infinity` — which stay reserved, since a key or the
 * name after `.` may be any word and the parser refuses a keyword where
 * JavaScript wants an identifier; and every operator but the four a
 * function is written with — `(`, `)`, `...`, `=>` — `-`, Stage A's
 * arithmetic, strict-comparison and bitwise operators, Stage B's lazy
 * ones with the conditional's `?`
 * ([`spec/operators/README.md`](../../../spec/operators/README.md))
 * and the optional step's `?.`
 * ([`spec/todo/2335-optional-chaining.md`](../../../spec/todo/2335-optional-chaining.md))
 * is an error, since the language has no other.
 *
 * Trivia — whitespace, newlines and comments — is not in this stream: what
 * a rule of the language reads of it is whether a newline stands before
 * a token, and each token carries that answer, `newline` in
 * `ModuleTokenWithMetadata` (`./types.ts`), which is the one state this
 * layer holds. The parser asks it where a statement is written without
 * its `;`, and where JavaScript forbids a line break, before `=>` and
 * after `return`. An operator is a token
 * like any other and the grammar reads it, so that `-1 .x` and `-1()` are
 * the negation of the access and of the call, as JavaScript reads them,
 * rather than an access and a call on a negative literal — recognized is
 * not accepted, and the same is true of every operator token
 * `fjs/js/tokenizer` already carries that this layer does not admit, `==`,
 * `--` among them. The four template chunk kinds keep their cooked
 * text, but only when their exact `source` spelling uses the accepted
 * escape subset.
 * Deferred spellings remain located errors even when their cooked value
 * could also have been written with admitted escapes.
 *
 * @module
 *
 * @import { JsToken, JsTokenWithMetadata } from '../../ebnf/lib/js/types.ts'
 * @import { StateScan } from '../../types/function/operator/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { ModuleToken, ModuleTokenWithMetadata } from './types.ts'
 */
import { tokenize as tokenizeJs } from '../../js/tokenizer/module.f.mjs'
import { isTrivia } from '../../ebnf/lib/js/module.f.mjs'
import { isKeyword } from '../../js/keywords/module.f.js'
import { escapeToCodePoint } from '../../js/string_escape/module.f.mjs'
import { flat, stateScan } from '../../types/list/module.f.js'
import { hasEntry } from '../../types/object/entry/module.f.js'

// -- layer 3: the ModuleToken stream -------------------------------------------

/**
 * Every `ModuleToken` kind, `eof` included: the kinds a `JsToken` keeps
 * on its way to the module's stream, plus the contextual `postfixIncrement`
 * marker. Pinned to `ModuleToken['kind']` in
 * `./types.ts`, so a kind added there and forgotten here breaks the build
 * rather than becoming an invalid-token error at run time. The parser's
 * alphabet is this list less `eof`.
 *
 * Exported with a leading `_` for that linkage — the export is not API.
 */
export const _moduleTokenKinds = /** @type {const} */ ([
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    '{', '}', ':', ',', '[', ']', '.', '=', ';', '(', ')', '=>', '...', '-',
    '+', '++', 'postfixIncrement', '*', '/', '%', '**',
    '===', '!==', '>', '>=', '<', '<=',
    '&', '|', '^', '~', '<<', '>>', '>>>',
    '!', '&&', '||', '??', '?', '?.',
    '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '^=', '|=',
    '&&=', '||=', '??=',
    'string', 'number', 'error', 'id', 'bigint',
    'noSubstitutionTemplate', 'templateHead', 'templateMiddle', 'templateTail',
    'eof',
])

/** @type {ReadonlySet<string>} */
const moduleTokenKindSet = new Set(_moduleTokenKinds)

/**
 * Whether a lexically valid JS template chunk uses FJS's spelling subset.
 * The shared lexer already validates escape digits and chunk boundaries, so
 * this only checks the policy: JSON escapes, escaped backticks and escaped
 * `${`, with raw CR/LF but no other C0 controls. Checking source preserves
 * the difference between `A` and `\x41` after both have cooked to `A`.
 *
 * @type {(source: string) => boolean}
 */
const templateSourceAccepted = source => {
    let escaped = false
    for (let i = 0; i < source.length; i++) {
        const character = source[i]
        const cp = source.charCodeAt(i)
        if (escaped) {
            const admitted = character === 'u' ? source[i + 1] !== '{'
                : character === '$' ? source[i + 1] === '{'
                : escapeToCodePoint(cp) !== null || character === '`'
            if (!admitted) { return false }
            escaped = false
        } else if (character === '\\') {
            escaped = true
        } else if (cp < 0x20 && cp !== 0xa && cp !== 0xd) {
            return false
        }
    }
    return true
}

/**
 * A JavaScript token as a module token: kept when its kind is one of
 * {@link _moduleTokenKinds} — the cast is that membership, which `Set#has`
 * cannot state as a narrowing — an `id` when it is any other keyword, and
 * an error otherwise: an operator or template spelling the language does
 * not admit. Template provenance is checked before the membership test.
 *
 * @type {(input: JsToken) => ModuleToken}
 */
const toModuleToken = input =>
    hasEntry(input, 'source') && !templateSourceAccepted(input.source) ? { kind: 'error', message: 'invalid token' }
    : moduleTokenKindSet.has(input.kind) ? /** @type {ModuleToken} */ (input)
    : isKeyword(input.kind) ? { kind: 'id', value: input.kind }
    : { kind: 'error', message: 'invalid token' }

/**
 * One JavaScript token as the stream has it: nothing, for trivia, which
 * the stream leaves out, and otherwise the token with the metadata it
 * came with and whether a newline precedes it. The state is that answer
 * for the next token: `true` after an `nl` — the trivia run holding a
 * newline, and the one the JavaScript tokenizer puts after a block
 * comment holding one — carried across any further trivia, and `false`
 * after any other token.
 *
 * An increment after an identifier on the same line is marked as postfix.
 * This distinguishes it from a following prefix statement in the LL(1) grammar.
 * @type {StateScan<JsTokenWithMetadata, { readonly newline: boolean; readonly identifier: boolean }, List<ModuleTokenWithMetadata>>}
 */
const withNewline = ({ token, metadata }, state) => {
    const trivia = isTrivia(token.kind)
    const postfix = token.kind === '++' && state.identifier && !state.newline
    return [
        trivia ? null : [{ token: postfix ? { kind: 'postfixIncrement' } : toModuleToken(token), metadata, newline: state.newline }],
        { newline: token.kind === 'nl' || (state.newline && trivia), identifier: trivia ? state.identifier : token.kind === 'id' || isKeyword(token.kind) },
    ]
}

/** @type {(input: List<number>) => (path: string) => List<ModuleTokenWithMetadata>} */
export const tokenize = input => path => flat(stateScan(withNewline)({ newline: false, identifier: false })(tokenizeJs(input)(path)))

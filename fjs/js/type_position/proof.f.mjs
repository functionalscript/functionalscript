import { assertEq } from '../../asserts/module.f.js'
import { tokenize } from '../tokenizer/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { typePositions } from './module.f.mjs'

/**
 * The names `text` sets where a type stands, in order, joined by a space.
 *
 * @type {(text: string) => string}
 */
const typed = text => {
    const tokens = toArray(tokenize(toArray(stringToCodePointList(text)))('')).map(({ token }) => token)
    const positions = typePositions(tokens)
    return tokens.flatMap((t, i) => positions[i] && t.kind === 'id' ? [t.value] : []).join(' ')
}

export const proof = {
    // A declaration's annotation, to its `=`; the value after it is none.
    declaration: () => assertEq(typed('const x: string = number'), 'string'),
    // A `,` declares again; a destructured name is annotated too.
    declarations: () => assertEq(typed('let a: A = 1, b: B; var { c }: C = d, [e]: E = f'), 'A B C E'),
    // An object literal, a call, an import: values all.
    values: () => assertEq(typed('const s = { a: or(option, number) }; import { string } from "m"'), ''),
    // A ternary's `:` is no annotation, in a statement or in parentheses.
    ternary: () => assertEq(typed('const y = c ? (number) : string; x ? a : b'), ''),
    // An alias's right side, its parameters and their defaults.
    alias: () => assertEq(typed('type A<T extends string = never> = T | number'), 'T string never T number'),
    // A `type X` with no `=` ends at its line, unless its parameters are open.
    aliasWithoutAValue: () => {
        assertEq(typed('type A\nconst x = number'), '')
        assertEq(typed('type B<\n  T> = string'), 'T string')
    },
    // A line that opens with `|`, `&`, `?`, `:`, `=>` or `extends` goes on
    // with the type; any other line ends it.
    lines: () => {
        assertEq(typed('type A =\n  | string\n  & number\nconst b = c'), 'string number')
        assertEq(typed('type C = D\n  extends E\n  ? F\n  : G'), 'D E F G')
        assertEq(typed('type H = (a: I)\n  => J'), 'I J')
    },
    // A member's, a parameter's, a method's and a mapped key's name, a name
    // after `.`, the value `typeof` reads and a type operator are no types.
    names: () => assertEq(
        typed('type A = { readonly a?: B, m(x: C): D, [k: E]: F, [K in G]: H, i: typeof v, j: N.O, p: (q: R) => q is S }'),
        'B C D E F G H N R S'),
    // A conditional's branches are types, its `:` no member's.
    conditional: () => assertEq(typed('type A = { a: B extends string ? C : never, d?: E }'), 'B string C never E'),
    // An interface's header and body.
    interface: () => assertEq(typed('interface I extends Base<string> { n: number }'), 'Base string number'),
    // A list certain to be parameters: after `function`, before `=>`, before
    // a method's `{`, or before a return type and then `=>`.
    parameters: () => {
        assertEq(typed('function g(s: A): B { return s }'), 'A B')
        assertEq(typed('const h = function (s: A) {}'), 'A')
        assertEq(typed('const f = (a: A, b = c ? d : e): B => a'), 'A B')
        assertEq(typed('const o = { m(a: A) {} }'), 'A')
        assertEq(typed('const k = (a: A): B => a'), 'A B')
        assertEq(typed('const l = (a: A) => a'), 'A')
        // A return type's own brackets do not end it before its `=>`.
        assertEq(typed('const m = (a): Map<B, [C]> => a; const n = (a): { b: D } => a'), 'Map B C')
    },
    // A list that is a call stays values, ternary or not.
    calls: () => {
        assertEq(typed('f(a, b)'), '')
        assertEq(typed('f(a)\n{ b }'), '')
        assertEq(typed('c ? (a) : b'), '')
        assertEq(typed('d((a): b, c)'), '')
        assertEq(typed('(a): b\n=> c'), '')
        assertEq(typed('(a'), '')
        // A return type that runs to the end of the text, with no arrow.
        assertEq(typed('(a): b'), '')
    },
    // A return type ends at `=>`, `{` or `;`.
    returnType: () => {
        assertEq(typed('function f(): A; function g(): B { return c }'), 'A B')
        // A block that closes while a return type is open ends it.
        assertEq(typed('{ function h(): C }'), 'C')
    },
    // The name after `as` or `satisfies`, and its type arguments.
    as: () => {
        assertEq(typed('x as string; y satisfies Map<string, Set<number>>; z as const'), 'string Map string Set number')
        assertEq(typed('w as\nv'), '')
    },
    // `>`, `>>` and `>>>` close generic arguments in a type, and compare
    // or shift in a value.
    angles: () => {
        assertEq(typed('type A = B<C<D<E>>>; const f = g >> h > i'), 'B C D E')
        assertEq(typed('const a = b < c'), '')
    },
    // An unmatched closing bracket leaves the outermost value as it is.
    unmatched: () => assertEq(typed(') ] } const a: B'), 'B'),
}

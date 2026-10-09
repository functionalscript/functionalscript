/**
 * @import { Expression } from './types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { nix, nixToString } from './module.f.mjs'

/** @type {(expression: Expression) => string} */
const text = expression => unwrap(nixToString(expression))

/** @type {(expression: Expression) => string} */
const reason = expression => {
    const [kind, value] = nixToString(expression)
    assertEq(kind, 'error')
    return value
}

/** @type {(nodePackage: string, shellHook: boolean) => Expression} */
const nodeFlake = (nodePackage, shellHook) => ['set',
    ['=', ['inputs', 'nixpkgs', 'url'], 'github:NixOS/nixpkgs/<commit>'],
    ['=', ['outputs'], ['lambda',
        ['open-set-pattern', 'nixpkgs'],
        ['set',
            ['=', ['devShells', 'aarch64-linux', 'default'],
                ['let', [
                    ['=', ['pkgs'], ['apply',
                        ['ref', 'import'],
                        ['ref', 'nixpkgs'],
                        ['set', ['=', ['system'], 'aarch64-linux']]
                    ]]
                ], ['apply',
                    ['ref', 'pkgs', 'mkShell'],
                    ['set',
                        ['=', ['packages'], ['list', ['ref', 'pkgs', nodePackage]]],
                        ...(shellHook ? [/** @type {const} */ ([
                            '=',
                            ['shellHook'],
                            ['indented-string', `export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`]
                        ])] : [])
                    ]
                ]]
            ]
        ]
    ]]
]

const node24 = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/<commit>";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}
`

const node22 = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/<commit>";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
            shellHook = ''
                export NPM_CONFIG_PREFIX="$HOME/.npm-global"
                export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
                mkdir -p "$NPM_CONFIG_PREFIX"
            '';
        };
    };
}
`

export const proof = {
    strings: () => {
        assertEq(text('"\\${\n\r\t'), `"\\"\\\\\\\${\\n\\r\\t"\n`)
    },
    reference: () => {
        assertEq(text(['ref', 'pkgs', 'a.b', 'or']), 'pkgs."a.b"."or"\n')
        assertEq(text(['ref', "a-b'9"]), "a-b'9\n")
        assertEq(text(['ref', '_AZ']), '_AZ\n')
    },
    emptySetAndList: () => {
        assertEq(text(['set']), '{}\n')
        assertEq(text(['list']), '[ ]\n')
    },
    multiReferenceList: () => {
        assertEq(
            text(['list', ['ref', 'pkgs', 'nodejs_22'], ['ref', 'pkgs', 'nodejs_24']]),
            '[ pkgs.nodejs_22 pkgs.nodejs_24 ]\n'
        )
    },
    // A list item is a reference or a string, and a string item is quoted and
    // escaped exactly as a string anywhere else is. `rust-overlay` toolchain
    // declarations are lists of component and target names, which is what this
    // form exists for.
    stringList: () => {
        assertEq(
            text(['list', 'clippy', 'rustfmt']),
            '[ "clippy" "rustfmt" ]\n')
        assertEq(
            text(['list', ['ref', 'rust'], 'a"b']),
            '[ rust "a\\"b" ]\n')
    },
    compatiblePaths: () => {
        assertEq(
            text(['set', ['=', ['x', 'y'], 'a'], ['=', ['x', 'z'], 'b']]),
            '{\n    x.y = "a";\n    x.z = "b";\n}\n'
        )
    },
    chunks: () => {
        const [open, reference, close, extra] = toArray(unwrap(nix(['list', ['ref', 'pkgs', 'nodejs_24']])))
        assertEq(open, '[ ')
        assertEq(reference, 'pkgs.nodejs_24')
        assertEq(close, ' ]')
        assertEq(extra, undefined)
    },
    indentedStringEscaping: () => {
        // Every `'` is escaped as `''\'`, so the pair here is two escapes
        // rather than the `'''` a pair used to become — see the module for why
        // a bare quote can never be left in front of an escape.
        assertEq(
            text(['indented-string', "a '' ${b}"]),
            "''\n    a ''\\'''\\' ''${b}\n''\n")
        assertEq(
            text(['indented-string', '  a\n\t b\n  ']),
            "''\n    ''\\ ''\\ a\n    ''\\t''\\ b\n    ''\\ ''\\ \n''\n"
        )
    },
    // The two halves of an indented string, side by side. A `string` part is
    // content — its `${` is escaped and reaches the file as those characters —
    // and a `_Reference` part is an interpolation Nix resolves. That is the
    // only way a generated hook can name a package, since a store path is not
    // knowable when the file is written.
    indentedStringInterpolation: () => {
        assertEq(
            text(['indented-string', 'a=', ['ref', 'pkgs', 'gcc_multi'], '/bin/cc']),
            "''\n    a=${pkgs.gcc_multi}/bin/cc\n''\n")
        // Escaped beside unescaped, in one string: the literal `${b}` survives
        // as text while the reference beside it does not.
        assertEq(
            text(['indented-string', '${b}', ['ref', 'a']]),
            "''\n    ''${b}${a}\n''\n")
        // An attribute that is not an identifier is quoted, as in any other
        // selection; a *root* that is not one has no spelling at all, so the
        // whole expression is rejected rather than written wrong.
        assertEq(
            text(['indented-string', ['ref', 'pkgs', 'not an identifier']]),
            "''\n    ${pkgs.\"not an identifier\"}\n''\n")
        assertEq(
            reason(['indented-string', ['ref', 'not an identifier']]),
            'reference root is not an identifier: "not an identifier"')
    },
    // Escaping sees the text a reader sees, not each half of it. Both of these
    // were wrong when parts were escaped one at a time, and both silently.
    indentedStringEscapesAcrossParts: () => {
        // Neither half contains `${`, so neither would be escaped alone — and
        // the two concatenate into an interpolation Nix resolves.
        assertEq(
            text(['indented-string', '$', '{x}']),
            "''\n    ''${x}\n''\n")
        // Worse: neither half contains `''` either, and the pair closes the
        // string. Every quote is escaped, so the pair cannot form at all.
        assertEq(
            text(['indented-string', "a'", "'b"]),
            "''\n    a''\\'''\\'b\n''\n")
    },
    // A reference is the one boundary `coalesceStrings` does not join across,
    // and both sides of it need their own care.
    //
    // Read against the lexer's rules rather than guessed: the catch-all
    // `([^\$\']|\$[^\{\']|\'[^\'\$])+` matches `$$` through its second
    // alternative and then runs on, so longest-match takes `$${a}{x}` as **one
    // literal token** and the reference never resolves. That is why a `$` at
    // the end of a string part is escaped when a reference follows: the `{`
    // that makes it dangerous is in the next part, where `escapeIndented`
    // cannot see it.
    indentedStringEscapesIntoAReference: () => {
        // `''$` is a literal `$`; the `${a}` after it is a live interpolation.
        assertEq(
            text(['indented-string', '$', ['ref', 'a'], '{x}']),
            "''\n    ''$${a}{x}\n''\n")
        // Nothing to do on the other side: `{x}` after a reference has no `$`
        // in front of it to make anything of.
        assertEq(
            text(['indented-string', ['ref', 'a'], '{x}']),
            "''\n    ${a}{x}\n''\n")
        // A trailing `$` with no reference after it is already literal, and is
        // left alone — `$PATH` and a `$` at the end of a hook both read back
        // as themselves.
        assertEq(
            text(['indented-string', 'echo $']),
            "''\n    echo $\n''\n")
        assertEq(
            text(['indented-string', 'echo $PATH']),
            "''\n    echo $PATH\n''\n")
    },
    // A single quote in front of an escape is the collision that escaping
    // pairs as `'''` could not avoid. `'` + `${x}` emitted `'''${x}`, which
    // the lexer reads as an escaped `''` followed by a **live** interpolation
    // — so a literal became a reference to whatever `x` is bound to.
    //
    // Escaping every quote as `''\'` is what forecloses it: no bare `'` is
    // ever left adjacent to an escape.
    indentedStringQuoteBeforeAnEscape: () => {
        assertEq(
            text(['indented-string', "'${x}"]),
            "''\n    ''\\'''${x}\n''\n")
        assertEq(
            text(['indented-string', "'", ['ref', 'a']]),
            "''\n    ''\\'${a}\n''\n")
    },
    // No parts at all is the empty string, not a failure.
    indentedStringEmpty: () => {
        assertEq(text(['indented-string']), "''\n    \n''\n")
    },
    emptyPattern: () => {
        assertEq(text(['lambda', ['open-set-pattern'], ['set']]), '{ ... }: {}\n')
    },
    node24: () => {
        assertEq(text(nodeFlake('nodejs_24', false)), node24)
    },
    node22: () => {
        assertEq(text(nodeFlake('nodejs_22', true)), node22)
    },
    // Each rule `check` owns, and the reason it gives. A rejection names the
    // offending identifier or the conflicting paths, so a caller generating a
    // large expression learns which part of it broke.
    invalid: {
        reference: () => assertEq(
            reason(['ref', 'not valid']),
            'reference root is not an identifier: "not valid"'),
        reservedReference: () => assertEq(
            reason(['ref', 'let']),
            'reference root is not an identifier: "let"'),
        emptyReference: () => assertEq(
            reason(['ref', '']),
            'reference root is not an identifier: ""'),
        digitReference: () => assertEq(
            reason(['ref', '1abc']),
            'reference root is not an identifier: "1abc"'),
        nonAsciiReference: () => assertEq(
            reason(['ref', 'é']),
            'reference root is not an identifier: "é"'),
        // The name is quoted as a Nix string, so a reason stays one line.
        escapedReference: () => assertEq(
            reason(['ref', 'a\n"b']),
            'reference root is not an identifier: "a\\n\\"b"'),
        pattern: () => assertEq(
            reason(['lambda', ['open-set-pattern', 'if'], ['set']]),
            'pattern name is not an identifier: "if"'),
        duplicatePattern: () => assertEq(
            reason(['lambda', ['open-set-pattern', 'x', 'x'], ['set']]),
            'duplicate pattern name: x'),
        duplicateBinding: () => assertEq(
            reason(['set', ['=', ['x'], 'a'], ['=', ['x'], 'b']]),
            'conflicting attribute paths: x and x'),
        parentThenChildBinding: () => assertEq(
            reason(['set', ['=', ['x'], 'a'], ['=', ['x', 'y'], 'b']]),
            'conflicting attribute paths: x and x.y'),
        childThenParentBinding: () => assertEq(
            reason(['set', ['=', ['x', 'y'], 'a'], ['=', ['x'], 'b']]),
            'conflicting attribute paths: x.y and x'),
        // A path is named as it is written, quoted where it has to be.
        quotedConflict: () => assertEq(
            reason(['set', ['=', ['a b'], 'a'], ['=', ['a b', 'c'], 'b']]),
            'conflicting attribute paths: "a b" and "a b".c'),
        duplicateLetBinding: () => assertEq(
            reason(['let', [['=', ['x'], 'a'], ['=', ['x'], 'b']], ['ref', 'x']]),
            'conflicting attribute paths: x and x'),
        bindingValue: () => assertEq(
            reason(['set', ['=', ['ok'], ['ref', 'bad name']]]),
            'reference root is not an identifier: "bad name"'),
        listItem: () => assertEq(
            reason(['list', ['ref', 'valid'], ['ref', 'bad name']]),
            'reference root is not an identifier: "bad name"'),
        applicationFunction: () => assertEq(
            reason(['apply', ['ref', 'with']]),
            'reference root is not an identifier: "with"'),
        applicationArgument: () => assertEq(
            reason(['apply', ['ref', 'f'], ['ref', 'bad name']]),
            'reference root is not an identifier: "bad name"'),
        applicationSetArgument: () => assertEq(
            reason(['apply', ['ref', 'f'], ['set', ['=', ['x'], ['ref', 'in']]]]),
            'reference root is not an identifier: "in"'),
        lambdaBody: () => assertEq(
            reason(['lambda', ['open-set-pattern', 'good'], ['ref', 'bad name']]),
            'reference root is not an identifier: "bad name"'),
        letBinding: () => assertEq(
            reason(['let', [['=', ['x'], ['ref', 'bad name']]], ['ref', 'x']]),
            'reference root is not an identifier: "bad name"'),
        letBody: () => assertEq(
            reason(['let', [], ['ref', 'bad name']]),
            'reference root is not an identifier: "bad name"'),
        // The first violation is the one reported: the pattern before the
        // body, and an earlier binding before a later one.
        first: () => {
            assertEq(
                reason(['lambda', ['open-set-pattern', 'if'], ['ref', 'bad name']]),
                'pattern name is not an identifier: "if"')
            assertEq(
                reason(['set', ['=', ['a'], ['ref', 'bad one']], ['=', ['a'], ['ref', 'bad two']]]),
                'reference root is not an identifier: "bad one"')
            assertEq(
                reason(['set', ['=', ['a'], 'x'], ['=', ['a'], ['ref', 'bad two']]]),
                'conflicting attribute paths: a and a')
        },
    }
}

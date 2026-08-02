import { assert, assertEq } from '../../asserts/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { nix, nixToString, type Expression } from './module.f.ts'

const nodeFlake = (nodePackage: string, shellHook: boolean): Expression => ['set',
    ['=', ['inputs', 'nixpkgs', 'url'], 'github:NixOS/nixpkgs/<commit>'],
    ['=', ['outputs'], ['lambda',
        ['open-set-pattern', 'nixpkgs'],
        ['let', [
            ['=', ['pkgs'], ['apply',
                ['ref', 'import'],
                ['ref', 'nixpkgs'],
                ['set', ['=', ['system'], 'aarch64-linux']]
            ]]
        ], ['set',
            ['=', ['devShells', 'aarch64-linux', 'default'], ['apply',
                ['ref', 'pkgs', 'mkShell'],
                ['set',
                    ['=', ['packages'], ['list', ['ref', 'pkgs', nodePackage]]],
                    ...(shellHook ? [[
                        '=',
                        ['shellHook'],
                        ['indented-string', `export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`]
                    ] as const] : [])
                ]
            ]]
        ]]
    ]]
]

const node24 = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/<commit>";
    outputs = { nixpkgs, ... }: let
        pkgs = import nixpkgs {
            system = "aarch64-linux";
        };
    in
    {
        devShells.aarch64-linux.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}
`

const node22 = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/<commit>";
    outputs = { nixpkgs, ... }: let
        pkgs = import nixpkgs {
            system = "aarch64-linux";
        };
    in
    {
        devShells.aarch64-linux.default = pkgs.mkShell {
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
        assertEq(nixToString('"\\${\n\r\t'), `"\\"\\\\\\\${\\n\\r\\t"\n`)
    },
    reference: () => {
        assertEq(nixToString(['ref', 'pkgs', 'a.b', 'or']), 'pkgs."a.b"."or"\n')
        assertEq(nixToString(['ref', "a-b'9"]), "a-b'9\n")
        assertEq(nixToString(['ref', '_AZ']), '_AZ\n')
    },
    emptySetAndList: () => {
        assertEq(nixToString(['set']), '{}\n')
        assertEq(nixToString(['list']), '[ ]\n')
    },
    multiReferenceList: () => {
        assertEq(
            nixToString(['list', ['ref', 'pkgs', 'nodejs_22'], ['ref', 'pkgs', 'nodejs_24']]),
            '[ pkgs.nodejs_22 pkgs.nodejs_24 ]\n'
        )
    },
    // A list holds any expression Nix parses without parentheses, so an image's
    // `Env` — plain strings next to interpolated store paths — is one list.
    mixedList: () => {
        assertEq(
            nixToString(['list',
                'HOME=/tmp',
                ['interpolated-string', 'BROWSERS=', ['ref', 'pkgs', 'playwright-driver', 'browsers']],
                ['set', ['=', ['x'], 'y']],
                ['list', 'nested'],
            ]),
            '[ "HOME=/tmp" "BROWSERS=${pkgs.playwright-driver.browsers}" {\n    x = "y";\n} [ "nested" ] ]\n'
        )
    },
    interpolatedString: () => {
        assertEq(
            nixToString(['interpolated-string', 'a=', ['ref', 'pkgs', 'b'], '/c']),
            '"a=${pkgs.b}/c"\n'
        )
        // Literal parts are escaped as in any quoted string, so a `${` a job
        // supplies stays text instead of starting an interpolation.
        assertEq(nixToString(['interpolated-string', '${x}"']), '"\\${x}\\""\n')
        assertEq(nixToString(['interpolated-string']), '""\n')
    },
    compatiblePaths: () => {
        assertEq(
            nixToString(['set', ['=', ['x', 'y'], 'a'], ['=', ['x', 'z'], 'b']]),
            '{\n    x.y = "a";\n    x.z = "b";\n}\n'
        )
    },
    chunks: () => {
        const chunks = nix(['list', ['ref', 'pkgs', 'nodejs_24']])
        assert(chunks !== undefined)
        const [open, reference, close, extra] = toArray(chunks)
        assertEq(open, '[ ')
        assertEq(reference, 'pkgs.nodejs_24')
        assertEq(close, ' ]')
        assertEq(extra, undefined)
    },
    indentedStringEscaping: () => {
        assertEq(nixToString(['indented-string', "a '' ${b}"]), "''\n    a ''' ''${b}\n''\n")
        assertEq(
            nixToString(['indented-string', '  a\n\t b\n  ']),
            "''\n    ''\\ ''\\ a\n    ''\\t''\\ b\n    ''\\ ''\\ \n''\n"
        )
    },
    emptyPattern: () => {
        assertEq(nixToString(['lambda', ['open-set-pattern'], ['set']]), '{ ... }: {}\n')
    },
    node24: () => {
        assertEq(nixToString(nodeFlake('nodejs_24', false)), node24)
    },
    node22: () => {
        assertEq(nixToString(nodeFlake('nodejs_22', true)), node22)
    },
    invalid: {
        reference: () => assertEq(nixToString(['ref', 'not valid']), undefined),
        reservedReference: () => assertEq(nixToString(['ref', 'let']), undefined),
        emptyReference: () => assertEq(nixToString(['ref', '']), undefined),
        digitReference: () => assertEq(nixToString(['ref', '1abc']), undefined),
        nonAsciiReference: () => assertEq(nixToString(['ref', 'é']), undefined),
        pattern: () => assertEq(
            nixToString(['lambda', ['open-set-pattern', 'if'], ['set']]),
            undefined
        ),
        duplicatePattern: () => assertEq(
            nixToString(['lambda', ['open-set-pattern', 'x', 'x'], ['set']]),
            undefined
        ),
        duplicateBinding: () => assertEq(
            nixToString(['set', ['=', ['x'], 'a'], ['=', ['x'], 'b']]),
            undefined
        ),
        parentThenChildBinding: () => assertEq(
            nixToString(['set', ['=', ['x'], 'a'], ['=', ['x', 'y'], 'b']]),
            undefined
        ),
        childThenParentBinding: () => assertEq(
            nixToString(['set', ['=', ['x', 'y'], 'a'], ['=', ['x'], 'b']]),
            undefined
        ),
        duplicateLetBinding: () => assertEq(
            nixToString(['let', [['=', ['x'], 'a'], ['=', ['x'], 'b']], ['ref', 'x']]),
            undefined
        ),
        bindingValue: () => assertEq(
            nixToString(['set', ['=', ['ok'], ['ref', 'bad name']]]),
            undefined
        ),
        listItem: () => assertEq(
            nixToString(['list', ['ref', 'valid'], ['ref', 'bad name']]),
            undefined
        ),
        interpolatedReference: () => assertEq(
            nixToString(['interpolated-string', 'a=', ['ref', 'bad name']]),
            undefined
        ),
        applicationFunction: () => assertEq(
            nixToString(['apply', ['ref', 'with']]),
            undefined
        ),
        applicationArgument: () => assertEq(
            nixToString(['apply', ['ref', 'f'], ['ref', 'bad name']]),
            undefined
        ),
        lambdaBody: () => assertEq(
            nixToString(['lambda', ['open-set-pattern', 'good'], ['ref', 'bad name']]),
            undefined
        ),
        letBinding: () => assertEq(
            nixToString(['let', [['=', ['x'], ['ref', 'bad name']]], ['ref', 'x']]),
            undefined
        ),
        letBody: () => assertEq(
            nixToString(['let', [], ['ref', 'bad name']]),
            undefined
        ),
    }
}

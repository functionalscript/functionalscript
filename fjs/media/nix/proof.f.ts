import { assertEq } from '../../asserts/module.f.ts'
import { concat } from '../../types/string/module.f.ts'
import { nix, nixToString, type Expression } from './module.f.ts'

const nodeFlake = (nodePackage: string, shellHook: boolean): Expression => ['set',
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
                        ...(shellHook ? [[
                            '=',
                            ['shellHook'],
                            ['indented-string', `export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`]
                        ] as const] : [])
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
        assertEq(nixToString('"\\${\n\r\t'), `"\\"\\\\\\\${\\n\\r\\t"\n`)
    },
    reference: () => {
        assertEq(nixToString(['ref', 'pkgs', 'a.b', 'or']), 'pkgs."a.b"."or"\n')
    },
    emptySetAndList: () => {
        assertEq(nixToString(['set']), '{}\n')
        assertEq(nixToString(['list']), '[ ]\n')
    },
    chunks: () => {
        const chunks = nix(['list', ['ref', 'pkgs', 'nodejs_24']])
        assertEq(chunks === undefined ? undefined : concat(chunks), '[ pkgs.nodejs_24 ]')
    },
    indentedStringEscaping: () => {
        assertEq(nixToString(['indented-string', "a '' ${b}"]), "''\n    a ''' ''${b}\n''\n")
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
        pattern: () => assertEq(
            nixToString(['lambda', ['open-set-pattern', 'if'], ['set']]),
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

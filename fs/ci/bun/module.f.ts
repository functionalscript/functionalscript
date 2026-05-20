/**
 * CI step builder for Bun: installs the pinned Bun version (with a PowerShell
 * fallback for Windows ARM) and runs `bun install` and `bun test`.
 *
 * @module
 */
import { bun } from '../config/module.f.ts'
import { type Architecture, type MetaStep, type Os, type Step, clean, install, test } from '../common/module.f.ts'

type Tool = {
    readonly def: Step
    readonly name: string
    readonly path: string
}

const installOnWindowsArm = ({ def, name, path }: Tool) => (v: Os) => (a: Architecture): MetaStep =>
    install(v === 'windows' && a === 'arm'
        ? { run: `irm ${path}/install.ps1 | iex; "$env:USERPROFILE\\.${name}\\bin" | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append` }
        : def)

const installBun = installOnWindowsArm({
    def: {
        uses: 'oven-sh/setup-bun@v2',
        with: {
            'bun-version': bun
        },
    },
    name: 'bun',
    path: 'bun.sh',
})

export const bunSteps = (extra: readonly MetaStep[]) => (v: Os, a: Architecture): readonly MetaStep[] => clean([
    installBun(v)(a),
    test({ run: 'bun install' }),
    test({ run: 'bun test --timeout 20000' }),
    ...extra,
])

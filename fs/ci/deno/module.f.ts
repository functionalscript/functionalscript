import { deno } from '../config/module.f.ts'
import { type MetaStep, clean, install, test } from '../common/module.f.ts'

export const denoSteps = (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    install({
        uses: 'denoland/setup-deno@v2',
        with: { 'deno-version': deno },
    }),
    test({ run: 'deno install' }),
    test({ run: 'deno task test' }),
    ...extra,
])

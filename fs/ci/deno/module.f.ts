/**
 * CI step builder for Deno: installs the pinned Deno version and runs
 * `deno install` followed by `deno task test`.
 *
 * @module
 */
import { actions, deno } from '../config/module.f.ts'
import { type MetaStep, clean, install, test } from '../common/module.f.ts'

export const denoSteps = (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    install({
        uses: `denoland/setup-deno@${actions['denoland/setup-deno']}`,
        with: { 'deno-version': deno },
    }),
    test({ run: 'deno install' }),
    test({ run: 'deno task test' }),
    ...extra,
])

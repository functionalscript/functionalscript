import { deno } from '../config/module.f.ts'
import { type MetaStep, clean, install, test } from '../common/module.f.ts'

export const denoSteps: readonly MetaStep[] = clean([
    install({
        uses: 'denoland/setup-deno@v2',
        with: { 'deno-version': deno },
    }),
    test({ run: 'deno install' }),
    test({ run: 'deno task test' }),
    test({ run: 'deno task fjs compile issues/demo/data/tree.json _tree.f.js' }),
    test({ run: 'deno task fjs t' }),
    test({ run: 'deno publish --dry-run' }),
])

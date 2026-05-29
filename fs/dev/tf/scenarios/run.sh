#!/bin/sh
# Usage: run.sh <runner> <scenario>
# runner: bun | node
# scenario: path to a *.pass.f.ts or *.fail.f.ts file
set -e

runner=$1
scenario=$(realpath "$2")

case "$scenario" in
    *.pass.f.ts) expected=0 ;;
    *.fail.f.ts) expected=1 ;;
    *) echo "unknown suffix: $scenario" >&2; exit 2 ;;
esac

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

cat > "$tmpdir/scenario.test.f.ts" <<EOF
export * from '$scenario'
EOF

repo=$(cd "$(dirname "$0")/../../../.." && pwd)

case "$runner" in
    bun)        cmd="bun test $repo/fs/dev/tf/all.test.ts" ;;
    node)       cmd="node --test $repo/fs/dev/tf/all.test.ts" ;;
    deno)       cmd="deno test --allow-read --allow-env $repo/fs/dev/tf/all.test.ts" ;;
    playwright) cmd="PLAYWRIGHT_TEST=1 npx playwright test $repo/fs/dev/tf/all.test.ts" ;;
    *) echo "unknown runner: $runner" >&2; exit 2 ;;
esac

actual=0
INIT_CWD="$tmpdir" $cmd > /dev/null 2>&1 || actual=$?

if [ "$actual" -eq "$expected" ]; then
    echo "pass: $(basename "$scenario") [exit $actual]"
    exit 0
else
    echo "FAIL: $(basename "$scenario") [expected $expected, got $actual]"
    exit 1
fi

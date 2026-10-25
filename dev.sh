#!/bin/sh
set -eu
if [ "$#" -eq 0 ]; then exec pixi shell --locked --environment ci; fi
exec pixi run --locked --environment ci "$@"

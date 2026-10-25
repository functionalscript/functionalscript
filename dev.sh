#!/bin/sh
set -eu
if [ "$#" -eq 0 ]; then set -- bash; fi
exec mise exec -- "$@"

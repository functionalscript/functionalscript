#!/bin/sh

run_powershell() {
  if command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -ExecutionPolicy Bypass -File "$@"
    return
  fi

  if command -v powershell >/dev/null 2>&1; then
    powershell -NoProfile -ExecutionPolicy Bypass -File "$@"
    return
  fi

  return 127
}

enter_repo_root() {
  repo_root="$(git rev-parse --show-toplevel)"
  cd "$repo_root"
}

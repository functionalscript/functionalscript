#!/bin/bash
# Claude Code on the web starts a session inside the Nix development shell.
#
# The container has no Nix, so the hook installs one, then makes the flake
# inputs of ./nix reachable, warms the shell, and hands its environment to
# the session through $CLAUDE_ENV_FILE. Every command the session runs then
# sees what `./dev.sh` gives a developer and `./nix/run` gives CI. The
# container is cached once the hook completes, so the next session skips
# the install and the downloads.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
    exit 0
fi

# What a SessionStart hook prints becomes session context. Installer and
# download logs belong on stderr.
exec >&2

cd "$CLAUDE_PROJECT_DIR"

# The Nix profile script refuses to run without USER, which the container
# leaves unset.
export USER="${USER:-$(id -un)}"
profile="$HOME/.nix-profile/etc/profile.d/nix.sh"

if [ ! -e "$profile" ]; then
    # A single-user install as root. The installer creates no build users, so
    # Nix must not expect the group; the same file turns on the features
    # ./nix/run asks for on the command line.
    mkdir -p /etc/nix
    printf 'build-users-group =\nexperimental-features = nix-command flakes\n' > /etc/nix/nix.conf
    curl -fsSL https://channels.nixos.org/nix-latest/install | sh -s -- --no-daemon --yes
fi
. "$profile"

# Nix fetches a locked `github:` input as a tarball from the GitHub API, which
# the session's GitHub proxy limits to the repository of the session. Git
# access to public repositories has no such limit, and a shallow fetch of the
# locked revision produces the store path the lock names, so Nix finds every
# input in the store and asks GitHub for no tarball.
nix eval --raw --impure --expr '
    let
        lock = builtins.fromJSON (builtins.readFile ./nix/flake.lock);
        nodes = builtins.attrValues lock.nodes;
        github = builtins.filter (n: n ? locked && n.locked.type == "github") nodes;
        url = n: "git+https://github.com/${n.locked.owner}/${n.locked.repo}?rev=${n.locked.rev}&shallow=1\n";
    in
    builtins.concatStringsSep "" (map url github)
' | while read -r input; do
    nix flake prefetch --quiet "$input"
done

./nix/run npm ci
./nix/run cargo fetch

# The shell's PATH, and what its shellHook exports, for every command of the
# session.
./nix/run bash -c '
    printf "export PATH=%q\n" "$PATH"
    for name in "${!CARGO_@}"; do
        printf "export %s=%q\n" "$name" "${!name}"
    done
' >> "$CLAUDE_ENV_FILE"

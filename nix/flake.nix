{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/6aefcda9401be8acc2b74244fb3b37520ea1f0a8";
    inputs.rust-overlay.url = "github:oxalica/rust-overlay/6ae57a71bcb0bebc7a66cc2bd76942c4cf649167";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { nixpkgs, rust-overlay, ... }: let
        shell = { pkgs, targets, shellHook, url, hash, ... }: let
            rust = pkgs.rust-bin.stable."1.98.1".minimal.override {
                extensions = [ "clippy" "rustfmt" ];
                targets = targets;
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.2";
                src = pkgs.fetchurl {
                    url = url;
                    hash = hash;
                };
            };
        in
        pkgs.mkShell {
            packages = [ rust pinned pkgs.nodejs_26 pkgs.deno pkgs.typescript-go pkgs.wasmtime pkgs.wasmer pkgs.git ];
            shellHook = shellHook;
        };
    in
    {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            shellHook = "";
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-aarch64.zip";
            hash = "sha256-VDKLvC2cjgyfiSxUTWbFeoO4QTnjSQnl7oF1jxrI/ac=";
        };
        devShells.x86_64-linux.default = let
            pkgs = import nixpkgs {
                system = "x86_64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" "i686-unknown-linux-gnu" ];
            shellHook = ''
                export CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER=${pkgs.pkgsi686Linux.stdenv.cc}/bin/cc
            '';
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip";
            hash = "sha256-NjaPrvdSeHXV/6UuU81IAhdB8qg+tiCKjdZAaNQiqRM=";
        };
        devShells.aarch64-darwin.default = let
            pkgs = import nixpkgs {
                system = "aarch64-darwin";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            shellHook = "";
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-darwin-aarch64.zip";
            hash = "sha256-kJh6OhbX21VtiGrD1VHnttPt8KHPQ6yu1iLoZ2vh0S8=";
        };
        devShells.x86_64-darwin.default = let
            pkgs = import nixpkgs {
                system = "x86_64-darwin";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            shellHook = "";
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-darwin-x64-baseline.zip";
            hash = "sha256-utW71s8U0JgNEV9ZVMn/kE32GdXplNLaH/zNPzFjALA=";
        };
    };
}

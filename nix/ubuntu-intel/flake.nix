{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/062346a6d85bc4b49dfaa61c986e9c5be21217d1";
    inputs.rust-overlay.url = "github:oxalica/rust-overlay/996e9b0b019a4a9eb9e9a5641aefa06d801b5895";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { nixpkgs, rust-overlay, ... }: {
        devShells.x86_64-linux.default = let
            pkgs = import nixpkgs {
                system = "x86_64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" ];
                targets = [ "i686-unknown-linux-gnu" ];
            };
        in
        pkgs.mkShell {
            packages = [ rust pkgs.gcc_multi pkgs.nodejs_26 ];
            shellHook = ''
                export CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER=${pkgs.gcc_multi}/bin/cc
            '';
        };
    };
}

{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/062346a6d85bc4b49dfaa61c986e9c5be21217d1";
    inputs.rust-overlay.url = "github:oxalica/rust-overlay/996e9b0b019a4a9eb9e9a5641aefa06d801b5895";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { nixpkgs, rust-overlay, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" "rustfmt" ];
                targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            };
        in
        pkgs.mkShell {
            packages = [ rust pkgs.wasmtime pkgs.wasmer ];
        };
    };
}

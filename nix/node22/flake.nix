{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/d58a46e3bc02d91ebe04667f8397752a749c0024";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
        };
    };
}

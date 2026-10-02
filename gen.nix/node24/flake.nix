{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/4feb8eb8bf30f323a8a5d285f14ee51d6a7197b1";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}

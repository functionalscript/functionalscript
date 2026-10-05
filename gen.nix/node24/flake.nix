{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/0d9e9b832d03ac387417e16ce1febf73b2e631e1";
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

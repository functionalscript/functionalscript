{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/a3b98866eecd08edac6e61a3081e69540a35020f";
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

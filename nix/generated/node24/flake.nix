{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/21ea275a7c46aef9d4d6ddc962e6d562e9d94183";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        assert pkgs.nodejs_24.version == "24.18.0";
        pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}

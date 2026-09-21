{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/6d663c0533ff269008fb84e45930151e37c99db9";
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

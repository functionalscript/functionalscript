{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/c25784012c9982bca5b3e0de87e90bbdac8927d3";
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

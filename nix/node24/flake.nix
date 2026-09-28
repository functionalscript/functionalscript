{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/cf5e76507c6e23b59f7e0ffcc7baa2a39ddd8442";
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

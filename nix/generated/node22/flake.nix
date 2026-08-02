{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/21ea275a7c46aef9d4d6ddc962e6d562e9d94183";
    outputs = { nixpkgs, ... }: let
        pkgs = import nixpkgs {
            system = "aarch64-linux";
        };
    in
    {
        devShells.aarch64-linux.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
            shellHook = ''
                export NPM_CONFIG_PREFIX="$HOME/.npm-global"
                export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
                mkdir -p "$NPM_CONFIG_PREFIX"
            '';
        };
    };
}

FROM mcr.microsoft.com/devcontainers/base:debian
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl ca-certificates xz-utils && if [ "$(dpkg --print-architecture)" = amd64 ]; then apt-get install -y --no-install-recommends gcc-multilib libc6-dev-i386; fi && rm -rf /var/lib/apt/lists/*
ARG MISE_VERSION=2026.10.19
RUN arch="$(dpkg --print-architecture)" && case "$arch" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) exit 1 ;; esac && curl -fsSL "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/mise-v${MISE_VERSION}-linux-${arch}.tar.gz" -o /tmp/mise.tar.gz && tar -xzf /tmp/mise.tar.gz -C /usr/local --strip-components=1 mise/bin/mise && rm /tmp/mise.tar.gz
ENV PATH="/home/vscode/.local/share/mise/shims:${PATH}"

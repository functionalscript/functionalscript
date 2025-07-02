FROM debian

# Install basic tools
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    build-essential \
    git \
    gnupg \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust via rustup
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo install sccache --locked

# Install Node.js (LTS via NodeSource)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/functionalscript/functionalscript

WORKDIR /functionalscript

RUN RUSTC_WRAPPER=sccache cargo test --no-run

# To use sccache in a terminal, use `RUSTC_WRAPPER=sccache cargo test --no-run > _.txt 2>&1`.
# `> _.log 2>&1` disables TTY and prevent cargo to insert `--diagnostic-width=...`.
#
# Use `SCCACHE_LOG=debug SCCACHE_ERROR_LOG=_.log` to see which parameters are passed to `RUSTC`.
#
# For example,
# `SCCACHE_LOG=debug SCCACHE_ERROR_LOG=/_.log RUSTC_WRAPPER=sccache cargo test --no-run`
# See https://github.com/mozilla/sccache/issues/2418

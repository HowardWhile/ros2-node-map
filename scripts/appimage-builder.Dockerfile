# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS node-runtime

FROM ubuntu:24.04 AS builder

ARG TARGETARCH

COPY --from=node-runtime /usr/local/ /usr/local/

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates \
        curl \
        file \
        python3 \
        python3-venv \
        squashfs-tools \
    && python3 -m venv /opt/uv \
    && /opt/uv/bin/pip install --no-cache-dir uv \
    && rm -rf /var/lib/apt/lists/*

ENV CI=1
ENV PATH="/opt/uv/bin:${PATH}"

WORKDIR /workspace

RUN python3 -c 'import sys; assert sys.version_info[:2] == (3, 12), sys.version'

COPY app/package.json app/package-lock.json app/
RUN npm --prefix app ci

COPY app app
COPY backend backend
COPY scripts scripts

RUN node scripts/version.mjs check
RUN npm --prefix app test
RUN npm --prefix app run build
RUN npm --prefix app run package:backend

RUN set -eu; \
    case "${TARGETARCH}" in \
      amd64) electron_arch="x64"; release_arch="x86_64"; expected_machine="x86-64" ;; \
      arm64) electron_arch="arm64"; release_arch="arm64"; expected_machine="ARM aarch64" ;; \
      *) echo "Unsupported Docker target architecture: ${TARGETARCH}" >&2; exit 2 ;; \
    esac; \
    cd app; \
    npm exec -- electron-builder --linux AppImage "--${electron_arch}" --publish never; \
    product_version="$(node -p "require('./package.json').version")"; \
    source_path="release/ros2-node-map-v${product_version}-linux-${release_arch}.AppImage"; \
    destination_path="/out/ros2-node-map-v${product_version}-linux-${release_arch}.AppImage"; \
    test -s "${source_path}"; \
    file "${source_path}" | grep -F "${expected_machine}"; \
    install -D -m 0755 "${source_path}" "${destination_path}"

FROM scratch AS artifact

COPY --from=builder /out/ /

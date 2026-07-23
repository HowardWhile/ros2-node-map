# Building Linux AppImages locally

The repository includes a local Docker Buildx workflow that produces AppImages
for both supported Linux CPU architectures without GitHub Actions:

```text
app/release/ros2-node-map-v<version>-linux-x86_64.AppImage
app/release/ros2-node-map-v<version>-linux-arm64.AppImage
```

The version is read from `app/package.json`. The build script does not hard-code
`0.3.1`, so changing the synchronized product version changes both output
filenames automatically.

## Prerequisites

Install Docker Engine with the Buildx plugin. The current Docker builder must
support both `linux/amd64` and `linux/arm64`.

Check the available platforms:

```bash
docker buildx inspect --bootstrap
```

The `Platforms` line must include:

```text
linux/amd64
linux/arm64
```

On an x86-64 host, ARM64 is normally provided through QEMU emulation registered
with Docker. ARM64 emulation is substantially slower than the x86-64 build.

The user running the script must be able to access the Docker daemon. Confirm
that before starting a long build:

```bash
docker version
```

## Build both architectures

Run the script from anywhere inside or outside the repository:

```bash
./scripts/build-appimages.sh
```

The default `all` mode builds x86-64 first and ARM64 second. Existing files with
the same version and architecture in `app/release` are replaced only after the
new artifact has been exported and its CPU architecture has been checked.

The first build requires network access to download the container base image,
npm packages, Electron binaries, Python packages, and other packaging tools.
Docker caches layers, so later builds can reuse unchanged dependencies.

## Build one architecture

Build only x86-64:

```bash
./scripts/build-appimages.sh --arch x86_64
```

Build only ARM64:

```bash
./scripts/build-appimages.sh --arch arm64
```

Show command help without building:

```bash
./scripts/build-appimages.sh --help
```

## What the script does

For each requested architecture, the script:

1. Checks the synchronized `x.y.z` product version.
2. Confirms that Docker Buildx advertises the requested platform.
3. Builds in an Ubuntu 24.04 / Python 3.12 container for that target CPU.
4. Runs the frontend tests and production build.
5. Packages architecture-specific Python backend dependencies.
6. Builds and patches the Electron AppImage launcher.
7. Verifies the exported ELF CPU architecture.
8. Installs the executable artifact into `app/release`.

The host does not need ROS 2 to build the packages. At runtime, live graph
discovery still requires ROS 2 Jazzy on the target system; without ROS, the same
AppImage starts in File-only Mode.

## Running without a display

Capture and headless modes can run from an SSH session without an X server:

```bash
./ros2-node-map-v0.3.1-linux-arm64.AppImage -c
./ros2-node-map-v0.3.1-linux-arm64.AppImage --headless
```

For these non-GUI modes, the AppImage launcher automatically passes Electron's
`--headless`, `--disable-gpu`, and `--disable-software-rasterizer` switches.
Do not add them manually. Normal GUI startup is unchanged.

After changing the launcher, rebuild the AppImage before copying it to the
target machine:

```bash
./scripts/build-appimages.sh --arch arm64
```

## Updating the release version

Keep frontend and backend versions synchronized with the existing version tool:

```bash
node scripts/version.mjs set 0.3.1
node scripts/version.mjs check
```

Then run the AppImage build script again. The resulting names will use
`v0.3.1`.

## Troubleshooting

### Docker socket permission denied

If `docker version` reports permission denied, configure the current account to
access the Docker daemon, then start a new login session. Follow your Docker
installation's security policy; membership in the Docker group is effectively
root-level access.

### ARM64 platform is missing

If Buildx does not list `linux/arm64`, create or select a multi-platform builder
with QEMU support before running the script. The script intentionally stops
before building when the requested platform is unavailable.

### ARM64 build is slow

This is expected when an x86-64 machine emulates ARM64. Docker layer caching
helps subsequent builds, while a native ARM64 Docker host gives the best build
time.

### Build output

Successful builds are written only to:

```text
app/release/
```

Intermediate container files are exported to a temporary directory and removed
when the script exits.

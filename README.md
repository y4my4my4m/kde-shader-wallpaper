# Shader Wallpaper for KDE Plasma 6

<p align="center">
  <img src="https://github.com/y4my4my4m/kde-shader-wallpaper/assets/8145020/6e2e6807-2be5-44c3-9d35-1c560e37cf74" alt="Shader Wallpaper" width="600">
</p>

<p align="center">
  <strong>Run beautiful GLSL shaders as your desktop wallpaper</strong>
</p>

<p align="center">
  <a href="https://store.kde.org/p/1413010/">
    <img src="https://img.shields.io/badge/KDE%20Store-Install-blue?style=for-the-badge&logo=kde" alt="KDE Store">
  </a>
  <a href="https://ko-fi.com/I2I525V5R">
    <img src="https://img.shields.io/badge/Ko--fi-Support-ff5e5b?style=for-the-badge&logo=ko-fi" alt="Ko-fi">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-GPL%20v3-green?style=for-the-badge" alt="License">
  </a>
</p>

---

## ✨ Features

- **200+ Built-in Shaders** - Curated collection of beautiful effects
- **Shadertoy Import** - Import shaders directly from shadertoy.com
- **Multi-Pass Rendering** - Full buffer support (A, B, C, D) for complex effects
- **Audio Reactive** - Shaders that respond to system audio via PipeWire
- **Mouse Interaction** - Full iMouse support on X11 and Wayland
- **Window Tracking** - Shaders can react to window positions
- **Performance Monitoring** - Real-time FPS and power consumption estimates
- **Preset System** - Save and share your configurations

## 📦 Installation

This plugin requires compilation because it uses C++ for OpenGL rendering, audio capture, and cursor tracking.

### From Source (All Distros)

**One-liner install:**
```bash
git clone https://github.com/y4my4my4m/kde-shader-wallpaper.git && cd kde-shader-wallpaper && ./scripts/build.sh
```

**Step by step:**
```bash
# 1. Install dependencies (see below)
# 2. Clone and build
git clone https://github.com/y4my4my4m/kde-shader-wallpaper.git
cd kde-shader-wallpaper
./scripts/build.sh install

# 3. Restart plasmashell
pkill plasmashell && plasmashell &
```

### Dependencies

<details>
<summary><strong>Arch Linux / Manjaro</strong></summary>

```bash
sudo pacman -S cmake extra-cmake-modules qt6-base qt6-declarative \
    libplasma kf6-kconfig kf6-ki18n kf6-kpackage pipewire libpipewire xcb-util
```
</details>

<details>
<summary><strong>Ubuntu / Debian (24.04+)</strong></summary>

```bash
sudo apt install cmake extra-cmake-modules build-essential \
    qt6-base-dev qt6-declarative-dev libplasma-dev \
    libkf6config-dev libkf6i18n-dev libkf6package-dev \
    libpipewire-0.3-dev libxcb1-dev
```
</details>

<details>
<summary><strong>Fedora 40+</strong></summary>

```bash
sudo dnf install cmake extra-cmake-modules gcc-c++ \
    qt6-qtbase-devel qt6-qtdeclarative-devel libplasma-devel \
    kf6-kconfig-devel kf6-ki18n-devel kf6-kpackage-devel \
    pipewire-devel libxcb-devel
```
</details>

<details>
<summary><strong>openSUSE Tumbleweed</strong></summary>

```bash
sudo zypper install cmake extra-cmake-modules gcc-c++ \
    qt6-base-devel qt6-declarative-devel libplasma-devel \
    kf6-kconfig-devel kf6-ki18n-devel kf6-kpackage-devel \
    pipewire-devel libxcb-devel
```
</details>

### Uninstall

```bash
./scripts/build.sh uninstall
# Or manually:
rm -rf ~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/
pkill plasmashell && plasmashell &
```

## 🎮 Usage

1. Right-click your desktop → **Configure Desktop and Wallpaper**
2. Select **Shader Wallpaper** as the wallpaper type
3. Click **Browse Gallery** to select a shader
4. Adjust settings like speed, FPS target, and input options

## 🔧 Troubleshooting

<details>
<summary><strong>Shader causes black screen or crashes</strong></summary>

Delete the configuration and restart:
```bash
rm -rf ~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/
pkill plasmashell && plasmashell &
```
</details>

<details>
<summary><strong>High CPU/GPU usage</strong></summary>

- Lower the target FPS (30 is often sufficient)
- Enable "Pause when maximized window" in settings
- Choose lighter shaders (check the performance tier indicator)
</details>

<details>
<summary><strong>Audio reactive features not working</strong></summary>

Ensure PipeWire is running and the shader supports audio (`iChannel` must be bound to audio input).
</details>

## 📖 Documentation

- **[Developer Guide](docs/DEVELOPMENT.md)** - Creating and importing custom shaders
- **[Architecture](docs/ARCHITECTURE.md)** - Project structure and technical details
- **[Contributing](CONTRIBUTING.md)** - How to contribute to the project

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

### Quick Start for Contributors

```bash
# Fork on GitHub, then clone your fork
git clone git@github.com:y4my4my4m/kde-shader-wallpaper.git
cd kde-shader-wallpaper

# Build and install
./scripts/build.sh install

# Test changes - restart plasmashell
pkill plasmashell && plasmashell &
```

## 📸 Screenshots

<p align="center">
  <img src="https://images.pling.com/img/00/00/58/32/49/1413010/ef67e0df43137d0d42b81afe700e83aa9cf2c911ab4619aa6ba072894a404c658546.png" width="400">
  <img src="https://images.pling.com/img/00/00/58/32/49/1413010/95ec8cf5ca97eac0504faa68b297355964a9c6d4e1e1e161609997356b9a6d75fe6d.png" width="400">
</p>

## 📜 License

This project is licensed under the GPL-3.0-or-later license. See [LICENSE](LICENSE) for details.

## 💖 Support

If you find this project useful, consider supporting its development:

[![ko-fi](https://www.ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I525V5R)

---

<p align="center">
  Made with ❤️ by <a href="https://twitter.com/y4my4my4m">@y4my4my4m</a>
</p>

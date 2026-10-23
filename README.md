# Shader Wallpaper for KDE Plasma 6

<p align="center">
  <img src="https://github.com/y4my4my4m/kde-shader-wallpaper/assets/8145020/6e2e6807-2be5-44c3-9d35-1c560e37cf74" alt="Shader Wallpaper" width="600">
</p>

<p align="center">
  <strong>Run beautiful GLSL shaders as your desktop wallpaper</strong>
</p>

<p align="center">
  <a href="https://store.kde.org/p/2143912/">
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

- **240+ Built-in Shaders** - Curated collection with previews, search, categories and favourites
- **Shadertoy Import** - Import shaders directly from shadertoy.com
- **Multi-Pass Rendering** - Full buffer support (A, B, C, D) for complex effects
- **Audio Reactive** - Shaders that respond to system audio via PipeWire
- **Mouse Interaction** - Full iMouse support on X11; on Wayland while the pointer is over the desktop (it keeps its last position over windows and panels)
- **Window Reactive** - Shaders react to your windows on X11 and Wayland: water ripples and wakes, plasma arcs, a test-chamber HUD
- **Automatic Shader Changes** - Rotate through a playlist, your favourites or the whole library, in order or shuffled
- **Multi-Monitor** - Apply one configuration to every screen; screen offset uniforms for spanning shaders
- **Performance Monitoring** - Real-time FPS, GPU frame time and power estimates
- **Preset System** - Save and share complete configurations, including channel routing

## 📦 Installation

Shader Wallpaper has two parts: the wallpaper package (QML, shaders, previews) and a small native engine that renders through OpenGL and reads audio, mouse and windows. The engine is compiled for your system.

### KDE Store

1. Right-click the desktop → **Desktop and Wallpaper** → **Get New Plugins…**, search for **Shader Wallpaper** and press **Install**.
2. Choose **Shader Wallpaper** as the wallpaper type. The settings page shows **Finish installing Shader Wallpaper**:
   1. **Install the build tools** shows the command for your distribution, with a Copy button.
   2. **Build and Install** opens a terminal that compiles the engine (about a minute) and offers to install missing build tools.
   3. **Restart Plasma**, or log out and back in.

The store can deliver only the package, so the engine is built after each store update as well; the settings page appears again when that is needed. The same steps from a terminal:

```bash
bash ~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/scripts/build.sh
```

### Distribution packages

Packages include the engine, so there is no setup step.

- **Arch Linux, Manjaro**: `cd packaging/arch && makepkg -si`
- **Fedora, openSUSE**: build an RPM from `packaging/rpm/plasma-wallpaper-shader.spec`

### From source

```bash
git clone https://github.com/y4my4my4m/kde-shader-wallpaper.git
cd kde-shader-wallpaper
./scripts/build.sh deps             # dependency command for your distribution
./scripts/build.sh                  # build and install to ~/.local
./scripts/build.sh restart-plasma
```

<details>
<summary><strong>Build dependencies</strong></summary>

`./scripts/build.sh deps` prints the command for the running distribution, and the build offers to run it.

```bash
# Arch Linux, Manjaro
sudo pacman -S --needed base-devel cmake extra-cmake-modules qt6-base qt6-declarative kconfig ki18n kpackage libplasma libpipewire libxcb plasma-workspace

# Fedora
sudo dnf install gcc-c++ make cmake extra-cmake-modules 'cmake(Qt6Quick)' 'cmake(Qt6OpenGL)' 'cmake(KF6Config)' 'cmake(KF6I18n)' 'cmake(KF6Package)' 'cmake(Plasma)' 'cmake(PlasmaQuick)' 'pkgconfig(libpipewire-0.3)' 'pkgconfig(xcb)' 'cmake(LibTaskManager)'

# openSUSE
sudo zypper install gcc-c++ make cmake kf6-extra-cmake-modules 'cmake(Qt6Quick)' 'cmake(Qt6OpenGL)' 'cmake(KF6Config)' 'cmake(KF6I18n)' 'cmake(KF6Package)' 'cmake(Plasma)' 'cmake(PlasmaQuick)' 'pkgconfig(libpipewire-0.3)' 'pkgconfig(xcb)' 'cmake(LibTaskManager)'

# Debian 13+, Ubuntu 25.04+, KDE neon
sudo apt install build-essential cmake extra-cmake-modules pkg-config qt6-base-dev qt6-declarative-dev libkf6config-dev libkf6i18n-dev libkf6package-dev libkf6windowsystem-dev libkirigami-dev libplasma-dev libpipewire-0.3-dev libxcb1-dev plasma-workspace-dev
```

PipeWire, XCB and Plasma's task manager library (libtaskmanager, from plasma-workspace) are optional: without them the engine builds without sound reactivity, X11 mouse and window tracking, or window tracking on Wayland.
</details>

### Uninstall

- **KDE Store**: Get New Plugins → **Uninstall**.
- **Any install in your home folder**, including the engine build cache:

  ```bash
  bash ~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/scripts/build.sh uninstall
  ```

Favorites, generated thumbnails, imported shaders, saved packages and presets live in `~/.local/share/shaderwallpaper/` and survive upgrades and reinstalls. Delete that directory to remove them.

### Login screen (Plasma Login Manager)

Shader Wallpaper works on the sign-in screen if you use [Plasma Login Manager](https://wiki.archlinux.org/title/Plasma_Login_Manager) (PLM). It does **not** work with SDDM or other display managers.

PLM runs as the `plasmalogin` user before anyone logs in, so it cannot read your home folder. Two requirements:

1. The plugin must be installed system-wide in `/usr` (KDE Store / `~/.local` is not visible to PLM).
2. `/etc/plasmalogin.conf` must register the plugin — PLM's wallpaper dropdown hides third-party plugins ([KDE bug 517325](https://bugs.kde.org/show_bug.cgi?id=517325)).

The wallpaper settings UI has a **Login screen** card that handles both. From git or a KDE Store install:

```bash
# from a git checkout
./scripts/install-plm-greeter.sh

# from a KDE Store install
bash ~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/scripts/install-plm-greeter.sh
```

The script builds the engine, installs everything to `/usr` (sudo), then writes:

```ini
# /etc/plasmalogin.conf
[Greeter]
WallpaperPluginId=online.knowmad.shaderwallpaper
```

Log out — you'll see Shader Wallpaper with the default shader. To change it:

**System Settings → Login Screen → ⋮ → Configure Appearance…** (ignore the "Wallpaper type" dropdown on the main page; it can't list us)

Your `~/.local` install keeps powering the desktop and lock screen. Having both is normal.

Remove the registration only (leaves the `/usr` install in place):

```bash
sudo ./scripts/install-plm-greeter.sh --uninstall
```

| Surface | Config file | Install location |
|---------|-------------|------------------|
| Desktop | `~/.config/plasma-org.kde.plasma.desktop-appletsrc` | `~/.local` or `/usr` |
| Lock screen | `~/.config/kscreenlockerrc` | `~/.local` or `/usr` |
| Login (PLM) | `/etc/plasmalogin.conf` + System Settings | **`/usr` only** |

## 🎮 Usage

1. Right-click your desktop → **Configure Desktop and Wallpaper**
2. Select **Shader Wallpaper** as the wallpaper type
3. Pick a shader in the **Gallery** tab (search with Ctrl+F, right-click a card for more), or press **Shuffle**
4. **Playback** sets speed, frame rate, resolution, when to pause and automatic shader changes
5. **Inputs** turns on mouse, sound and window reactivity and assigns images to shaders that use them
6. **Advanced** holds buffers and channel routing, the code editor, presets and packages

## 🔧 Troubleshooting

<details>
<summary><strong>Shader causes black screen or crashes</strong></summary>

Switch the desktop to a plain image, then pick a different shader in the settings:
```bash
plasma-apply-wallpaperimage /usr/share/wallpapers/Next
```
If Plasma itself does not come up, restart it after that with `plasmashell --replace &`.
</details>

<details>
<summary><strong>High CPU/GPU usage</strong></summary>

- Lower the target FPS (30 is often sufficient)
- The lock screen has its own copy of these settings: System Settings → Screen Locking → Appearance
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

# Load the new build
./scripts/build.sh restart-plasma
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

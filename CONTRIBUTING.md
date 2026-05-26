# Contributing to Shader Wallpaper

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Shader Contributions](#shader-contributions)

## How Can I Contribute?

### 🐛 Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/y4my4my4m/kde-shader-wallpaper/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - System info (KDE version, GPU, X11/Wayland)
   - Shader being used (if relevant)

### 💡 Suggesting Features

Open an issue with the `enhancement` label including:
- Clear description of the feature
- Use case / problem it solves
- Possible implementation approach

### 🎨 Contributing Shaders

See [Shader Contributions](#shader-contributions) below.

### 🔧 Code Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test on both X11 and Wayland if possible
5. Submit a Pull Request

## Development Setup

### Prerequisites

```bash
# Arch Linux / Manjaro
sudo pacman -S qt6-base qt6-declarative libplasma kf6-kconfig \
    kf6-ki18n kf6-kpackage pipewire libpipewire xcb-util \
    extra-cmake-modules cmake

# Ubuntu / Debian
sudo apt install qt6-base-dev qt6-declarative-dev libplasma-dev \
    libkf6config-dev libkf6i18n-dev libkf6package-dev \
    libpipewire-0.3-dev libxcb1-dev extra-cmake-modules cmake
```

### Building

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/kde-shader-wallpaper.git
cd kde-shader-wallpaper

# Build
./scripts/build.sh

# Install for testing
cd build && make install
```

### Testing Changes

```bash
# Restart plasmashell to see changes
pkill plasmashell && plasmashell &

# Or use plasmoidviewer for isolated testing
plasmoidviewer -a online.knowmad.shaderwallpaper
```

## Pull Request Process

1. **Update Documentation**: If you change behavior, update relevant docs
2. **Test Thoroughly**: Test on your system before submitting
3. **Keep It Focused**: One feature/fix per PR
4. **Write Good Commits**: Use clear, descriptive commit messages

### Commit Message Format

```
type: Short description

Longer description if needed.

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Example

```
feat: Add shader preview in gallery cards

Adds real-time mini previews to the gallery view when hovering
over shader cards. Uses a low-resolution render for performance.

Fixes #42
```

## Style Guidelines

### QML

- Use 4 spaces for indentation
- Follow [Qt QML Coding Conventions](https://doc.qt.io/qt-6/qml-codingconventions.html)
- Use Kirigami components where appropriate
- Add SPDX license headers to new files

### C++

- Use 4 spaces for indentation
- Follow [Qt Coding Style](https://wiki.qt.io/Qt_Coding_Style)
- Use modern C++ (C++17)
- Add SPDX license headers to new files

### Python Scripts

- Follow PEP 8
- Use 4 spaces for indentation
- Add docstrings to functions

## Shader Contributions

### Adding New Shaders

1. Place your shader in `package/contents/ui/Shaders/`
2. Ensure it has proper attribution in comments:
   ```glsl
   // Shader Name
   // Author: Your Name
   // Source: URL (if from Shadertoy or elsewhere)
   // License: CC-BY or similar
   ```
3. Compile with `python scripts/shader_compiler.py`
4. Test that it works without errors
5. Submit a PR

### Shader Guidelines

- **Performance**: Test on mid-range hardware
- **Compatibility**: Must work with qsb compilation
- **Attribution**: Always credit original authors
- **License**: Prefer permissively licensed shaders

### Shader Categories

When adding shaders, assign an appropriate category:
- Fractal
- Raymarching
- Space
- Nature
- Retro
- Noise
- Geometric
- Audio Reactive
- 3D
- 2D
- Abstract

## Questions?

- Open a [GitHub Discussion](https://github.com/y4my4my4m/kde-shader-wallpaper/discussions)
- Reach out on Twitter [@y4my4my4m](https://twitter.com/y4my4my4m)

---

Thank you for contributing! 🎉


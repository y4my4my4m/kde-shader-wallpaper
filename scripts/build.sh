#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Build & Install script for Shader Wallpaper v4.0

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_TYPE="${BUILD_TYPE:-Release}"
INSTALL_PREFIX="${INSTALL_PREFIX:-$HOME/.local}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           Shader Wallpaper v4.0 - Build Script            ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}➤${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_dependencies() {
    print_step "Checking dependencies..."
    
    local missing=()
    
    # Check for cmake
    if ! command -v cmake &> /dev/null; then
        missing+=("cmake")
    fi
    
    # Check for make/ninja
    if ! command -v make &> /dev/null && ! command -v ninja &> /dev/null; then
        missing+=("make or ninja")
    fi
    
    # Check for pkg-config
    if ! command -v pkg-config &> /dev/null; then
        missing+=("pkg-config")
    fi
    
    # Check for Qt6
    if ! pkg-config --exists Qt6Core 2>/dev/null; then
        missing+=("qt6-base")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing[*]}"
        echo ""
        echo "Install them with:"
        echo ""
        echo "  Arch/Manjaro:"
        echo "    sudo pacman -S cmake extra-cmake-modules qt6-base qt6-declarative \\"
        echo "        libplasma pipewire libpipewire"
        echo ""
        echo "  Ubuntu/Debian (24.04+):"
        echo "    sudo apt install cmake extra-cmake-modules qt6-base-dev \\"
        echo "        qt6-declarative-dev libplasma-dev libpipewire-0.3-dev libxcb1-dev"
        echo ""
        echo "  Fedora:"
        echo "    sudo dnf install cmake extra-cmake-modules qt6-qtbase-devel \\"
        echo "        qt6-qtdeclarative-devel libplasma-devel pipewire-devel"
        echo ""
        exit 1
    fi
    
    echo "  All dependencies found!"
}

build() {
    print_step "Configuring build..."
    mkdir -p "$PROJECT_DIR/build"
    cd "$PROJECT_DIR/build"

    # If the cached prefix doesn't match what we're configuring for, nuke
    # the cache. KDE's ECM bakes Qt6's compile-time install paths into
    # cmake_install.cmake on first configure (e.g. /usr/lib/qt6/qml/...),
    # and a plain re-configure won't update them — leading to "permission
    # denied" install failures when switching from --system to install.
    if [ -f CMakeCache.txt ] \
        && ! grep -q "^CMAKE_INSTALL_PREFIX:PATH=$INSTALL_PREFIX$" CMakeCache.txt; then
        print_warning "Cached install prefix differs from \$INSTALL_PREFIX ($INSTALL_PREFIX); clearing stale cache."
        rm -f CMakeCache.txt
        rm -rf CMakeFiles
    fi

    cmake -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
          -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \
          ..

    print_step "Building..."
    make -j$(nproc)

    echo -e "${GREEN}✓${NC} Build complete!"
}

install_local() {
    print_step "Installing to $INSTALL_PREFIX..."
    cd "$PROJECT_DIR/build"
    make install
    
    echo -e "${GREEN}✓${NC} Installation complete!"
    echo ""
    echo "To apply changes, restart plasmashell:"
    echo "  pkill plasmashell && plasmashell &"
}

install_system() {
    print_step "Installing system-wide (requires sudo)..."
    cd "$PROJECT_DIR/build"
    sudo make install
    
    echo -e "${GREEN}✓${NC} System installation complete!"
}

uninstall() {
    print_step "Uninstalling..."
    
    # Try kpackagetool first
    if kpackagetool6 -t Plasma/Wallpaper --remove online.knowmad.shaderwallpaper 2>/dev/null; then
        echo "  Removed via kpackagetool6"
    fi
    
    # Remove local installation
    rm -rf "$HOME/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper" 2>/dev/null || true
    rm -rf "$HOME/.local/lib/qt6/qml/online/knowmad/shaderwallpaper" 2>/dev/null || true
    
    echo -e "${GREEN}✓${NC} Uninstalled!"
}

show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build the project (default)"
    echo "  install     Build and install to ~/.local"
    echo "  system      Build and install system-wide"
    echo "  uninstall   Remove the wallpaper plugin"
    echo "  clean       Remove build directory"
    echo "  help        Show this help"
    echo ""
    echo "  PLM login screen: ./scripts/install-plm-greeter.sh"
    echo "  (requires system install — see README)"
    echo ""
    echo "Environment variables:"
    echo "  BUILD_TYPE      Release or Debug (default: Release)"
    echo "  INSTALL_PREFIX  Installation prefix (default: ~/.local)"
}

# Main
print_header

case "${1:-install}" in
    build)
        check_dependencies
        build
        ;;
    install)
        check_dependencies
        build
        install_local
        ;;
    system)
        check_dependencies
        INSTALL_PREFIX="/usr"
        build
        install_system
        ;;
    uninstall)
        uninstall
        ;;
    clean)
        print_step "Cleaning build directory..."
        rm -rf "$PROJECT_DIR/build"
        echo -e "${GREEN}✓${NC} Clean!"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

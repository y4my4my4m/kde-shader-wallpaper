#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Shader Wallpaper v4.0 - Plugin Installer
# This script downloads the source and builds the C++ plugin

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# HTTPS clone — works without the user having SSH keys set up.
REPO_URL="https://github.com/y4my4my4m/kde-shader-wallpaper.git"
BUILD_DIR="$HOME/.cache/shader-wallpaper-build"
INSTALL_PREFIX="$HOME/.local"

print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║       Shader Wallpaper - Plugin Installer                 ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}➤${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

check_dependencies() {
    print_step "Checking dependencies..."
    
    local missing=()
    
    command -v git &> /dev/null || missing+=("git")
    command -v cmake &> /dev/null || missing+=("cmake")
    command -v make &> /dev/null || missing+=("make")
    pkg-config --exists Qt6Core 2>/dev/null || missing+=("qt6-base")
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing: ${missing[*]}"
        echo ""
        echo "Please install dependencies first:"
        echo ""
        echo -e "${YELLOW}Arch/Manjaro:${NC}"
        echo "  sudo pacman -S git cmake extra-cmake-modules qt6-base qt6-declarative libplasma pipewire libpipewire xcb-util"
        echo ""
        echo -e "${YELLOW}Ubuntu/Debian:${NC}"
        echo "  sudo apt install git cmake extra-cmake-modules build-essential qt6-base-dev qt6-declarative-dev libplasma-dev libpipewire-0.3-dev libxcb1-dev"
        echo ""
        echo -e "${YELLOW}Fedora:${NC}"
        echo "  sudo dnf install git cmake extra-cmake-modules gcc-c++ qt6-qtbase-devel qt6-qtdeclarative-devel libplasma-devel pipewire-devel libxcb-devel"
        echo ""
        exit 1
    fi
    
    print_success "All dependencies found!"
}

download_source() {
    print_step "Downloading source code..."
    
    # Clean previous build
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    
    # Clone the repository
    git clone --depth 1 "$REPO_URL" "$BUILD_DIR/kde-shader-wallpaper"
    
    print_success "Source downloaded!"
}

build_plugin() {
    print_step "Building plugin..."
    
    cd "$BUILD_DIR/kde-shader-wallpaper"
    mkdir -p build
    cd build
    
    cmake -DCMAKE_BUILD_TYPE=Release \
          -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \
          ..
    
    make -j$(nproc)
    
    print_success "Build complete!"
}

install_plugin() {
    print_step "Installing plugin..."
    
    cd "$BUILD_DIR/kde-shader-wallpaper/build"
    make install
    
    print_success "Plugin installed!"
}

cleanup() {
    print_step "Cleaning up..."
    rm -rf "$BUILD_DIR"
    print_success "Done!"
}

show_complete() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Installation complete!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "To activate, restart Plasma:"
    echo ""
    echo -e "  ${YELLOW}pkill plasmashell && plasmashell &${NC}"
    echo ""
    echo "Then right-click your desktop → Configure Desktop"
    echo "and select Shader Wallpaper."
    echo ""
}

# Main
print_header

echo "This will download and build the Shader Wallpaper plugin."
echo "Installation directory: $INSTALL_PREFIX"
echo ""
read -p "Continue? [Y/n] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
    echo "Cancelled."
    exit 0
fi

check_dependencies
download_source
build_plugin
install_plugin
cleanup
show_complete

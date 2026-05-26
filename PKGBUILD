# Maintainer: y4my4my4m <y4my4m@protonmail.com>
# AUR Package for Shader Wallpaper

pkgname=plasma6-wallpapers-shader
pkgver=4.0.0
pkgrel=1
pkgdesc="Run GLSL shaders as your KDE Plasma 6 wallpaper"
arch=('x86_64' 'aarch64')
url="https://github.com/y4my4my4m/kde-shader-wallpaper"
license=('GPL3')
depends=(
    'plasma-workspace'
    'qt6-base'
    'qt6-declarative'
    'pipewire'
    'libpipewire'
)
makedepends=(
    'cmake'
    'extra-cmake-modules'
    'git'
    'qt6-tools'
)
optdepends=(
    'pipewire-pulse: for audio reactive shaders'
)
source=("git+https://github.com/y4my4my4m/kde-shader-wallpaper.git")
sha256sums=('SKIP')

build() {
    cd "$srcdir/kde-shader-wallpaper"
    cmake -B build \
        -DCMAKE_INSTALL_PREFIX=/usr \
        -DCMAKE_BUILD_TYPE=Release
    cmake --build build
}

package() {
    cd "$srcdir/kde-shader-wallpaper"
    DESTDIR="$pkgdir" cmake --install build
}


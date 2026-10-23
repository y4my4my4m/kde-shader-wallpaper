# Fedora and openSUSE. Build with:
#   spectool -g -R plasma-wallpaper-shader.spec && rpmbuild -ba plasma-wallpaper-shader.spec

Name:           plasma-wallpaper-shader
Version:        4.2.1
Release:        1%{?dist}
Summary:        Run GLSL shaders as your KDE Plasma 6 wallpaper
License:        GPL-3.0-or-later
URL:            https://github.com/y4my4my4m/kde-shader-wallpaper
Source0:        %{url}/archive/v%{version}/kde-shader-wallpaper-%{version}.tar.gz

BuildRequires:  cmake
BuildRequires:  gcc-c++
%if 0%{?suse_version}
BuildRequires:  kf6-extra-cmake-modules
%else
BuildRequires:  extra-cmake-modules
%endif
BuildRequires:  cmake(Qt6Core)
BuildRequires:  cmake(Qt6DBus)
BuildRequires:  cmake(Qt6Gui)
BuildRequires:  cmake(Qt6Network)
BuildRequires:  cmake(Qt6OpenGL)
BuildRequires:  cmake(Qt6Qml)
BuildRequires:  cmake(Qt6Quick)
BuildRequires:  cmake(KF6Config)
BuildRequires:  cmake(KF6I18n)
BuildRequires:  cmake(KF6Package)
BuildRequires:  cmake(KF6WindowSystem)
BuildRequires:  cmake(LibTaskManager)
BuildRequires:  cmake(Plasma)
BuildRequires:  cmake(PlasmaQuick)
BuildRequires:  pkgconfig(libpipewire-0.3)
BuildRequires:  pkgconfig(xcb)

%if 0%{?suse_version}
Requires:       plasma6-workspace
%else
Requires:       plasma-workspace
%endif

%description
Shader Wallpaper runs GLSL shaders as the KDE Plasma 6 desktop and lock screen
wallpaper, with multi-pass rendering, audio and window reactivity, and
Shadertoy import.

%prep
%autosetup -n kde-shader-wallpaper-%{version}

%build
# Explicit directories: KDEInstallDirs derives libexec from the library
# directory, which differs between the two distributions.
%cmake \
    -DKDE_INSTALL_LIBEXECDIR=%{_libexecdir} \
    -DKDE_INSTALL_QMLDIR=%{_libdir}/qt6/qml
%cmake_build

%install
%cmake_install

%files
%license LICENSE
%doc README.md
%{_datadir}/plasma/wallpapers/online.knowmad.shaderwallpaper/
%{_libdir}/qt6/qml/online/
%{_libexecdir}/shaderwallpaper/

%changelog
* Fri Oct 23 2026 y4my4my4m <y4my4m@protonmail.com> - 4.2.1-1
- Release 4.2.1

* Thu Oct 22 2026 y4my4my4m <y4my4m@protonmail.com> - 4.2.0-1
- Release 4.2.0

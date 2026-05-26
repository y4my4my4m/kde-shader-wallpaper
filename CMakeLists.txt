# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

cmake_minimum_required(VERSION 3.22)

project(plasma-wallpaper-shader VERSION 4.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

# KDE ECM setup
find_package(ECM 6.0.0 REQUIRED NO_MODULE)
set(CMAKE_MODULE_PATH ${ECM_MODULE_PATH})

include(KDEInstallDirs)
include(KDECMakeSettings)
include(KDECompilerSettings NO_POLICY_SCOPE)
include(ECMQmlModule)
include(FeatureSummary)

# Qt6 dependencies
find_package(Qt6 6.6 REQUIRED COMPONENTS
    Core
    Quick
    Qml
    Gui
    OpenGL
    Network
    Multimedia
)

# KDE Frameworks 6 dependencies
find_package(KF6 6.0.0 REQUIRED COMPONENTS
    Config
    I18n
    Package
)

# Plasma library (separate from KF6)
find_package(Plasma REQUIRED)
find_package(PlasmaQuick REQUIRED)

# Optional: PipeWire for audio capture
find_package(PkgConfig REQUIRED)
pkg_check_modules(PIPEWIRE libpipewire-0.3)
if(PIPEWIRE_FOUND)
    add_compile_definitions(HAVE_PIPEWIRE)
    message(STATUS "PipeWire found - audio capture enabled")
else()
    message(STATUS "PipeWire not found - audio capture disabled")
endif()

# Optional: XCB for X11 cursor tracking
pkg_check_modules(XCB xcb)
if(XCB_FOUND)
    add_compile_definitions(HAVE_XCB)
    message(STATUS "XCB found - X11 cursor tracking enabled")
endif()

# Wayland protocols for cursor tracking
find_package(Wayland COMPONENTS Client)
find_package(WaylandProtocols)
if(Wayland_FOUND)
    add_compile_definitions(HAVE_WAYLAND)
    message(STATUS "Wayland found - Wayland cursor tracking enabled")
endif()

# Shader compilation (glslang or shaderc)
pkg_check_modules(SHADERC shaderc)
if(SHADERC_FOUND)
    add_compile_definitions(HAVE_SHADERC)
    message(STATUS "shaderc found - runtime shader compilation enabled")
else()
    # Try glslang as fallback
    find_package(glslang)
    if(glslang_FOUND)
        add_compile_definitions(HAVE_GLSLANG)
        message(STATUS "glslang found - runtime shader compilation enabled")
    else()
        message(STATUS "Neither shaderc nor glslang found - using precompiled shaders only")
    endif()
endif()

# Add subdirectories
add_subdirectory(src)

# Feature summary
feature_summary(WHAT ALL FATAL_ON_MISSING_REQUIRED_PACKAGES)


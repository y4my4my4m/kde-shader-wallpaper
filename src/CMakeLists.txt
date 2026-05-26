# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

# Define package output directory - this is where kpackagetool6 will install from
set(PACKAGE_DIR "${CMAKE_SOURCE_DIR}/package")
set(PACKAGE_UI_DIR "${PACKAGE_DIR}/contents/ui")
set(PLUGIN_OUTPUT_DIR "${PACKAGE_UI_DIR}/shaderwallpaper")

# Collect all source files
set(SHADER_WALLPAPER_SOURCES
    # Core
    core/shaderengine.cpp
    core/shaderbuffer.cpp
    core/shadercompiler.cpp
    core/uniformmanager.cpp
    core/performancemonitor.cpp
    
    # Input
    input/cursortracker.cpp
    input/audiocapture.cpp
    input/windowtracker.cpp
    input/virtualdesktopwatcher.cpp
    
    # Import
    import/shadertoyapi.cpp
    import/shaderconverter.cpp
    
    # Data
    data/presetmanager.cpp
    data/shadermetadata.cpp
    data/shaderlibrary.cpp
    data/plmgreetersetup.cpp
    
    # Models
    models/shaderlistmodel.cpp
    models/categorymodel.cpp
)

set(SHADER_WALLPAPER_HEADERS
    # Core
    core/shaderengine.h
    core/shaderbuffer.h
    core/shadercompiler.h
    core/uniformmanager.h
    core/performancemonitor.h
    
    # Input
    input/cursortracker.h
    input/audiocapture.h
    input/windowtracker.h
    input/virtualdesktopwatcher.h
    
    # Import
    import/shadertoyapi.h
    import/shaderconverter.h
    
    # Data
    data/presetmanager.h
    data/shadermetadata.h
    data/shaderlibrary.h
    data/plmgreetersetup.h
    
    # Models
    models/shaderlistmodel.h
    models/categorymodel.h
)

# Set output directory BEFORE creating the module so it builds into the package
set(QML_IMPORT_PATH "${PACKAGE_UI_DIR}" CACHE STRING "" FORCE)

# Create the QML plugin - output directly to package directory
ecm_add_qml_module(shaderwallpaperplugin
    URI "online.knowmad.shaderwallpaper"
    VERSION 1.0
    OUTPUT_DIRECTORY "${PLUGIN_OUTPUT_DIR}"
    SOURCES
        plugin/shaderwallpaperplugin.cpp
        plugin/shaderwallpaperplugin.h
        ${SHADER_WALLPAPER_SOURCES}
        ${SHADER_WALLPAPER_HEADERS}
    # Don't include QML files in the module - they stay in the package as regular files
)

target_include_directories(shaderwallpaperplugin PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/core
    ${CMAKE_CURRENT_SOURCE_DIR}/input
    ${CMAKE_CURRENT_SOURCE_DIR}/import
    ${CMAKE_CURRENT_SOURCE_DIR}/data
    ${CMAKE_CURRENT_SOURCE_DIR}/models
)

target_link_libraries(shaderwallpaperplugin PRIVATE
    Qt6::Core
    Qt6::Quick
    Qt6::Qml
    Qt6::Gui
    Qt6::OpenGL
    Qt6::Network
    Qt6::Multimedia
    Qt6::DBus
    Plasma::Plasma
    Plasma::PlasmaQuick
    KF6::ConfigCore
    KF6::I18n
    KF6::Package
)

# Link optional dependencies
if(PIPEWIRE_FOUND)
    target_include_directories(shaderwallpaperplugin PRIVATE ${PIPEWIRE_INCLUDE_DIRS})
    target_link_libraries(shaderwallpaperplugin PRIVATE ${PIPEWIRE_LIBRARIES})
endif()

if(XCB_FOUND)
    target_include_directories(shaderwallpaperplugin PRIVATE ${XCB_INCLUDE_DIRS})
    target_link_libraries(shaderwallpaperplugin PRIVATE ${XCB_LIBRARIES})
endif()

if(Wayland_FOUND)
    target_link_libraries(shaderwallpaperplugin PRIVATE Wayland::Client)
endif()

if(SHADERC_FOUND)
    target_include_directories(shaderwallpaperplugin PRIVATE ${SHADERC_INCLUDE_DIRS})
    target_link_libraries(shaderwallpaperplugin PRIVATE ${SHADERC_LIBRARIES})
elseif(glslang_FOUND)
    target_link_libraries(shaderwallpaperplugin PRIVATE glslang::glslang glslang::SPIRV)
endif()

target_compile_definitions(shaderwallpaperplugin PRIVATE
    PLM_GREETER_HELPER_PATH="${KDE_INSTALL_FULL_LIBEXECDIR}/shaderwallpaper/enable-plm-greeter")

install(PROGRAMS ${CMAKE_SOURCE_DIR}/scripts/enable-plm-greeter.sh
        DESTINATION ${KDE_INSTALL_LIBEXECDIR}/shaderwallpaper
        RENAME enable-plm-greeter)

# Finalize the QML module (generates qmldir, qmltypes).
#
# We explicitly pass DESTINATION to install the module relative to
# CMAKE_INSTALL_PREFIX (so user-prefix installs land at
# $PREFIX/lib/qml/online/knowmad/shaderwallpaper/) instead of letting ECM
# fall back to Qt6's compile-time absolute QT6_INSTALL_QML — that fallback
# bakes /usr/lib/qt6/qml into the generated cmake_install.cmake and makes
# the install rule require root regardless of CMAKE_INSTALL_PREFIX.
ecm_finalize_qml_module(shaderwallpaperplugin
    DESTINATION ${KDE_INSTALL_QMLDIR}
)

# After build, overwrite the ECM-generated qmldir with correct paths for kpackage structure
# The QML files are siblings to the shaderwallpaper/ folder, so paths are "../filename.qml"
# We use a script file to avoid escaping issues in the custom command
configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/qmldir.in"
    "${CMAKE_CURRENT_BINARY_DIR}/qmldir.generated"
    @ONLY
)

add_custom_command(TARGET shaderwallpaperplugin POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
        "${CMAKE_CURRENT_BINARY_DIR}/qmldir.generated"
        "${PLUGIN_OUTPUT_DIR}/qmldir"
    COMMENT "Installing kpackage-compatible qmldir"
)

# Copy PluginStatus.qml (returns installed: true) to replace the stub
add_custom_command(TARGET shaderwallpaperplugin POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
        "${CMAKE_CURRENT_SOURCE_DIR}/qml/PluginStatus.qml"
        "${PLUGIN_OUTPUT_DIR}/PluginStatus.qml"
    COMMENT "Installing PluginStatus.qml (marks plugin as installed)"
)

# Install the Plasma wallpaper package (for system-wide installation)
plasma_install_package(${CMAKE_SOURCE_DIR}/package online.knowmad.shaderwallpaper wallpapers)

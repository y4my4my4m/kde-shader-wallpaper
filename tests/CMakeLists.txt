# SPDX-License-Identifier: GPL-3.0-or-later

find_package(Qt6 6.6 REQUIRED COMPONENTS Widgets QuickTest Test)
find_package(Python3 REQUIRED COMPONENTS Interpreter)
find_program(DBUS_RUN_SESSION dbus-run-session REQUIRED)

add_executable(shader-config-tests configtest.cpp)
target_link_libraries(shader-config-tests PRIVATE
    Qt6::Widgets Qt6::Quick Qt6::QuickTest Qt6::Test
    KF6::ConfigGui KF6::ConfigQml KF6::I18nQml)
target_compile_definitions(shader-config-tests PRIVATE
    QUICK_TEST_SOURCE_DIR="${CMAKE_CURRENT_SOURCE_DIR}")
add_dependencies(shader-config-tests shaderwallpaperplugin)

add_test(NAME shader-wallpaper-configuration
    COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/run_configuration_tests.py
        $<TARGET_FILE:shader-config-tests> ${PROJECT_SOURCE_DIR})
set_tests_properties(shader-wallpaper-configuration PROPERTIES TIMEOUT 120)

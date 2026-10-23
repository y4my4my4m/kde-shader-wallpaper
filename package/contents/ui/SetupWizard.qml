// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasma5support as P5Support

// Settings page while the native engine is missing (KDE Store installs, and
// after every store update). Three steps: build dependencies for the detected
// distribution, a build that runs in a terminal window, a Plasma restart.
// contents/scripts/build.sh does the shell work; its `--porcelain` output is
// key=value lines.
Item {
    id: root

    // EngineStatus.error of this process.
    property string engineError: ""

    readonly property string scriptPath: localPath(Qt.resolvedUrl("../scripts/build.sh"))
    readonly property string helpUrl: "https://github.com/y4my4my4m/kde-shader-wallpaper#installation"
    readonly property string issuesUrl: "https://github.com/y4my4my4m/kde-shader-wallpaper/issues"

    // build.sh deps --porcelain
    property bool depsLoaded: false
    property string detectedFamily: ""
    property string osName: ""
    property var missingDeps: []
    property var optionalMissing: []
    property var commands: ({})
    property string family: ""

    // build.sh status --porcelain: missing | building | failed | installed
    property string engineState: ""
    property string logPath: ""
    property string version: ""
    property bool launching: false
    property bool launchFailed: false

    readonly property var families: [
        { id: "arch",     name: i18nc("@item:inlistbox distribution", "Arch Linux, Manjaro, EndeavourOS") },
        { id: "fedora",   name: i18nc("@item:inlistbox distribution", "Fedora") },
        { id: "opensuse", name: i18nc("@item:inlistbox distribution", "openSUSE") },
        { id: "debian",   name: i18nc("@item:inlistbox distribution", "Debian, Ubuntu, KDE neon") }
    ]

    readonly property var depLabels: ({
        cmake: i18n("CMake"),
        compiler: i18n("C++ compiler"),
        make: i18n("make"),
        pkgconfig: i18n("pkg-config"),
        ecm: i18n("Extra CMake Modules"),
        qt: i18n("Qt 6 development files"),
        kf6: i18n("KDE Frameworks 6 development files"),
        plasma: i18n("Plasma 6 development files"),
        pipewire: i18n("PipeWire (sound-reactive shaders)"),
        xcb: i18n("XCB (mouse and windows on X11)"),
        wayland: i18n("Wayland client (mouse on Wayland)"),
        taskmanager: i18n("Plasma task manager library (windows on Wayland)")
    })

    function localPath(url) {
        const s = url.toString()
        return s.startsWith("file://") ? decodeURIComponent(s.substring(7)) : s
    }
    function shellQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'" }
    function scriptCommand(args) { return "bash " + shellQuote(scriptPath) + " " + args }
    function parseKeyValues(text) {
        const map = {}
        String(text).split("\n").forEach(function(line) {
            const i = line.indexOf("=")
            if (i > 0) map[line.substring(0, i)] = line.substring(i + 1)
        })
        return map
    }
    function idList(csv) { return csv ? csv.split(",").filter(function(s) { return s.length > 0 }) : [] }
    function labelList(ids) {
        return ids.map(function(id) { return depLabels[id] || id }).join(i18nc("list separator", ", "))
    }
    function familyIndex(id) {
        for (let i = 0; i < families.length; i++) if (families[i].id === id) return i
        return -1
    }

    function refreshDeps() {
        shell.run(scriptCommand("deps --porcelain"), function(code, out) {
            const kv = parseKeyValues(out)
            detectedFamily = kv.detected || ""
            osName = kv.os || ""
            missingDeps = idList(kv.missing)
            optionalMissing = idList(kv.optional_missing)
            const cmds = {}
            families.forEach(function(f) { if (kv["cmd." + f.id]) cmds[f.id] = kv["cmd." + f.id] })
            commands = cmds
            if (family === "" && familyIndex(detectedFamily) >= 0) family = detectedFamily
            depsLoaded = true
        })
    }

    function refreshStatus() {
        shell.run(scriptCommand("status --porcelain"), function(code, out) {
            const kv = parseKeyValues(out)
            if (!kv.state) return
            const previous = engineState
            engineState = kv.state
            logPath = kv.log || ""
            version = kv.version || ""
            // Packages installed by the build change what deps reports.
            if (previous === "building" && engineState !== "building") refreshDeps()
        })
    }

    function startBuild() {
        launching = true
        launchFailed = false
        shell.run(scriptCommand("install --terminal"), function(code) {
            launching = false
            launchFailed = code !== 0
            if (!launchFailed) engineState = "building"
            statusTimer.restart()
        })
    }

    function restartPlasma() {
        shell.run(scriptCommand("restart-plasma"), function() {})
    }

    function copyText(text) {
        clipboard.text = text
        clipboard.selectAll()
        clipboard.copy()
        clipboard.text = ""
    }

    Component.onCompleted: {
        refreshDeps()
        refreshStatus()
    }

    P5Support.DataSource {
        id: shell
        engine: "executable"
        connectedSources: []
        property var callbacks: ({})

        function run(command, callback) {
            callbacks[command] = callback
            connectSource(command)
        }

        onNewData: function(source, data) {
            const callback = callbacks[source]
            delete callbacks[source]
            disconnectSource(source)
            if (callback) callback(data["exit code"], data["stdout"] || "", data["stderr"] || "")
        }
    }

    // Follows a build running in the terminal, or one started by hand.
    Timer {
        id: statusTimer
        interval: root.engineState === "building" ? 1500 : 4000
        repeat: true
        running: root.visible
        onTriggered: root.refreshStatus()
    }

    TextEdit {
        id: clipboard
        visible: false
    }

    component CommandBox: Rectangle {
        id: box
        property string command
        property bool copied: false

        Layout.fillWidth: true
        implicitHeight: boxRow.implicitHeight + Kirigami.Units.smallSpacing * 4
        radius: Kirigami.Units.smallSpacing * 1.5
        Kirigami.Theme.colorSet: Kirigami.Theme.View
        Kirigami.Theme.inherit: false
        color: Kirigami.Theme.backgroundColor
        border.width: 1
        border.color: Kirigami.ColorUtils.linearInterpolation(Kirigami.Theme.backgroundColor,
                                                              Kirigami.Theme.textColor, 0.18)

        RowLayout {
            id: boxRow
            anchors.fill: parent
            anchors.leftMargin: Kirigami.Units.largeSpacing
            anchors.rightMargin: Kirigami.Units.smallSpacing * 2
            anchors.topMargin: Kirigami.Units.smallSpacing * 2
            anchors.bottomMargin: Kirigami.Units.smallSpacing * 2
            spacing: Kirigami.Units.largeSpacing

            TextEdit {
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignVCenter
                text: box.command
                readOnly: true
                selectByMouse: true
                wrapMode: TextEdit.WrapAtWordBoundaryOrAnywhere
                font: Kirigami.Theme.fixedWidthFont
                color: Kirigami.Theme.textColor
                selectionColor: Kirigami.Theme.highlightColor
                selectedTextColor: Kirigami.Theme.highlightedTextColor
            }

            QQC2.Button {
                Layout.alignment: Qt.AlignTop
                icon.name: box.copied ? "checkmark" : "edit-copy"
                text: box.copied ? i18nc("@action:button command was copied", "Copied") : i18nc("@action:button", "Copy")
                enabled: box.command.length > 0
                onClicked: {
                    root.copyText(box.command)
                    box.copied = true
                    copiedTimer.restart()
                }
                Timer {
                    id: copiedTimer
                    interval: 2000
                    onTriggered: box.copied = false
                }
            }
        }
    }

    component Step: RowLayout {
        id: step
        property int number: 1
        property string title
        property bool done: false
        property bool current: false
        default property alias content: stepBody.data

        Layout.fillWidth: true
        spacing: Kirigami.Units.largeSpacing * 2

        Rectangle {
            Layout.alignment: Qt.AlignTop
            implicitWidth: Kirigami.Units.gridUnit * 1.8
            implicitHeight: implicitWidth
            radius: width / 2
            color: step.done ? Kirigami.Theme.positiveTextColor
                 : step.current ? Kirigami.Theme.highlightColor : "transparent"
            border.width: step.done || step.current ? 0 : 1
            border.color: Kirigami.Theme.disabledTextColor

            QQC2.Label {
                anchors.centerIn: parent
                visible: !step.done
                text: step.number
                font.weight: Font.Bold
                color: step.current ? Kirigami.Theme.highlightedTextColor : Kirigami.Theme.disabledTextColor
            }
            Kirigami.Icon {
                anchors.centerIn: parent
                visible: step.done
                implicitWidth: Kirigami.Units.iconSizes.small
                implicitHeight: Kirigami.Units.iconSizes.small
                source: "checkmark"
                isMask: true
                color: "white"
            }
        }

        ColumnLayout {
            id: stepBody
            Layout.fillWidth: true
            spacing: Kirigami.Units.largeSpacing

            Kirigami.Heading {
                Layout.fillWidth: true
                Layout.topMargin: Math.round((Kirigami.Units.gridUnit * 1.8 - implicitHeight) / 2)
                level: 3
                text: step.title
                wrapMode: Text.Wrap
            }
        }
    }

    QQC2.ScrollView {
        id: scroll
        anchors.fill: parent
        contentWidth: availableWidth
        QQC2.ScrollBar.horizontal.policy: QQC2.ScrollBar.AlwaysOff

        Item {
            width: scroll.availableWidth
            implicitHeight: column.implicitHeight + Kirigami.Units.gridUnit * 3

            ColumnLayout {
                id: column
                anchors.horizontalCenter: parent.horizontalCenter
                y: Kirigami.Units.gridUnit * 1.5
                width: Math.max(0, Math.min(parent.width - Kirigami.Units.gridUnit * 2, Kirigami.Units.gridUnit * 40))
                spacing: Kirigami.Units.gridUnit * 1.5

                // ── header ─────────────────────────────────────────────────
                RowLayout {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.largeSpacing * 2

                    Kirigami.Icon {
                        Layout.alignment: Qt.AlignTop
                        implicitWidth: Kirigami.Units.iconSizes.huge
                        implicitHeight: Kirigami.Units.iconSizes.huge
                        source: "preferences-desktop-wallpaper"
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: Kirigami.Units.smallSpacing

                        Kirigami.Heading {
                            Layout.fillWidth: true
                            level: 1
                            wrapMode: Text.Wrap
                            text: i18n("Finish installing Shader Wallpaper")
                        }
                        QQC2.Label {
                            Layout.fillWidth: true
                            wrapMode: Text.Wrap
                            text: i18n("Shader Wallpaper draws with a small native engine. The KDE Store delivers only the wallpaper's files, so the engine is compiled here, once for each version. It takes about a minute.")
                        }
                        QQC2.Label {
                            Layout.fillWidth: true
                            visible: root.version.length > 0
                            text: i18nc("%1 is a version number", "Version %1", root.version)
                            opacity: 0.6
                            font: Kirigami.Theme.smallFont
                        }
                    }
                }

                Kirigami.Separator { Layout.fillWidth: true }

                // ── 1: dependencies ────────────────────────────────────────
                Step {
                    number: 1
                    title: i18n("Install the build tools")
                    done: root.depsLoaded && root.missingDeps.length === 0
                    current: !done

                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        visible: !root.depsLoaded
                        text: i18n("Checking…")
                        opacity: 0.7
                    }
                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        visible: root.depsLoaded && root.missingDeps.length === 0
                        color: Kirigami.Theme.positiveTextColor
                        text: root.optionalMissing.length === 0
                            ? i18n("Everything needed to build the engine is installed.")
                            : i18n("Everything required is installed. Optional, not found: %1. The command below adds them.",
                                   root.labelList(root.optionalMissing))
                    }
                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        visible: root.depsLoaded && root.missingDeps.length > 0
                        text: i18n("Missing: %1. Install them with this command in a terminal:",
                                   root.labelList(root.missingDeps))
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        visible: root.depsLoaded && (root.missingDeps.length > 0 || showCommand.checked)
                        spacing: Kirigami.Units.largeSpacing
                        QQC2.Label { text: i18nc("@label:listbox", "Distribution:") }
                        QQC2.ComboBox {
                            id: familyCombo
                            Layout.fillWidth: true
                            Layout.maximumWidth: Kirigami.Units.gridUnit * 18
                            model: root.families.map(function(f) {
                                return f.id === root.detectedFamily
                                    ? i18nc("%1 is a distribution name", "%1 (detected)", f.name) : f.name
                            })
                            currentIndex: root.familyIndex(root.family)
                            displayText: currentIndex >= 0 ? currentText : i18nc("@item:inlistbox", "Choose your distribution")
                            onActivated: function(index) { root.family = root.families[index].id }
                        }
                    }

                    CommandBox {
                        visible: root.depsLoaded && root.family.length > 0
                                 && (root.missingDeps.length > 0 || showCommand.checked)
                        command: root.commands[root.family] || ""
                    }

                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        visible: root.depsLoaded && root.missingDeps.length > 0
                        text: root.family.length > 0
                            ? i18n("Step 2 checks again and offers to run this command for you.")
                            : i18n("Not listed? Install CMake, a C++ compiler, Extra CMake Modules and the development files for Qt 6, KDE Frameworks 6 and Plasma 6.")
                        opacity: 0.7
                        font: Kirigami.Theme.smallFont
                    }

                    QQC2.Button {
                        id: showCommand
                        visible: root.depsLoaded && root.missingDeps.length === 0
                        checkable: true
                        flat: true
                        icon.name: checked ? "arrow-up" : "arrow-down"
                        text: checked ? i18nc("@action:button", "Hide Command")
                                      : i18nc("@action:button", "Show Install Command")
                    }
                }

                // ── 2: build ───────────────────────────────────────────────
                Step {
                    number: 2
                    title: i18n("Build and install the engine")
                    done: root.engineState === "installed"
                    current: !done

                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        text: i18n("A terminal window compiles the engine and installs it into this wallpaper's folder. It asks for your password only to install missing build tools.")
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: Kirigami.Units.largeSpacing

                        QQC2.Button {
                            icon.name: "run-build"
                            text: root.engineState === "installed" ? i18nc("@action:button", "Build Again")
                                : root.engineState === "failed" ? i18nc("@action:button", "Try Again")
                                : i18nc("@action:button", "Build and Install")
                            highlighted: root.engineState !== "installed"
                            enabled: root.engineState !== "building" && !root.launching
                            onClicked: root.startBuild()
                        }
                        QQC2.BusyIndicator {
                            visible: running
                            running: root.engineState === "building" || root.launching
                            implicitWidth: Kirigami.Units.iconSizes.medium
                            implicitHeight: Kirigami.Units.iconSizes.medium
                        }
                        QQC2.Label {
                            Layout.fillWidth: true
                            wrapMode: Text.Wrap
                            visible: text.length > 0
                            color: root.engineState === "installed" ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.textColor
                            text: root.engineState === "building" ? i18n("Building in a terminal window…")
                                : root.engineState === "installed" ? i18n("Engine installed.")
                                : ""
                        }
                    }

                    Kirigami.InlineMessage {
                        Layout.fillWidth: true
                        visible: root.engineState === "failed"
                        type: Kirigami.MessageType.Error
                        text: i18n("The build did not finish. The terminal window shows why; the full log is in %1.", root.logPath)
                        actions: [
                            Kirigami.Action {
                                text: i18nc("@action:button", "Open Log")
                                icon.name: "document-open"
                                onTriggered: Qt.openUrlExternally("file://" + root.logPath)
                            }
                        ]
                    }

                    Kirigami.InlineMessage {
                        Layout.fillWidth: true
                        visible: root.launchFailed
                        type: Kirigami.MessageType.Warning
                        text: i18n("No terminal application was found. Run this command in a terminal:")
                    }

                    QQC2.Button {
                        id: showManual
                        visible: !root.launchFailed
                        checkable: true
                        flat: true
                        icon.name: checked ? "arrow-up" : "arrow-down"
                        text: i18nc("@action:button", "Run It in a Terminal Yourself")
                    }

                    CommandBox {
                        visible: root.launchFailed || showManual.checked
                        command: root.scriptCommand("install")
                    }
                }

                // ── 3: restart ─────────────────────────────────────────────
                Step {
                    number: 3
                    title: i18n("Restart Plasma")
                    current: root.engineState === "installed"

                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        text: i18n("Plasma loads the engine when it starts. Restart Plasma now, or log out and back in.")
                    }

                    QQC2.Button {
                        icon.name: "view-refresh"
                        text: i18nc("@action:button", "Restart Plasma…")
                        enabled: root.engineState === "installed"
                        highlighted: root.engineState === "installed"
                        onClicked: restartDialog.open()
                    }

                    Kirigami.InlineMessage {
                        Layout.fillWidth: true
                        visible: root.engineState === "installed" && root.engineError.length > 0 && showDetails.checked
                        type: Kirigami.MessageType.Information
                        text: i18n("This Plasma session could not load the engine: %1", root.engineError)
                    }

                    QQC2.Button {
                        id: showDetails
                        visible: root.engineState === "installed" && root.engineError.length > 0
                        checkable: true
                        flat: true
                        icon.name: "documentinfo"
                        text: i18nc("@action:button", "Still Here after a Restart?")
                    }
                }

                Kirigami.Separator { Layout.fillWidth: true }

                RowLayout {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.largeSpacing

                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        text: i18n("Distribution packages include the engine; this page does not appear with them.")
                        opacity: 0.7
                        font: Kirigami.Theme.smallFont
                    }
                    QQC2.Button {
                        flat: true
                        icon.name: "help-contents"
                        text: i18nc("@action:button", "Help")
                        onClicked: Qt.openUrlExternally(root.helpUrl)
                    }
                    QQC2.Button {
                        flat: true
                        icon.name: "tools-report-bug"
                        text: i18nc("@action:button", "Report a Problem")
                        onClicked: Qt.openUrlExternally(root.issuesUrl)
                    }
                }
            }
        }
    }

    Kirigami.PromptDialog {
        id: restartDialog
        parent: QQC2.Overlay.overlay
        preferredWidth: Kirigami.Units.gridUnit * 24
        maximumWidth: Kirigami.Units.gridUnit * 26
        title: i18n("Restart Plasma?")
        subtitle: i18n("The desktop and panels disappear for a few seconds and return with Shader Wallpaper running. Open windows stay open.")
        standardButtons: Kirigami.Dialog.NoButton
        customFooterActions: [
            Kirigami.Action {
                text: i18nc("@action:button", "Restart Plasma")
                icon.name: "view-refresh"
                onTriggered: {
                    restartDialog.close()
                    root.restartPlasma()
                }
            },
            Kirigami.Action {
                text: i18nc("@action:button", "Cancel")
                icon.name: "dialog-cancel"
                onTriggered: restartDialog.close()
            }
        ]
    }
}

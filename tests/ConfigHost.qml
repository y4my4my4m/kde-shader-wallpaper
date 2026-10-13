// SPDX-License-Identifier: GPL-3.0-or-later

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// The lifecycle and cfg_* signal contracts of Plasma 6.7's desktop and KCM hosts.
Item {
    id: host
    property var configuration
    property string mode: "desktop"
    property alias currentItem: stack.currentItem
    property int changes: 0
    property int writes: 0
    property bool loading: false
    property int temporaryInstances: 0

    QtObject {
        id: dialog
        property var wallpaperConfiguration: host.configuration
    }

    function copyToMap() {
        if (!stack.currentItem) return
        configuration.keys().forEach(function(key) {
            const cfgKey = "cfg_" + key
            if (stack.currentItem[cfgKey] !== undefined) {
                configuration[key] = stack.currentItem[cfgKey]
                ++writes
            }
        })
    }
    function changed() {
        ++changes
        if (mode === "kcm") copyToMap()
    }
    function load() {
        loading = true
        let props = { configDialog: dialog, wallpaperConfiguration: configuration }
        const component = Qt.createComponent(Fixture.configUrl)
        if (component.status !== Component.Ready) throw new Error(component.errorString())
        const temporary = component.createObject(host, props)
        if (!temporary) throw new Error(component.errorString())
        ++temporaryInstances
        configuration.keys().forEach(function(key) {
            if (("cfg_" + key) in temporary) props["cfg_" + key] = configuration[key]
        })
        temporary.destroy()
        const page = stack.replace(Fixture.configUrl, props, StackView.Immediate)
        if (!page) throw new Error("StackView page creation failed")
        configuration.keys().forEach(function(key) {
            const signal = page["cfg_" + key + "Changed"]
            if (signal) signal.connect(host.changed)
        })
        if (page.configurationChanged) page.configurationChanged.connect(host.changed)
        loading = false
        return page
    }
    function save() {
        if (currentItem.saveConfig) currentItem.saveConfig()
        copyToMap()
        configuration.writeConfig()
    }
    StackView {
        id: stack
        anchors.fill: parent
    }
}

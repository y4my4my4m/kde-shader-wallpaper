// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtCore
import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import QtQuick.Window
import org.kde.kirigami as Kirigami
import "shaderwallpaper"
import "config"
import "ShaderApply.js" as ShaderApply

// Gallery tab: search, filters, grid of shaders, preview generation, and
// the tweaks section for the current shader.
FocusScope {
    id: gallery

    required property var root
    property bool shown: false

    function focusSearch() {
        searchField.forceActiveFocus()
        searchField.selectAll()
    }
    onShownChanged: if (shown) Qt.callLater(focusSearch)

    Settings {
        id: gallerySettings
        category: "ShaderWallpaperGallery"
        property int density: 1
        property int sortMode: 0
        property string galleryCategory: "All"
        property bool favouritesOnly: false
        property bool tweaksExpanded: false
        // Share of the gallery height the open tweaks section may take.
        property real tweaksFraction: 0.6
    }

    // ── data ──────────────────────────────────────────────────────────────
    ShaderListModel {
        id: source
        category: gallerySettings.galleryCategory
        searchQuery: searchField.text.trim()
        showFavoritesOnly: gallerySettings.favouritesOnly
        onModelReset: gallery.scheduleSync()
        onRowsInserted: gallery.scheduleSync()
        onRowsRemoved: gallery.scheduleSync()
        onDataChanged: gallery.scheduleSync()
    }

    CategoryModel {
        id: categoryModel
        onCountChanged: gallery.rebuildCategories()
        onModelReset: gallery.rebuildCategories()
    }

    Connections {
        target: ShaderLibrarySingleton
        function onThumbnailGenerated(id, url) {
            for (let i = 0; i < items.count; i++) {
                if (items.get(i).shaderId === id) {
                    items.setProperty(i, "thumbnailPath", String(url))
                    break
                }
            }
        }
        function onShaderUpdated(id) { gallery.scheduleSync() }
    }

    // Sorted mirror of `source`: ShaderListModel has no sort, and the card
    // grid needs stable rows for in-place updates (favourites, thumbnails).
    ListModel { id: items }

    readonly property var sortModes: {
        const modes = [
            { key: "name", text: i18nc("@item:inlistbox sort order", "Name") },
            { key: "recent", text: i18nc("@item:inlistbox sort order", "Recently used") },
            { key: "favourites", text: i18nc("@item:inlistbox sort order", "Favourites first") }
        ]
        if (hasCostData) modes.push({ key: "light", text: i18nc("@item:inlistbox sort order", "Lightest first") })
        return modes
    }
    property bool hasCostData: false
    readonly property string sortKey: sortModes[Math.min(gallerySettings.sortMode, sortModes.length - 1)].key

    // Session-only filter: shaders new in this version.
    property bool newOnly: false
    onNewOnlyChanged: scheduleSync()
    Connections {
        target: ShaderLibrarySingleton
        function onNewCountChanged() {
            if (ShaderLibrarySingleton.newCount === 0) gallery.newOnly = false
        }
    }

    property bool _syncQueued: false
    function scheduleSync() {
        if (_syncQueued) return
        _syncQueued = true
        Qt.callLater(sync)
    }
    onSortKeyChanged: scheduleSync()
    Connections {
        target: gallery.root
        function onRecentPathsChanged() { if (gallery.sortKey === "recent") gallery.scheduleSync() }
    }

    function sync() {
        _syncQueued = false
        const lib = ShaderLibrarySingleton
        const rows = []
        let cost = false
        for (let i = 0; i < source.count; i++) {
            const m = source.get(i)
            if (!m) continue
            // The source model filters favourites on reset only.
            if (gallerySettings.favouritesOnly && m.favorite !== true) continue
            if (gallery.newOnly && m.isNew !== true) continue
            const path = String(m.shaderPath)
            const avg = Number(m.averageFrameTime) || 0
            if (avg > 0) cost = true
            rows.push({
                shaderId: m.id,
                name: m.name || ShaderApply.displayName(path),
                author: m.author || "",
                category: m.category || "",
                shaderPath: path,
                relPath: lib.toRelativeShaderPath(path),
                // Index entries can name a thumbnail file that is gone.
                thumbnailPath: lib.needsThumbnail(m.id) ? "" : String(m.thumbnailPath || ""),
                favorite: m.favorite === true,
                isNew: m.isNew === true,
                hasBuffers: m.hasBuffers === true,
                needsAudio: m.needsAudio === true,
                performanceTier: m.performanceTier === undefined ? -1 : m.performanceTier,
                averageFrameTime: avg,
                greeterAvailable: m.greeterAvailable !== false
            })
        }
        hasCostData = cost

        const byName = function(a, b) { return a.name.localeCompare(b.name) }
        if (sortKey === "recent") {
            const recent = root.recentPaths || []
            const rank = function(r) { const i = recent.indexOf(r.relPath); return i < 0 ? 1e9 : i }
            rows.sort(function(a, b) { return (rank(a) - rank(b)) || byName(a, b) })
        } else if (sortKey === "favourites") {
            rows.sort(function(a, b) { return (b.favorite - a.favorite) || byName(a, b) })
        } else if (sortKey === "light") {
            const c = function(r) { return r.averageFrameTime > 0 ? r.averageFrameTime : 1e9 }
            rows.sort(function(a, b) { return (c(a) - c(b)) || byName(a, b) })
        } else {
            rows.sort(byName)
        }

        // Same rows in the same order: update in place, keeping delegates
        // and scroll position.
        let sameShape = rows.length === items.count
        for (let j = 0; sameShape && j < rows.length; j++)
            if (items.get(j).shaderId !== rows[j].shaderId) sameShape = false
        if (sameShape) {
            for (let k = 0; k < rows.length; k++) {
                const cur = items.get(k)
                for (const key in rows[k])
                    if (cur[key] !== rows[k][key]) items.setProperty(k, key, rows[k][key])
            }
        } else {
            const y = grid.contentY
            items.clear()
            for (let n = 0; n < rows.length; n++) items.append(rows[n])
            grid.contentY = Math.min(y, Math.max(0, grid.contentHeight - grid.height))
        }
        root.galleryPool = rows.map(function(r) { return r.shaderPath })
        syncCurrentIndex()
    }

    readonly property string selectedRelPath: ShaderLibrarySingleton.toRelativeShaderPath(root.cfg_selectedShaderPath)
    onSelectedRelPathChanged: syncCurrentIndex()
    function indexOfPath(rel) {
        for (let i = 0; i < items.count; i++) if (items.get(i).relPath === rel) return i
        return -1
    }
    function syncCurrentIndex() {
        const i = indexOfPath(selectedRelPath)
        if (i >= 0) grid.currentIndex = i
    }

    property var categories: []
    function rebuildCategories() {
        const list = [{ value: "All", text: i18n("All categories (%1)", ShaderLibrarySingleton.shaderCount) }]
        for (let i = 0; i < categoryModel.count; i++) {
            const name = categoryModel.get(i)
            if (!name || name === "All" || name === "Favorites") continue
            const n = categoryModel.shaderCount(name)
            if (n > 0) list.push({ value: name, text: i18nc("@item:inlistbox category and shader count", "%1 (%2)", name, n) })
        }
        categories = list
    }

    function apply(index) {
        if (index < 0 || index >= items.count) return
        grid.currentIndex = index
        root.applyShaderFromPath(items.get(index).shaderPath)
    }

    Component.onCompleted: {
        tweakSource.refresh()
        rebuildCategories()
        sync()
        // The closure outlives this item when the config dialog rebuilds the
        // page; it captures the grid and index instead of looking them up.
        const view = grid
        const i = indexOfPath(selectedRelPath)
        if (i >= 0) Qt.callLater(function() { if (view) view.positionViewAtIndex(i, GridView.Center) })
    }

    // ── layout ────────────────────────────────────────────────────────────
    ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: Kirigami.Units.smallSpacing
        spacing: Kirigami.Units.smallSpacing

        GridLayout {
            id: toolbar
            readonly property bool wide: gallery.width > Kirigami.Units.gridUnit * 46
            Layout.fillWidth: true
            Layout.leftMargin: Kirigami.Units.largeSpacing
            Layout.rightMargin: Kirigami.Units.largeSpacing
            columns: wide ? 5 : 3
            columnSpacing: Kirigami.Units.smallSpacing
            rowSpacing: Kirigami.Units.smallSpacing

            Kirigami.SearchField {
                id: searchField
                objectName: "gallerySearch"
                Layout.fillWidth: true
                Layout.columnSpan: toolbar.wide ? 1 : 2
                placeholderText: i18n("Search shaders…")
                // Sole Ctrl+F owner on the page.
                focusSequence: StandardKey.Find
                // Enter applies the first hit; filtering follows `text`.
                autoAccept: false
                KeyNavigation.down: grid
                Keys.onEscapePressed: function(event) {
                    if (text.length > 0) { text = ""; event.accepted = true }
                    else event.accepted = false
                }
                onAccepted: if (items.count > 0) gallery.apply(0)
            }
            RowLayout {
                spacing: 0
                QQC2.ToolButton {
                    icon.name: "love"
                    icon.color: checked ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
                    checkable: true
                    checked: gallerySettings.favouritesOnly
                    display: toolbar.wide ? QQC2.AbstractButton.TextBesideIcon : QQC2.AbstractButton.IconOnly
                    text: i18n("Favourites")
                    QQC2.ToolTip.text: i18n("Show favourites only")
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    onToggled: gallerySettings.favouritesOnly = checked
                }
                QQC2.ToolButton {
                    id: newToggle
                    objectName: "newToggle"
                    visible: ShaderLibrarySingleton.newCount > 0 || gallery.newOnly
                    checkable: true
                    checked: gallery.newOnly
                    // IconOnly: the style's background draws the text otherwise.
                    display: QQC2.AbstractButton.IconOnly
                    text: i18np("%1 new shader", "%1 new shaders", ShaderLibrarySingleton.newCount)
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.smallSpacing
                        NewBadge {}
                        QQC2.Label {
                            text: ShaderLibrarySingleton.newCount
                            visible: ShaderLibrarySingleton.newCount > 0
                        }
                    }
                    QQC2.ToolTip.text: newToggle.checked ? i18n("Show all shaders") : i18n("Show shaders new in this version")
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    onToggled: gallery.newOnly = checked
                }
            }
            QQC2.ComboBox {
                id: categoryCombo
                Layout.fillWidth: !toolbar.wide
                Layout.preferredWidth: toolbar.wide ? Kirigami.Units.gridUnit * 11 : -1
                model: gallery.categories
                textRole: "text"
                valueRole: "value"
                currentIndex: {
                    for (let i = 0; i < gallery.categories.length; i++)
                        if (gallery.categories[i].value === gallerySettings.galleryCategory) return i
                    return 0
                }
                onActivated: function(i) { gallerySettings.galleryCategory = gallery.categories[i].value }
                Accessible.name: i18n("Category")
            }
            QQC2.ComboBox {
                id: sortCombo
                Layout.fillWidth: !toolbar.wide
                Layout.preferredWidth: toolbar.wide ? Kirigami.Units.gridUnit * 9 : -1
                model: gallery.sortModes
                textRole: "text"
                currentIndex: Math.min(gallerySettings.sortMode, gallery.sortModes.length - 1)
                onActivated: function(i) { gallerySettings.sortMode = i }
                Accessible.name: i18n("Sort order")
            }
            RowLayout {
                spacing: 0
                QQC2.ToolButton {
                    icon.name: "zoom-out"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("Smaller cards")
                    enabled: gallerySettings.density > 0
                    QQC2.ToolTip.text: text
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    onClicked: gallerySettings.density = Math.max(0, gallerySettings.density - 1)
                }
                QQC2.ToolButton {
                    icon.name: "zoom-in"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("Larger cards")
                    enabled: gallerySettings.density < 2
                    QQC2.ToolTip.text: text
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    onClicked: gallerySettings.density = Math.min(2, gallerySettings.density + 1)
                }
                QQC2.ToolButton {
                    icon.name: "view-refresh"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("Rescan shader folders")
                    QQC2.ToolTip.text: text
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    onClicked: ShaderLibrarySingleton.refresh()
                }
            }
        }

        GridView {
            id: grid
            objectName: "galleryGrid"
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.leftMargin: Kirigami.Units.largeSpacing - Kirigami.Units.smallSpacing
            Layout.rightMargin: Kirigami.Units.smallSpacing
            Layout.minimumHeight: Kirigami.Units.gridUnit * 6
            clip: true
            focus: true
            keyNavigationEnabled: true
            boundsBehavior: Flickable.StopAtBounds
            currentIndex: -1
            highlightFollowsCurrentItem: false
            cacheBuffer: cellHeight * 2
            model: items

            readonly property real minCellWidth: [9, 12, 16][Math.max(0, Math.min(2, gallerySettings.density))] * Kirigami.Units.gridUnit
            readonly property real usableWidth: Math.max(0, width - scrollBar.implicitWidth)
            readonly property int columns: Math.max(1, Math.floor(usableWidth / minCellWidth))
            cellWidth: Math.max(1, Math.floor(usableWidth / columns))
            cellHeight: Math.round((cellWidth - Kirigami.Units.smallSpacing * 4) * 9 / 16)
                        + Kirigami.Units.gridUnit * (gallerySettings.density === 0 ? 2 : 3)

            QQC2.ScrollBar.vertical: QQC2.ScrollBar { id: scrollBar }

            Keys.onReturnPressed: gallery.apply(currentIndex)
            Keys.onEnterPressed: gallery.apply(currentIndex)
            Keys.onSpacePressed: gallery.apply(currentIndex)
            Keys.onMenuPressed: if (currentItem) currentItem.openMenu(Qt.point(currentItem.width / 2, currentItem.height / 2))

            delegate: Item {
                id: cell
                required property int index
                required property string shaderId
                required property string name
                required property string author
                required property string shaderPath
                required property string relPath
                required property string thumbnailPath
                required property bool favorite
                required property bool isNew
                required property bool hasBuffers
                required property bool needsAudio
                required property int performanceTier
                required property bool greeterAvailable

                width: grid.cellWidth
                height: grid.cellHeight

                function openMenu(pos) {
                    cardMenu.cellIndex = index
                    cardMenu.popup(cell, pos)
                }

                ShaderCard {
                    anchors.fill: parent
                    anchors.margins: Kirigami.Units.smallSpacing
                    shaderId: cell.shaderId
                    shaderName: cell.name
                    author: cell.author
                    thumbnailPath: cell.thumbnailPath
                    isFavorite: cell.favorite
                    isNew: cell.isNew
                    hasBuffers: cell.hasBuffers
                    needsAudio: cell.needsAudio
                    performanceTier: cell.performanceTier
                    greeterAvailable: cell.greeterAvailable
                    compact: gallerySettings.density === 0
                    selected: cell.relPath === gallery.selectedRelPath
                    keyboardCurrent: grid.activeFocus && grid.currentIndex === cell.index
                    onClicked: {
                        grid.forceActiveFocus()
                        gallery.apply(cell.index)
                    }
                    onFavoriteToggled: gallery.root.toggleFavorite(cell.shaderId)
                    onContextMenuRequested: function(pos) { cell.openMenu(pos) }
                }
            }

            Kirigami.PlaceholderMessage {
                anchors.centerIn: parent
                width: parent.width - Kirigami.Units.gridUnit * 4
                visible: items.count === 0 && !ShaderLibrarySingleton.loading
                icon.name: gallerySettings.favouritesOnly && searchField.text.length === 0 ? "love" : "search"
                text: searchField.text.length > 0
                    ? i18n("No shaders match “%1”", searchField.text)
                    : (gallerySettings.favouritesOnly ? i18n("No favourites yet")
                                                      : i18n("No shaders in this category"))
                explanation: gallerySettings.favouritesOnly && searchField.text.length === 0
                    ? i18n("Click the heart on a shader to keep it here.")
                    : ""
                helpfulAction: Kirigami.Action {
                    icon.name: "edit-clear"
                    text: searchField.text.length > 0 ? i18n("Clear Search")
                        : (gallerySettings.favouritesOnly ? i18n("Show All Shaders") : i18n("Show All Categories"))
                    onTriggered: {
                        if (searchField.text.length > 0) searchField.text = ""
                        else if (gallerySettings.favouritesOnly) gallerySettings.favouritesOnly = false
                        else gallerySettings.galleryCategory = "All"
                    }
                }
            }
        }

        // ── status row ────────────────────────────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            Layout.leftMargin: Kirigami.Units.largeSpacing
            Layout.rightMargin: Kirigami.Units.largeSpacing
            spacing: Kirigami.Units.largeSpacing
            QQC2.Label {
                text: i18np("%1 shader", "%1 shaders", items.count)
                color: Kirigami.Theme.disabledTextColor
                font: Kirigami.Theme.smallFont
            }
            Item { Layout.fillWidth: true }
            ThumbnailGenerator {
                id: thumbnailGenerator
                objectName: "thumbnailGenerator"
                active: gallery.shown && gallery.visible && gallery.Window.window !== null
                        && gallery.Window.window.visible
            }
        }

        // ── tweaks for the current shader ─────────────────────────────────
        // Separator doubling as a splitter: drag it to resize the tweaks.
        Item {
            id: tweaksSplitter
            objectName: "tweaksSplitter"
            Layout.fillWidth: true
            implicitHeight: Kirigami.Units.smallSpacing * 2
            visible: tweaksPanel.count > 0
            Kirigami.Separator {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
            }
            Rectangle {
                anchors.centerIn: parent
                width: Kirigami.Units.gridUnit * 2
                height: Math.max(2, Kirigami.Units.smallSpacing / 2)
                radius: height / 2
                color: Kirigami.Theme.disabledTextColor
                opacity: splitterArea.containsMouse || splitterArea.pressed ? 0.9 : 0.4
                visible: gallerySettings.tweaksExpanded
            }
            MouseArea {
                id: splitterArea
                anchors.fill: parent
                anchors.topMargin: -Kirigami.Units.smallSpacing
                anchors.bottomMargin: -Kirigami.Units.smallSpacing
                enabled: gallerySettings.tweaksExpanded
                hoverEnabled: true
                cursorShape: Qt.SplitVCursor
                property real startY: 0
                property real startFraction: 0
                onPressed: function(mouse) {
                    startY = mapToItem(gallery, mouse.x, mouse.y).y
                    startFraction = gallerySettings.tweaksFraction
                }
                onPositionChanged: function(mouse) {
                    if (!pressed || gallery.height <= 0) return
                    const dy = mapToItem(gallery, mouse.x, mouse.y).y - startY
                    gallerySettings.tweaksFraction = Math.max(0.15, Math.min(0.85, startFraction - dy / gallery.height))
                }
            }
        }
        // AbstractButton: the desktop style's ToolButton paints its own
        // label underneath a replaced contentItem.
        QQC2.AbstractButton {
            id: tweaksToggle
            objectName: "tweaksToggle"
            Layout.fillWidth: true
            visible: tweaksPanel.count > 0
            hoverEnabled: true
            text: i18n("Tweak this shader")
            Accessible.role: Accessible.Button
            padding: Kirigami.Units.smallSpacing
            leftPadding: Kirigami.Units.largeSpacing
            rightPadding: Kirigami.Units.largeSpacing
            onClicked: gallerySettings.tweaksExpanded = !gallerySettings.tweaksExpanded
            background: Rectangle {
                color: tweaksToggle.hovered || tweaksToggle.visualFocus
                    ? Qt.rgba(Kirigami.Theme.highlightColor.r, Kirigami.Theme.highlightColor.g,
                              Kirigami.Theme.highlightColor.b, 0.12)
                    : "transparent"
            }
            contentItem: RowLayout {
                spacing: Kirigami.Units.smallSpacing
                Kirigami.Icon {
                    source: gallerySettings.tweaksExpanded ? "arrow-down" : "arrow-right"
                    implicitWidth: Kirigami.Units.iconSizes.small
                    implicitHeight: Kirigami.Units.iconSizes.small
                }
                QQC2.Label {
                    text: tweaksToggle.text
                    font.bold: true
                }
                StatusChip {
                    visible: tweaksPanel.dirty
                    text: i18nc("@info tweak values differ from the file", "Changed")
                    tone: Kirigami.Theme.neutralTextColor
                }
                Item { Layout.fillWidth: true }
                QQC2.Label {
                    text: i18np("%1 value", "%1 values", tweaksPanel.count)
                    color: Kirigami.Theme.disabledTextColor
                }
            }
        }
        QQC2.ScrollView {
            id: tweaksScroll
            Layout.fillWidth: true
            Layout.leftMargin: Kirigami.Units.largeSpacing
            Layout.rightMargin: Kirigami.Units.largeSpacing
            Layout.bottomMargin: Kirigami.Units.smallSpacing
            Layout.preferredHeight: Math.min(tweaksPanel.implicitHeight, gallery.height * gallerySettings.tweaksFraction)
            visible: tweaksPanel.count > 0 && gallerySettings.tweaksExpanded
            contentWidth: availableWidth

            ShaderTweaksPanel {
                id: tweaksPanel
                objectName: "tweaksPanel"
                width: tweaksScroll.availableWidth
                originalSource: tweakSource.original
                currentSource: gallery.root.cfg_selectedShaderCode.length > 0
                    ? gallery.root.cfg_selectedShaderCode : tweakSource.original
                onTweaksChanged: function(code) {
                    tweakSource.lastEmitted = code
                    if (gallery.root.fileBacked) gallery.root.setInlineCode(code)
                    else gallery.root.setInlineCode(code.length > 0 ? code : tweakSource.original)
                }
                onSaveRequested: function(code) {
                    saveTweaksPrompt.pendingCode = code
                    saveTweaksPrompt.open()
                }
                onSaveAsRequested: function(code) {
                    saveAsPrompt.pendingCode = code
                    saveAsPrompt.open()
                }
            }
        }
    }

    // Defaults the tweaks are measured against: the file on disk for a
    // library shader, the code as first seen for inline-only shaders.
    QtObject {
        id: tweakSource
        property string original: ""
        property string lastEmitted: ""
        function refresh() {
            const r = gallery.root
            if (r.fileBacked) {
                original = ShaderLibrarySingleton.loadShaderCode(
                    ShaderApply.toFileUrl(ShaderLibrarySingleton, r.cfg_selectedShaderPath)) || ""
            } else if (r.inlineOverride) {
                if (r.cfg_selectedShaderCode !== lastEmitted || original.length === 0)
                    original = r.cfg_selectedShaderCode
            } else {
                original = ""
            }
        }
    }
    Connections {
        target: gallery.root
        function onCfg_selectedShaderPathChanged() { tweakSource.refresh() }
        function onCfg_selectedShaderCodeChanged() { if (!gallery.root.fileBacked) tweakSource.refresh() }
    }
    Component.onDestruction: tweaksPanel.flush()

    // ── menus and prompts ─────────────────────────────────────────────────
    QQC2.Menu {
        id: cardMenu
        property int cellIndex: -1
        readonly property var row: cellIndex >= 0 && cellIndex < items.count ? items.get(cellIndex) : null
        QQC2.MenuItem {
            text: i18n("Apply")
            icon.name: "dialog-ok-apply"
            onTriggered: gallery.apply(cardMenu.cellIndex)
        }
        QQC2.MenuItem {
            text: cardMenu.row && cardMenu.row.favorite ? i18n("Remove from Favourites") : i18n("Add to Favourites")
            icon.name: "love"
            onTriggered: if (cardMenu.row) gallery.root.toggleFavorite(cardMenu.row.shaderId)
        }
        QQC2.MenuItem {
            text: i18n("Add to Playlist")
            icon.name: "view-media-playlist"
            enabled: cardMenu.row !== null && (gallery.root.cfg_playlistShaders || []).indexOf(cardMenu.row.relPath) < 0
            onTriggered: if (cardMenu.row) gallery.root.addToPlaylist(cardMenu.row.shaderPath)
        }
        QQC2.MenuItem {
            text: i18n("Mark All New Shaders as Seen")
            icon.name: "checkmark"
            visible: ShaderLibrarySingleton.newCount > 0
            height: visible ? implicitHeight : 0
            onTriggered: ShaderLibrarySingleton.markAllSeen()
        }
        QQC2.MenuItem {
            text: i18n("Regenerate Thumbnail")
            icon.name: "view-refresh"
            onTriggered: {
                if (!cardMenu.row) return
                if (cardMenu.row.relPath === gallery.selectedRelPath
                        && gallery.root.captureThumbnailForCurrentShader(true)) return
                thumbnailGenerator.enqueue(cardMenu.row.shaderId)
            }
        }
    }

    Kirigami.PromptDialog {
        id: saveTweaksPrompt
        parent: QQC2.Overlay.overlay
        property string pendingCode
        title: i18n("Save Tweaks to the Shader File?")
        subtitle: i18n("This overwrites %1. The previous values cannot be restored.",
                       gallery.root.shaderFileUrl().replace(/^file:\/\//, ""))
        standardButtons: Kirigami.Dialog.Cancel
        onVisibleChanged: gallery.root.noteDialog(visible)
        customFooterActions: [
            Kirigami.Action {
                text: i18n("Overwrite")
                icon.name: "document-save"
                onTriggered: {
                    const ok = ShaderLibrarySingleton.saveShaderCode(gallery.root.shaderFileUrl(), saveTweaksPrompt.pendingCode)
                    saveTweaksPrompt.close()
                    if (ok) {
                        tweakSource.refresh()
                        gallery.root.setInlineCode("")
                        gallery.root.showStatus(i18n("Saved to the shader file."), Kirigami.MessageType.Positive)
                    } else {
                        gallery.root.showStatus(i18n("Could not write the shader file. System-wide shaders are read-only; use Save as New."),
                                                Kirigami.MessageType.Error)
                    }
                }
            }
        ]
    }

    Kirigami.PromptDialog {
        id: saveAsPrompt
        parent: QQC2.Overlay.overlay
        property string pendingCode
        title: i18n("Save as a New Shader")
        subtitle: i18n("The copy goes to the Imported category and becomes the current shader.")
        standardButtons: Kirigami.Dialog.Cancel
        onVisibleChanged: gallery.root.noteDialog(visible)
        onOpened: {
            saveAsName.text = i18nc("@info default name for a tweaked copy", "%1 (tweaked)", gallery.root.currentShaderName)
            saveAsName.selectAll()
            saveAsName.forceActiveFocus()
        }
        function save() {
            const name = saveAsName.text.trim()
            if (name.length === 0) return
            const url = ShaderLibrarySingleton.saveShaderAs(name, pendingCode, "Imported")
            close()
            if (url && url.toString().length > 0) gallery.root.applyShaderFromPath(url.toString())
            else gallery.root.showStatus(i18n("Could not save the shader."), Kirigami.MessageType.Error)
        }
        customFooterActions: [
            Kirigami.Action {
                text: i18n("Save")
                icon.name: "document-save-as"
                enabled: saveAsName.text.trim().length > 0
                onTriggered: saveAsPrompt.save()
            }
        ]
        QQC2.TextField {
            id: saveAsName
            Layout.fillWidth: true
            placeholderText: i18n("Shader name")
            onAccepted: saveAsPrompt.save()
        }
    }
}

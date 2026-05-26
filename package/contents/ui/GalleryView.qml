// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtCore
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "shaderwallpaper"

/**
 * Gallery view for browsing and selecting shaders
 */
Item {
    id: root
    
    // Card dimensions — 16:9 thumbnail area + ~40 px for the title +
    // perf badge below. Matches the 480×270 thumbnails captureFrame
    // generates so the gallery shows them without weird letterboxing
    // even on ultrawide screens.
    readonly property int cardWidth: 200
    readonly property int cardHeight: 152   // 200 * 9/16 = 112 thumb + ~40 footer
    readonly property int cardSpacing: Kirigami.Units.largeSpacing
    
    property string currentCategory: "All"
    property string searchQuery: ""
    property string selectedShaderId: ""
    property url selectedShaderPath

    // Recent-shader tracking. We keep up to 6 shaderIds in QSettings via
    // a JSON string and show a small chip on each card that's in the set.
    Settings {
        id: recentSettings
        category: "ShaderWallpaperGallery"
        property string recentJson: "[]"
    }
    property var recentShaderIds: JSON.parse(recentSettings.recentJson || "[]")
    function markRecent(id) {
        if (!id) return
        var list = recentShaderIds.filter(function(x) { return x !== id })
        list.unshift(id)
        if (list.length > 6) list.length = 6
        recentShaderIds = list
        recentSettings.recentJson = JSON.stringify(list)
    }
    function isRecent(id) {
        return recentShaderIds.indexOf(id) >= 0
    }

    signal shaderSelected(string id, url path, string name)

    // Ctrl+K / Ctrl+F to focus the search field — power-user shortcut.
    Shortcut {
        sequences: ["Ctrl+K", "Ctrl+F"]
        onActivated: { searchField.forceActiveFocus(); searchField.selectAll() }
    }
    
    // Models
    ShaderListModel {
        id: shaderModel
        category: root.currentCategory
        searchQuery: root.searchQuery
    }
    
    CategoryModel {
        id: categoryModel
    }
    
    ColumnLayout {
        anchors.fill: parent
        spacing: Kirigami.Units.smallSpacing

        // Search bar
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: Kirigami.Units.smallSpacing

            Kirigami.SearchField {
                id: searchField
                Layout.fillWidth: true
                placeholderText: i18n("Search shaders by name, author, or tag…")
                onTextChanged: root.searchQuery = text
            }

            Button {
                icon.name: "view-refresh"
                ToolTip.text: i18n("Re-scan shader library on disk")
                ToolTip.visible: hovered
                onClicked: ShaderLibrarySingleton.refresh()
            }
        }

        // Category chips that wrap onto multiple lines instead of being
        // horizontally scrolled off-screen. Hides categories with zero
        // shaders so the user isn't tempted to click empty tabs.
        Flow {
            id: categoryChips
            Layout.fillWidth: true
            Layout.leftMargin: Kirigami.Units.smallSpacing
            Layout.rightMargin: Kirigami.Units.smallSpacing
            spacing: Kirigami.Units.smallSpacing

            Repeater {
                model: categoryModel
                delegate: Button {
                    flat: true
                    checkable: true
                    checked: root.currentCategory === model.name
                    autoExclusive: true
                    visible: model.count > 0 || model.name === "All" || model.name === "Favorites"
                    padding: Kirigami.Units.smallSpacing

                    contentItem: RowLayout {
                        spacing: Kirigami.Units.smallSpacing
                        Kirigami.Icon {
                            source: model.icon || ""
                            Layout.preferredWidth: Kirigami.Units.iconSizes.small
                            Layout.preferredHeight: Kirigami.Units.iconSizes.small
                            visible: model.icon && model.icon.length > 0
                        }
                        Label {
                            text: model.name
                            verticalAlignment: Text.AlignVCenter
                        }
                        Label {
                            text: model.count
                            opacity: 0.6
                            font.pointSize: Kirigami.Theme.smallFont.pointSize
                            verticalAlignment: Text.AlignVCenter
                        }
                    }

                    onClicked: root.currentCategory = model.name
                }
            }
        }

        Kirigami.Separator {
            Layout.fillWidth: true
        }
        
        // Shader grid using Flickable + Flow for reliable layout
        Flickable {
            id: shaderFlickable
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: Kirigami.Units.smallSpacing
            
            contentWidth: width
            contentHeight: shaderFlow.height + root.cardSpacing
            clip: true
            
            flickableDirection: Flickable.VerticalFlick
            boundsBehavior: Flickable.StopAtBounds
            
            ScrollBar.vertical: ScrollBar {
                active: true
                policy: ScrollBar.AsNeeded
            }
            
            Flow {
                id: shaderFlow
                width: parent.width
                spacing: root.cardSpacing
                topPadding: root.cardSpacing / 2
                leftPadding: root.cardSpacing / 2
                
                Repeater {
                    id: shaderRepeater
                    model: shaderModel
                    
                    delegate: ShaderCard {
                        width: root.cardWidth
                        height: root.cardHeight
                        
                        shaderId: model.shaderId
                        shaderName: model.name
                        shaderPath: model.shaderPath
                        thumbnailPath: model.thumbnailPath
                        author: model.author
                        category: model.category
                        isFavorite: model.favorite
                        hasBuffers: model.hasBuffers
                        needsAudio: model.needsAudio
                        
                        // Performance data from metadata (with safe fallbacks)
                        performanceTier: (model.performanceTier !== undefined && model.performanceTier !== null) ? model.performanceTier : -1
                        averageFrameTime: (model.averageFrameTime !== undefined && model.averageFrameTime !== null) ? model.averageFrameTime : 0.0
                        powerCost: (model.estimatedPowerCost !== undefined && model.estimatedPowerCost !== null) ? model.estimatedPowerCost : 0
                        
                        selected: root.selectedShaderId === model.shaderId
                        
                        // Plumb through "is recent" state so the card can
                        // draw a small clock chip — see ShaderCard.qml.
                        recentlyUsed: root.isRecent(model.shaderId)

                        onClicked: {
                            // NOTE: we intentionally do NOT imperatively set
                            // root.selectedShaderId / selectedShaderPath here.
                            // The owner (ConfigContent's gallerySheet) binds
                            // them to the live cfg_selectedShaderPath so the
                            // card highlight follows whatever's actually
                            // applied to the wallpaper — clicking emits the
                            // signal, the owner calls applyShaderFromPath,
                            // the binding then ticks the highlight forward.
                            // Setting them here used to break that binding
                            // and the highlight got stuck on the first
                            // shader the user clicked after reopening the
                            // gallery.
                            root.markRecent(model.shaderId)
                            root.shaderSelected(model.shaderId, model.shaderPath, model.name)
                        }

                        onFavoriteToggled: {
                            shaderModel.toggleFavorite(index)
                        }
                    }
                }
            }
            
            // Empty state
            Label {
                anchors.centerIn: parent
                visible: shaderRepeater.count === 0
                text: searchQuery.length > 0 
                    ? i18n("No shaders found matching '%1'", searchQuery)
                    : i18n("No shaders in this category")
                opacity: 0.6
            }
        }
        
        // Status bar
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: Kirigami.Units.smallSpacing
            
            Label {
                text: i18np("%1 shader", "%1 shaders", shaderModel.count)
                opacity: 0.7
            }
            
            Item { Layout.fillWidth: true }
            
            Label {
                visible: root.selectedShaderId.length > 0
                text: i18n("Selected: %1", root.selectedShaderPath.toString().split("/").pop())
                opacity: 0.7
            }
        }
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later

import QtQuick
import QtQuick.Controls
import QtTest

Item {
    width: 900
    height: 700
    TestCase {
        id: test
        name: "ShaderWallpaperConfiguration"
        when: windowShown
        visible: true
        width: parent.width
        height: parent.height
        property var hosts: []
        Component { id: hostComponent; ConfigHost {} }

        function init() {
            hosts = []
            failOnWarning(/(TypeError|ReferenceError|RangeError|Maximum call stack)/)
        }
        function cleanup() {
            hosts.forEach(function(host) { host.destroy() })
            hosts = []
            wait(50)
        }
        function createHost(mode, map) {
            let host = hostComponent.createObject(test, {width: 900, height: 700, configuration: map, mode: mode})
            hosts.push(host)
            host.load()
            wait(100)
            verify(host.currentItem !== null)
            compare(host.temporaryInstances, 1)
            return host
        }
        function contentOf(item) {
            if (typeof item.applyShaderFromPath === "function") return item
            for (let i=0;i<item.children.length;++i) {
                let found=contentOf(item.children[i])
                if (found) return found
            }
            return null
        }
        function assertSettings(page, expected) {
            Object.keys(expected).forEach(function(key) {
                compare(JSON.stringify(page["cfg_"+key]), JSON.stringify(expected[key]), key)
            })
        }
        function test_openAndRestore_data() {
            return [{tag:"desktop",mode:"desktop"},{tag:"kcm",mode:"kcm"}]
        }
        function test_openAndRestore(data) {
            const original = {
                selectedShaderPath: "Shaders/CrumpledWave.frag",
                selectedShaderIndex: 84,
                shaderSpeed: 1.35,
                targetFps: 42,
                running: false,
                excludeWindows: ["org.kde.konsole", "firefox"],
                playlistShaders: ["Shaders/CrumpledWave.frag", "Shaders/PS3_MenuColor.frag"]
            }
            const map = Fixture.createProfile(original)
            let host = createHost(data.mode,map)
            let content = contentOf(host.currentItem)
            verify(content !== null,"Real ConfigContent was loaded")
            assertSettings(host.currentItem,original)
            assertSettings(content,original)
            compare(host.changes,0,"Opening must not emit configuration edits")
            const changed = {
                selectedShaderPath: "Shaders/PS3_MenuColor.frag",
                shaderSpeed: 1.75,
                targetFps: 30,
                running: true,
                excludeWindows: ["org.kde.dolphin"],
                playlistShaders: ["Shaders/PS3_MenuColor.frag"]
            }
            const galleries=Fixture.itemsByType(content,"GalleryView")
            compare(galleries.length,1,"Actual shader gallery was loaded")
            const gallery=galleries[0]
            tryVerify(function() { return Fixture.itemsByType(gallery,"ShaderCard").length > 0 },5000,
                      "Gallery must discover the fixture's real shader files")
            const cards=Fixture.itemsByType(gallery,"ShaderCard")
            let chosen=null
            cards.forEach(function(card) {
                if (card.shaderPath.toString().endsWith(changed.selectedShaderPath)) chosen=card
            })
            verify(chosen !== null,"Requested shader exists in gallery model")
            verify(chosen.shaderId.length > 0)
            verify(chosen.shaderName.length > 0)
            chosen.clicked()
            compare(content.cfg_selectedShaderPath,changed.selectedShaderPath)
            Object.keys(changed).forEach(function(key) {
                if (key !== "selectedShaderPath") content["cfg_"+key] = changed[key]
            })
            wait(100)
            assertSettings(host.currentItem,changed)
            verify(host.changes > 0)
            verify(host.changes < 200,"Configuration edits must have bounded notifications")
            const count=host.changes
            wait(100)
            compare(host.changes,count,"No ongoing feedback loop after edits")
            Object.keys(changed).forEach(function(key) {
                compare(JSON.stringify(map[key]),JSON.stringify(changed[key]),"live config "+key)
            })
            host.save()
            const restoredMap=Fixture.reopen(map)
            Object.keys(changed).forEach(function(key) {
                compare(JSON.stringify(restoredMap[key]),JSON.stringify(changed[key]),"persisted config "+key)
            })
            host.visible=false
            let restoredHost=createHost(data.mode,restoredMap)
            assertSettings(restoredHost.currentItem,changed)
            assertSettings(contentOf(restoredHost.currentItem),changed)
            compare(restoredHost.changes,0)
        }
        function test_displaysRemainIndependent() {
            const leftMap=Fixture.createProfile({selectedShaderPath:"Shaders/CrumpledWave.frag",shaderSpeed:1.0})
            const rightMap=Fixture.createProfile({selectedShaderPath:"Shaders/PS3_MenuColor.frag",shaderSpeed:0.5})
            const left=createHost("desktop",leftMap)
            left.visible=false
            const right=createHost("desktop",rightMap)
            contentOf(left.currentItem).cfg_shaderSpeed=2.0
            wait(100)
            compare(leftMap.shaderSpeed,2.0)
            compare(rightMap.shaderSpeed,0.5)
            compare(right.currentItem.cfg_shaderSpeed,0.5)
            compare(contentOf(right.currentItem).cfg_shaderSpeed,0.5)
        }
        function test_zeroWidthAndResize() {
            const map=Fixture.createProfile({selectedShaderPath:"Shaders/CrumpledWave.frag"})
            const host=hostComponent.createObject(test, {width:0,height:700,configuration:map})
            hosts.push(host)
            host.load()
            // Plasma can construct a page before assigning its final width.
            // A process watchdog catches layout freezes that stop this wait returning.
            wait(100)
            verify(host.currentItem !== null)
            const widths=[5,21,120,900,0,900]
            for (let i=0;i<widths.length;++i) {
                host.width=widths[i]
                wait(50)
            }
            let content=contentOf(host.currentItem)
            verify(content !== null)
            compare(content.cfg_selectedShaderPath,"Shaders/CrumpledWave.frag")
            verify(content.width > 0)
        }
    }
}

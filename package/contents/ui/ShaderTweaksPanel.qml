// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
//
// Shader Tweaks Panel
// ---------------------
// Parses a shader's source for tweakable top-level constants and exposes
// them as live controls:
//
//   * per-line, brace-aware parser that skips function bodies, comments,
//     and operator assignments like `c.r = 0.5;`
//   * optional metadata in trailing line comments:
//         float SPEED = 1.0; // @range(0.1, 5.0, 0.1) @label("Animation Speed")
//         vec3  TINT  = vec3(0.2, 0.4, 1.0); // @color @label("Background tint")
//   * colour detection for vec3 literals with all components in [0, 1]
//     (opt out with @vec3)
//
// originalSource supplies the declarations and their defaults;
// currentSource (the code that runs, possibly already tweaked or edited)
// supplies the current values and is the text that gets rewritten.
// tweaksChanged(code) carries the rewritten source, or "" when it equals
// originalSource. Emission is debounced: a slider drag produces one write.

import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

ColumnLayout {
    id: root

    property string originalSource: ""
    property string currentSource: ""
    property bool active: true
    readonly property int count: tweakables.count
    readonly property bool dirty: _dirty

    signal tweaksChanged(string modifiedCode)
    signal saveRequested(string modifiedCode)
    signal saveAsRequested(string modifiedCode)

    // Entry fields:
    //   name, kind ("float" | "color" | "vec3" | "int" | "define-float" |
    //   "define-int" | "bool"), line (0-based in originalSource),
    //   declaration, defaults, value, min, max, step, label, forceColor,
    //   forceVec3.
    // dynamicRoles: `value` holds a number in one row and an array in the
    // next; a static ListModel would coerce to the first row's type.
    ListModel { id: tweakables; dynamicRoles: true }

    property bool _dirty: false
    property string _pending: ""
    property string _lastEmitted: ""

    Timer {
        id: emitTimer
        interval: 300
        onTriggered: root._emit(root._pending)
    }

    onOriginalSourceChanged: Qt.callLater(_refresh)
    onCurrentSourceChanged: if (currentSource !== _lastEmittedFull) Qt.callLater(_refresh)
    onActiveChanged: Qt.callLater(_refresh)
    Component.onCompleted: _refresh()

    // The full text last handed out (or originalSource for ""), so the
    // round trip through the host does not re-parse.
    property string _lastEmittedFull: ""

    function _refresh() {
        // A pending emission belongs to the source being replaced.
        emitTimer.stop()
        _pending = ""
        _lastEmitted = ""
        tweakables.clear()
        _dirty = false
        if (!active || !originalSource || originalSource.length < 8) return
        const parsed = _parseTweakables(originalSource)
        const current = currentSource && currentSource !== originalSource
            ? _parseTweakables(currentSource) : []
        const currentByName = {}
        for (const c of current) currentByName[c.name] = c
        for (const t of parsed) {
            const c = currentByName[t.name]
            if (c && c.kind === t.kind) t.value = _clone(c.value)
            if (!_valueEquals(t.value, t.defaults)) _dirty = true
            // append() turns a JS array into a nested ListModel and drops
            // its numbers; setProperty() stores the array as is.
            tweakables.append(Object.assign({}, t, { value: 0, defaults: 0 }))
            tweakables.setProperty(tweakables.count - 1, "value", _clone(t.value))
            tweakables.setProperty(tweakables.count - 1, "defaults", _clone(t.defaults))
        }
        _lastEmittedFull = currentSource
    }

    // ------------------------------------------------------------------
    // Parser
    // ------------------------------------------------------------------
    function _parseTweakables(code) {
        const lines = code.split("\n")
        const results = []
        const seen = {}

        let braceDepth = 0
        let inBlockComment = false

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i]
            let work = line

            // Strip /* ... */ regions on this line, tracking multi-line state.
            let stripped = ""
            let j = 0
            while (j < work.length) {
                if (inBlockComment) {
                    const end = work.indexOf("*/", j)
                    if (end < 0) { j = work.length; }
                    else { j = end + 2; inBlockComment = false }
                } else {
                    const start = work.indexOf("/*", j)
                    if (start < 0) { stripped += work.substring(j); break }
                    stripped += work.substring(j, start)
                    j = start + 2
                    inBlockComment = true
                }
            }
            work = stripped

            // Line comments carry the @range / @label / @color metadata.
            let metaComment = ""
            const ci = work.indexOf("//")
            if (ci >= 0) {
                metaComment = work.substring(ci + 2)
                work = work.substring(0, ci)
            }

            // Brace depth: declarations inside function bodies are skipped.
            for (const ch of work) {
                if (ch === "{") braceDepth++
                else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1)
            }

            if (braceDepth > 0) continue
            if (work.trim().length === 0) continue

            const meta = _parseMetaComment(metaComment)
            const entry = _matchDeclaration(work, meta, i, line)
            if (!entry) continue
            if (seen[entry.name]) continue // first definition wins
            seen[entry.name] = true
            results.push(entry)
        }
        return results
    }

    function _parseMetaComment(comment) {
        const meta = {}
        if (!comment) return meta
        // @range(min, max[, step])
        const r = comment.match(/@range\s*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)(?:\s*,\s*([+-]?\d*\.?\d+))?\s*\)/)
        if (r) {
            meta.min  = parseFloat(r[1])
            meta.max  = parseFloat(r[2])
            meta.step = r[3] ? parseFloat(r[3]) : undefined
        }
        // @label("...") or @label('...')
        const l = comment.match(/@label\s*\(\s*["']([^"']+)["']\s*\)/)
        if (l) meta.label = l[1]
        // @color forces colour widget even outside [0,1]
        if (/@color\b/.test(comment)) meta.forceColor = true
        // @vec3 forces three spinboxes even when values look like a colour
        if (/@vec3\b/.test(comment))  meta.forceVec3 = true
        // @hidden completely suppresses a symbol
        if (/@hidden\b/.test(comment)) meta.hidden = true
        return meta
    }

    function _matchDeclaration(work, meta, lineIdx, originalLine) {
        if (meta.hidden) return null

        // const float NAME = 1.5;
        // float NAME = 1.5;
        let m = work.match(/^\s*(?:uniform\s+|const\s+)?float\s+([A-Za-z_]\w*)\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*;/)
        if (m) {
            const v = parseFloat(m[2])
            return _entry("float", m[1], v, lineIdx, originalLine, meta, {
                min: meta.min !== undefined ? meta.min : _guessFloatMin(v),
                max: meta.max !== undefined ? meta.max : _guessFloatMax(v),
                step: meta.step !== undefined ? meta.step : undefined
            })
        }

        // const int NAME = 4;
        m = work.match(/^\s*(?:uniform\s+|const\s+)?int\s+([A-Za-z_]\w*)\s*=\s*([+-]?\d+)\s*;/)
        if (m) {
            const v = parseInt(m[2], 10)
            return _entry("int", m[1], v, lineIdx, originalLine, meta, {
                min: meta.min !== undefined ? meta.min : Math.min(0, v),
                max: meta.max !== undefined ? meta.max : Math.max(16, v * 4 || 16),
                step: 1
            })
        }

        // const bool NAME = true|false;
        m = work.match(/^\s*(?:uniform\s+|const\s+)?bool\s+([A-Za-z_]\w*)\s*=\s*(true|false)\s*;/)
        if (m) {
            return _entry("bool", m[1], m[2] === "true", lineIdx, originalLine, meta, {})
        }

        // vec3 NAME = vec3(R, G, B);
        m = work.match(/^\s*(?:uniform\s+|const\s+)?vec3\s+([A-Za-z_]\w*)\s*=\s*vec3\s*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)\s*;/)
        if (m) {
            const r = parseFloat(m[2]), g = parseFloat(m[3]), b = parseFloat(m[4])
            const inUnit = (x) => (x >= 0 && x <= 1)
            const looksLikeColour = !meta.forceVec3 && (meta.forceColor || (inUnit(r) && inUnit(g) && inUnit(b)))
            const kind = looksLikeColour ? "color" : "vec3"
            return _entry(kind, m[1], [r, g, b], lineIdx, originalLine, meta, {
                min: meta.min !== undefined ? meta.min : (looksLikeColour ? 0.0 : Math.min(-1.0, Math.min(r, g, b))),
                max: meta.max !== undefined ? meta.max : (looksLikeColour ? 1.0 : Math.max(1.0, Math.max(r, g, b)))
            })
        }

        // #define NAME 1.5   (float)
        m = work.match(/^\s*#define\s+([A-Za-z_]\w*)\s+([+-]?\d+\.\d*|\.\d+|[+-]?\d+\.\d+)\s*$/)
        if (m) {
            const v = parseFloat(m[2])
            return _entry("define-float", m[1], v, lineIdx, originalLine, meta, {
                min: meta.min !== undefined ? meta.min : _guessFloatMin(v),
                max: meta.max !== undefined ? meta.max : _guessFloatMax(v),
                step: meta.step
            })
        }

        // #define NAME 42    (int)
        m = work.match(/^\s*#define\s+([A-Za-z_]\w*)\s+([+-]?\d+)\s*$/)
        if (m) {
            const v = parseInt(m[2], 10)
            return _entry("define-int", m[1], v, lineIdx, originalLine, meta, {
                min: meta.min !== undefined ? meta.min : Math.min(0, v),
                max: meta.max !== undefined ? meta.max : Math.max(16, v * 4 || 16),
                step: 1
            })
        }

        return null
    }

    function _entry(kind, name, defaultValue, line, originalLine, meta, extras) {
        const e = {
            kind: kind,
            name: name,
            label: meta.label || name,
            line: line,
            declaration: originalLine,
            defaults: _clone(defaultValue),
            value: _clone(defaultValue),
            min:   extras.min,
            max:   extras.max,
            step:  extras.step,
            forceColor: !!meta.forceColor,
            forceVec3:  !!meta.forceVec3
        }
        return e
    }

    function _clone(v) {
        const maybeVec = _asVec3Array(v)
        if (maybeVec) return maybeVec
        return v
    }

    function _asVec3Array(v) {
        function pack3(a, b, c) {
            const x = Number(a), y = Number(b), z = Number(c)
            if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null
            return [x, y, z]
        }
        // ListModel dynamic roles can surface arrays as model-like objects
        // (e.g. QQmlListModel), so normalize before arithmetic/mutation.
        if (Array.isArray(v)) {
            if (v.length !== 3) return null
            return pack3(v[0], v[1], v[2])
        }
        if (v && typeof v === "object") {
            if (typeof v.length === "number" && v.length === 3) {
                return pack3(v[0], v[1], v[2])
            }
            if (typeof v.count === "number" && v.count === 3 && typeof v.get === "function") {
                return pack3(v.get(0), v.get(1), v.get(2))
            }
        }
        return null
    }

    // Heuristic float-range bounds when the shader didn't annotate one.
    // Try to be useful for sliders without being absurd for unusual values.
    function _guessFloatMin(v) {
        if (v >= 0 && v <= 1) return 0
        if (v >= -1 && v <= 1) return -1
        if (v >= 0)            return 0
        return -Math.max(1, Math.abs(v) * 4)
    }
    function _guessFloatMax(v) {
        if (v >= 0 && v <= 1) return 1
        if (v >= -1 && v <= 1) return 1
        return Math.max(1, Math.abs(v) * 4)
    }

    // ------------------------------------------------------------------
    // Code rewriter
    // ------------------------------------------------------------------
    // Rewrites the declarations in currentSource (located by name, so hand
    // edits elsewhere in the file survive).
    function _recompute() {
        const base = currentSource && currentSource.length > 0 ? currentSource : originalSource
        const lines = base.split("\n")
        const lineByName = {}
        for (const d of _parseTweakables(base)) lineByName[d.name] = d.line
        let dirty = false
        for (let i = 0; i < tweakables.count; i++) {
            const t = tweakables.get(i)
            if (!_valueEquals(t.value, t.defaults)) dirty = true
            const lineIdx = lineByName[t.name]
            if (lineIdx === undefined || lineIdx < 0 || lineIdx >= lines.length) continue
            lines[lineIdx] = _rewriteLine(lines[lineIdx], t)
        }
        _dirty = dirty
        const out = lines.join("\n")
        _pending = out === originalSource ? "" : out
        _lastEmittedFull = out
        emitTimer.restart()
    }

    function _emit(code) {
        if (code === _lastEmitted) return
        _lastEmitted = code
        tweaksChanged(code)
    }

    // Applies any pending change now (e.g. before the dialog closes).
    function flush() {
        if (emitTimer.running) {
            emitTimer.stop()
            _emit(_pending)
        }
    }

    function _rewriteLine(line, t) {
        // Re-emit the declaration with the new literal value. Preserves
        // surrounding whitespace, qualifier (uniform/const), and any
        // trailing comment metadata.
        switch (t.kind) {
        case "float":
            return line.replace(
                /^(\s*(?:uniform\s+|const\s+)?float\s+\w+\s*=\s*)([+-]?(?:\d+\.?\d*|\.\d+))(\s*;)/,
                "$1" + _formatFloat(t.value) + "$3")
        case "int":
            return line.replace(
                /^(\s*(?:uniform\s+|const\s+)?int\s+\w+\s*=\s*)([+-]?\d+)(\s*;)/,
                "$1" + Math.round(t.value) + "$3")
        case "bool":
            return line.replace(
                /^(\s*(?:uniform\s+|const\s+)?bool\s+\w+\s*=\s*)(true|false)(\s*;)/,
                "$1" + (t.value ? "true" : "false") + "$3")
        case "color":
        case "vec3":
            return line.replace(
                /^(\s*(?:uniform\s+|const\s+)?vec3\s+\w+\s*=\s*vec3\s*\(\s*)([+-]?\d*\.?\d+)(\s*,\s*)([+-]?\d*\.?\d+)(\s*,\s*)([+-]?\d*\.?\d+)(\s*\)\s*;)/,
                "$1" + _formatFloat(t.value[0]) + "$3" + _formatFloat(t.value[1]) + "$5" + _formatFloat(t.value[2]) + "$7")
        case "define-float":
            return line.replace(
                /^(\s*#define\s+\w+\s+)([+-]?\d+\.\d*|\.\d+|[+-]?\d+\.\d+)(\s*)$/,
                "$1" + _formatFloat(t.value) + "$3")
        case "define-int":
            return line.replace(
                /^(\s*#define\s+\w+\s+)([+-]?\d+)(\s*)$/,
                "$1" + Math.round(t.value) + "$3")
        }
        return line
    }

    function _formatFloat(v) {
        // Compact but always parseable as a GLSL float literal.
        if (!isFinite(v)) return "0.0"
        if (Math.abs(v - Math.round(v)) < 1e-6) {
            return Math.round(v).toFixed(1)
        }
        return parseFloat(v.toFixed(4)).toString()
    }

    function _valueEquals(a, b) {
        const av = _asVec3Array(a)
        const bv = _asVec3Array(b)
        if (av && bv) {
            for (let i = 0; i < 3; i++) {
                if (Math.abs(av[i] - bv[i]) > 1e-6) return false
            }
            return true
        }
        if (typeof a === "number" && typeof b === "number") {
            return Math.abs(a - b) < 1e-6
        }
        return a === b
    }

    // ------------------------------------------------------------------
    // Public actions
    // ------------------------------------------------------------------
    function resetAll() {
        for (let i = 0; i < tweakables.count; i++) {
            const t = tweakables.get(i)
            tweakables.setProperty(i, "value", _clone(t.defaults))
        }
        _recompute()
    }

    function resetOne(index) {
        if (index < 0 || index >= tweakables.count) return
        const t = tweakables.get(index)
        tweakables.setProperty(index, "value", _clone(t.defaults))
        _recompute()
    }

    function setValue(index, newValue) {
        if (index < 0 || index >= tweakables.count) return
        tweakables.setProperty(index, "value", _clone(newValue))
        _recompute()
    }

    // ------------------------------------------------------------------
    // UI
    // ------------------------------------------------------------------
    spacing: Kirigami.Units.smallSpacing

    // Full tweaked source, or "" when it matches originalSource.
    readonly property string modifiedCode: _lastEmittedFull.length > 0 && _lastEmittedFull !== originalSource
        ? _lastEmittedFull : ""

    RowLayout {
        Layout.fillWidth: true
        spacing: Kirigami.Units.smallSpacing

        Label {
            Layout.fillWidth: true
            text: i18np("%1 adjustable value", "%1 adjustable values", tweakables.count)
            color: Kirigami.Theme.disabledTextColor
            elide: Text.ElideRight
        }
        ToolButton {
            text: i18n("Reset All")
            icon.name: "edit-undo"
            enabled: root._dirty
            onClicked: root.resetAll()
        }
        ToolButton {
            text: i18n("Save to File…")
            icon.name: "document-save"
            enabled: root.modifiedCode.length > 0
            ToolTip.visible: hovered
            ToolTip.text: i18n("Write the tweaked values into the shader file")
            onClicked: { root.flush(); root.saveRequested(root.modifiedCode) }
        }
        ToolButton {
            text: i18n("Save as New…")
            icon.name: "document-save-as"
            enabled: root.modifiedCode.length > 0
            ToolTip.visible: hovered
            ToolTip.text: i18n("Save the tweaked shader as a new file in your library")
            onClicked: { root.flush(); root.saveAsRequested(root.modifiedCode) }
        }
    }

    // The list of detected tweakables.
    Repeater {
        model: tweakables
        delegate: ColumnLayout {
            id: row
            Layout.fillWidth: true
            spacing: 2

            readonly property var modelRow: tweakables.get(index)
            readonly property bool isDirty: !!modelRow && !root._valueEquals(modelRow.value, modelRow.defaults)

            RowLayout {
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing

                // Dirty indicator + label
                Rectangle {
                    width: 8; height: 8; radius: 4
                    color: row.isDirty ? Kirigami.Theme.highlightColor : "transparent"
                    border.color: row.isDirty ? Kirigami.Theme.highlightColor : Kirigami.Theme.disabledTextColor
                    border.width: 1
                    Layout.alignment: Qt.AlignVCenter
                }

                Label {
                    text: model.label
                    Layout.preferredWidth: Math.max(Kirigami.Units.gridUnit * 6,
                                                    Math.min(implicitWidth, root.width * 0.3))
                    elide: Text.ElideRight
                    ToolTip.visible: labelHover.hovered
                    ToolTip.text: i18nc("@info:tooltip source declaration and line number", "%1 (line %2)",
                                        model.declaration.trim(), model.line + 1)
                    HoverHandler { id: labelHover }
                }

                // Per-kind control
                Loader {
                    id: control
                    Layout.fillWidth: true
                    sourceComponent: {
                        switch (model.kind) {
                        case "color":           return colorControl
                        case "vec3":            return vec3Control
                        case "bool":            return boolControl
                        case "int":
                        case "define-int":      return intControl
                        case "float":
                        case "define-float":    return floatControl
                        }
                        return null
                    }
                }

                ToolButton {
                    icon.name: "edit-undo"
                    enabled: row.isDirty
                    onClicked: root.resetOne(index)
                    ToolTip.visible: hovered
                    ToolTip.text: i18n("Reset to original value")
                }
            }

            // ----- per-kind control components ----------------------------
            Component {
                id: floatControl
                RowLayout {
                    spacing: Kirigami.Units.smallSpacing
                    property real _min: model.min !== undefined ? model.min : 0
                    property real _max: model.max !== undefined ? model.max : 1
                    property real _step: model.step !== undefined && model.step > 0 ? model.step : (_max - _min) / 200
                    // Snapping is done here: a stepSize on the Slider makes
                    // the desktop style draw one tick mark per step.
                    Slider {
                        id: slider
                        Layout.fillWidth: true
                        from: parent._min
                        to:   parent._max
                        value: model.value
                        onMoved: {
                            const st = parent._step
                            root.setValue(index, st > 0 ? Math.round((value - parent._min) / st) * st + parent._min : value)
                        }
                    }
                    Label {
                        text: Number(slider.value).toFixed(3)
                        font.family: "monospace"
                        Layout.preferredWidth: Kirigami.Units.gridUnit * 3.5
                        horizontalAlignment: Text.AlignRight
                    }
                }
            }

            Component {
                id: intControl
                RowLayout {
                    spacing: Kirigami.Units.smallSpacing
                    SpinBox {
                        Layout.fillWidth: true
                        from: model.min !== undefined ? model.min : 0
                        to:   model.max !== undefined ? model.max : 1024
                        value: model.value
                        editable: true
                        onValueModified: root.setValue(index, value)
                    }
                }
            }

            Component {
                id: boolControl
                Switch {
                    checked: model.value === true
                    onToggled: root.setValue(index, checked)
                }
            }

            Component {
                id: vec3Control
                RowLayout {
                    id: vecRow
                    spacing: Kirigami.Units.smallSpacing
                    // ListModel does not notify nested-array changes, so the
                    // components go through setValue instead of binding to
                    // row.modelRow.value[k].
                    Repeater {
                        model: 3
                        delegate: SpinBox {
                            id: comp
                            Layout.fillWidth: true
                            from: -1000000
                            to:    1000000
                            // step in 1000ths to give us 3 decimals via valueFromText
                            stepSize: 10
                            value: Math.round((row.modelRow ? row.modelRow.value[index] : 0) * 1000)
                            textFromValue: function(v) { return (v / 1000).toFixed(3) }
                            valueFromText: function(t) { return Math.round(parseFloat(t) * 1000) }
                            onValueModified: {
                                if (!row.modelRow) return
                                const v = root._asVec3Array(row.modelRow.value) || [0, 0, 0]
                                v[index] = value / 1000
                                root.setValue(_findIndex(row.modelRow.name), v)
                            }
                        }
                    }
                }
            }

            Component {
                id: colorControl
                RowLayout {
                    id: colRow
                    spacing: Kirigami.Units.smallSpacing
                    readonly property var rgb: row.modelRow
                        ? (root._asVec3Array(row.modelRow.value) || [0, 0, 0])
                        : [0, 0, 0]
                    readonly property color current: Qt.rgba(rgb[0], rgb[1], rgb[2], 1.0)

                    Rectangle {
                        width: 28; height: 28
                        radius: 4
                        color: colRow.current
                        border.width: 1
                        border.color: Kirigami.Theme.disabledTextColor
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: colorDialog.open()
                        }
                    }

                    Label {
                        Layout.preferredWidth: 90
                        text: "#" + _toHex(colRow.current.r) + _toHex(colRow.current.g) + _toHex(colRow.current.b)
                        font.family: "monospace"
                    }

                    // Per-channel quick-edit sliders
                    Repeater {
                        model: ["R", "G", "B"]
                        delegate: ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 0
                            Label { text: modelData; opacity: 0.7; font.pointSize: Kirigami.Theme.smallFont.pointSize }
                            Slider {
                                from: 0; to: 1
                                value: colRow.rgb[index]
                                onMoved: {
                                    if (!row.modelRow) return
                                    const v = root._asVec3Array(row.modelRow.value) || [0, 0, 0]
                                    v[index] = value
                                    root.setValue(_findIndex(row.modelRow.name), v)
                                }
                            }
                        }
                    }

                    ColorDialog {
                        id: colorDialog
                        selectedColor: colRow.current
                        onAccepted: {
                            const c = selectedColor
                            if (!row.modelRow) return
                            root.setValue(_findIndex(row.modelRow.name), [c.r, c.g, c.b])
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Helpers shared by delegates
    // ------------------------------------------------------------------
    function _toHex(c) {
        const v = Math.max(0, Math.min(255, Math.round(c * 255)))
        const s = v.toString(16)
        return s.length === 1 ? "0" + s : s
    }

    function _findIndex(name) {
        for (let i = 0; i < tweakables.count; i++) {
            if (tweakables.get(i).name === name) return i
        }
        return -1
    }
}

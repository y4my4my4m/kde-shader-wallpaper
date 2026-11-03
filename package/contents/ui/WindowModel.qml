/*
 *  Copyright 2018 Rog131 <samrog131@hotmail.com>
 *  Copyright 2019 adhe   <adhemarks2@gmail.com>
 *  Copyright 2024 Luis Bocanegra <luisbocanegra17b@gmail.com>
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  2.010-1301, USA.
 */

import QtQuick
import org.kde.taskmanager 0.1 as TaskManager
import org.kde.kwindowsystem

Item {
    id: wModel
    property var screenGeometry
    // Config map injected by the host (ShaderSystem.qml) — the PLM login
    // greeter provides no `wallpaper` context object to read directly.
    property var config: null
    property int pauseMode: config ? (config.pauseMode ?? 0) : 0
    property bool runShader: false
    property bool maximizedExists: false
    property bool visibleExists: false
    property bool activeExists: false
    // Pause mode 4: share of the screen covered by windows, or window count.
    property int pauseCoverage: config ? (config.pauseCoverage ?? 60) : 60
    property int pauseMinWindows: config ? (config.pauseMinWindows ?? 0) : 0
    property real coveredFraction: 0
    property int visibleWindowCount: 0
    property bool coverageExceeded: false
    property var abstractTasksModel: TaskManager.AbstractTasksModel
    property var geometryRole: abstractTasksModel.Geometry
    property var appId: abstractTasksModel.AppId
    property var isWindow: abstractTasksModel.IsWindow
    property var isMinimized: abstractTasksModel.IsMinimized
    property var isMaximized: abstractTasksModel.IsMaximized
    property var isFullScreen: abstractTasksModel.IsFullScreen
    property var isActive: abstractTasksModel.IsActive
    property var isHidden: abstractTasksModel.IsHidden
    property bool activeScreenOnly: config ? (config.checkActiveScreen ?? true) : true
    property var excludeWindows: config && config.excludeWindows ? Array.prototype.slice.call(config.excludeWindows) : []

    Connections {
        target: wModel.config
        enabled: wModel.config !== null
        function onValueChanged() {
            updateWindowsInfo();
        }
    }

    Connections {
        target: KWindowSystem
        function onShowingDesktopChanged() {
            updateWindowsInfo();
        }
    }

    onPauseModeChanged: {
        updateWindowsInfo();
    }

    onActiveScreenOnlyChanged: {
        updateWindowsInfo();
    }

    function updateRun() {
        let shouldRun = true;
        switch (pauseMode) {
        case 0:
            shouldRun = !maximizedExists;
            break;
        case 1:
            shouldRun = !activeExists;
            break;
        case 2:
            shouldRun = !visibleExists;
            break;
        case 3:
            shouldRun = true;
            break;
        case 4:
            shouldRun = !coverageExceeded;
        }
        runShader = shouldRun;
    }

    onPauseCoverageChanged: updateWindowsInfo()
    onPauseMinWindowsChanged: updateWindowsInfo()
    onScreenGeometryChanged: updateWindowsInfo()

    // Area of the union of rects, clipped to the screen, as a fraction of it.
    // Coordinate compression: fine for the handful of windows on a desktop.
    function unionFraction(rects, scr) {
        if (!scr || scr.width <= 0 || scr.height <= 0 || rects.length === 0)
            return 0;
        const clipped = [];
        for (const r of rects) {
            const x1 = Math.max(r.x, scr.x), y1 = Math.max(r.y, scr.y);
            const x2 = Math.min(r.x + r.width, scr.x + scr.width);
            const y2 = Math.min(r.y + r.height, scr.y + scr.height);
            if (x2 > x1 && y2 > y1)
                clipped.push([x1, y1, x2, y2]);
        }
        if (clipped.length === 0)
            return 0;
        // Plain loops: Plasma's JS engine has no Array.prototype.flatMap.
        const xs = [], ys = [];
        for (const c of clipped) {
            if (xs.indexOf(c[0]) < 0) xs.push(c[0]);
            if (xs.indexOf(c[2]) < 0) xs.push(c[2]);
            if (ys.indexOf(c[1]) < 0) ys.push(c[1]);
            if (ys.indexOf(c[3]) < 0) ys.push(c[3]);
        }
        xs.sort((a, b) => a - b);
        ys.sort((a, b) => a - b);
        let area = 0;
        for (let i = 0; i + 1 < xs.length; i++) {
            for (let j = 0; j + 1 < ys.length; j++) {
                const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
                if (clipped.some(c => cx > c[0] && cx < c[2] && cy > c[1] && cy < c[3]))
                    area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
            }
        }
        return area / (scr.width * scr.height);
    }

    TaskManager.VirtualDesktopInfo {
        id: virtualDesktopInfo
    }

    TaskManager.ActivityInfo {
        id: activityInfo
        readonly property string nullUuid: "00000000-0000-0000-0000-000000000000"
    }

    TaskManager.TasksModel {
        id: tasksModel
        sortMode: TaskManager.TasksModel.SortVirtualDesktop
        groupMode: TaskManager.TasksModel.GroupDisabled
        virtualDesktop: virtualDesktopInfo.currentDesktop
        activity: activityInfo.currentActivity
        screenGeometry: wModel.screenGeometry
        filterByVirtualDesktop: true
        filterByScreen: activeScreenOnly
        filterByActivity: true
        filterMinimized: true

        onActiveTaskChanged: {
            updateWindowsInfo();
        }
        onDataChanged: {
            updateWindowsInfo();
        }
        onCountChanged: {
            updateWindowsInfo();
        }
    }

    function updateWindowsInfo() {
        let activeCount = 0;
        let visibleCount = 0;
        let maximizedCount = 0;
        const rects = [];

        if (!KWindowSystem.showingDesktop) {
            for (var i = 0; i < tasksModel.count; i++) {
                const currentTask = tasksModel.index(i, 0);

                if (currentTask === undefined)
                    continue;
                // AppId is undefined for windows without a desktop file.
                const taskAppId = String(tasksModel.data(currentTask, appId) || "").replace(/\.desktop$/, "");
                if ((taskAppId.length > 0 && excludeWindows.includes(taskAppId))
                        || tasksModel.data(currentTask, isHidden)
                        || !tasksModel.data(currentTask, isWindow)
                        || tasksModel.data(currentTask, isMinimized))
                    continue;

                visibleCount += 1;
                const g = tasksModel.data(currentTask, geometryRole);
                if (g && g.width > 0 && g.height > 0)
                    rects.push(g);
                if (tasksModel.data(currentTask, isMaximized) || tasksModel.data(currentTask, isFullScreen))
                    maximizedCount += 1;
                if (tasksModel.data(currentTask, isActive))
                    activeCount += 1;
            }
        }

        visibleExists = visibleCount > 0;
        maximizedExists = maximizedCount > 0;
        activeExists = activeCount > 0;
        visibleWindowCount = visibleCount;
        // A maximized or full-screen window always counts as covering the screen.
        coveredFraction = maximizedCount > 0 ? 1 : unionFraction(rects, screenGeometry);
        coverageExceeded = (pauseCoverage > 0 && coveredFraction * 100 >= pauseCoverage)
                        || (pauseMinWindows > 0 && visibleCount >= pauseMinWindows);
        updateRun();
    }
}
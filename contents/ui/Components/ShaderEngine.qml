import QtQuick 2.12
import QtQuick.Controls 2.12

import org.kde.taskmanager 0.1 as TaskManager
import org.kde.plasma.core 2.0 as PlasmaCore
/*
vec3        iResolution             image/buffer        The viewport resolution (z is pixel aspect ratio, usually 1.0)
float       iTime                   image/sound/buffer	Current time in seconds
float       iTimeDelta              image/buffer        Time it takes to render a frame, in seconds
int         iFrame                  image/buffer        Current frame
float       iFrameRate              image/buffer        Number of frames rendered per second
float       iChannelTime[4]         image/buffer        Time for channel (if video or sound), in seconds
vec3        iChannelResolution[4]	  image/buffer/sound	Input texture resolution for each channel
vec4        iMouse                  image/buffer        xy = current pixel coords (if LMB is down). zw = click pixel
sampler2D	  iChannel{i}             image/buffer/sound	Sampler for input textures i
vec4        iDate                   image/buffer/sound	Year, month, day, time in seconds in .xyzw
float       iSampleRate             image/buffer/sound	The sound sample rate (typically 44100)
*/
ShaderEffect {
    id: shader

    //properties for shader

    //not pass to shader
    readonly property vector3d defaultResolution: Qt.vector3d(shader.width, shader.height, shader.width / shader.height)
    function calcResolution(channel) {
        if (channel) {
            return Qt.vector3d(channel.width, channel.height, channel.width / channel.height);
        } else {
            return defaultResolution;
        }
    }
    //pass
    readonly property vector3d  iResolution: defaultResolution
    property real       iTime: 0
    property real       iTimeDelta: 100
    property int        iFrame: 10
    property real       iFrameRate
    property double     shaderSpeed: 1.0
    property vector4d   iMouse;
    property var        iChannel0: ich0; //only Image or ShaderEffectSource
    property var        iChannel1: ich1; //only Image or ShaderEffectSource
    property var        iChannel2: ich2; //only Image or ShaderEffectSource
    property var        iChannel3: ich3; //only Image or ShaderEffectSource
    property var        iChannelTime: [0, 1, 2, 3]
    property var        iChannelResolution: [calcResolution(iChannel0), calcResolution(iChannel1), calcResolution(iChannel2), calcResolution(iChannel3)]
    property vector4d   iDate;
    property real       iSampleRate: 44100

    Image {
      id: ich0
      source: wallpaper.configuration.iChannel0_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel0) : ''
      visible:false
    }
    Image {
      id: ich1
      source: wallpaper.configuration.iChannel1_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel1) : ''
      visible:false
    }
    Image {
      id: ich2
      source: wallpaper.configuration.iChannel2_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel2) : ''
      visible:false
    }
    Image {
      id: ich3
      source: wallpaper.configuration.iChannel3_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel3) : ''
      visible: false
    }

    //properties for Qml controller
    property alias hoverEnabled: mouse.hoverEnabled
    property bool running: wallpaper.configuration.running
    function restart() {
        shader.iTime = 0
        running = true
        timer1.restart()
    }
    Timer {
        id: timer1
        running: shader.running
        triggeredOnStart: true
        interval: 16
        repeat: true
        onTriggered: {
            shader.iTime += 0.016 * wallpaper.configuration.shaderSpeed; // TODO: surely not the right way to do this?.. oh well..
        }
    }
    Timer {
        running: shader.running
        interval: 1000
        onTriggered: {
            var date = new Date();
            shader.iDate.x = date.getFullYear();
            shader.iDate.y = date.getMonth();
            shader.iDate.z = date.getDay();
            shader.iDate.w = date.getSeconds()
        }
    }
    MouseArea {
        id: mouse
        anchors.fill: parent
        onPositionChanged: {
            shader.iMouse.x = mouseX
            shader.iMouse.y = mouseY
        }
        onClicked: {
            shader.iMouse.z = mouseX
            shader.iMouse.w = mouseY
        }
    }

    readonly property string gles2Ver: "
      #define texture texture2D
      precision mediump float;"

    readonly property string gles3Ver: "#version 300 es
      #define varying in
      #define gl_FragColor fragColor
      precision mediump float;

      out vec4 fragColor;"

    readonly property string gl3Ver: "
      #version 150
      #define varying in
      #define gl_FragColor fragColor
      #define lowp
      #define mediump
      #define highp

      out vec4 fragColor;"

    readonly property string gl3Ver_igpu: "
      #version 130
      #define varying in
      #define gl_FragColor fragColor
      #define lowp
      #define mediump
      #define highp

      out vec4 fragColor;"

    readonly property string gl2Ver: "
      #version 110
      #define texture texture2D"

    property string versionString: {
        if (Qt.platform.os === "android") {
            if (GraphicsInfo.majorVersion === 3) {
                console.log("android gles 3")
                return gles3Ver
            } else {
                console.log("android gles 2")
                return gles2Ver
            }
        }
        else if (wallpaper.configuration.checkGl3Ver==true){
          // console.log("gl3Ver_igpu")
          return gl3Ver_igpu
        }else {
            if (GraphicsInfo.majorVersion === 3 ||GraphicsInfo.majorVersion === 4) {
                return gl3Ver
            } else {
                return gl2Ver
            }
        }
    }

    vertexShader: "
        uniform mat4 qt_Matrix;
        attribute vec4 qt_Vertex;
        attribute vec2 qt_MultiTexCoord0;
        varying vec2 qt_TexCoord0;
        varying vec4 vertex;
        void main() {
            vertex = qt_Vertex;
            gl_Position = qt_Matrix * vertex;
            qt_TexCoord0 = qt_MultiTexCoord0;
        }"

    readonly property string forwardString: versionString + "
        varying vec2 qt_TexCoord0;
        varying vec4 vertex;
        uniform lowp   float qt_Opacity;

        uniform vec3   iResolution;
        uniform float  iTime;
        uniform float  iTimeDelta;
        uniform int    iFrame;
        uniform float  iFrameRate;
        uniform float  iChannelTime[4];
        uniform vec3   iChannelResolution[4];
        uniform vec4   iMouse;
        uniform vec4    iDate;
        uniform float   iSampleRate;
        uniform sampler2D   iChannel0;
        uniform sampler2D   iChannel1;
        uniform sampler2D   iChannel2;
        uniform sampler2D   iChannel3;"

    readonly property string startCode: "
        void main(void)
        {
            mainImage(gl_FragColor, vec2(vertex.x, iResolution.y - vertex.y));
        }"

    readonly property string defaultPixelShader: "
        void mainImage(out vec4 fragColor, in vec2 fragCoord)
        {
            fragColor = vec4(fragCoord, fragCoord.x, fragCoord.y);
        }"

    property string pixelShader: wallpaper.configuration.selectedShaderContent;
    fragmentShader: forwardString + (pixelShader ? pixelShader : defaultPixelShader) + startCode


    // Performance
    property bool runShader: true
    property bool smartPlay: wallpaper.configuration.checkedSmartPlay

    TaskManager.VirtualDesktopInfo { id: virtualDesktopInfo }
    TaskManager.ActivityInfo { id: activityInfo }
    TaskManager.TasksModel {
        id: tasksModel
        sortMode: TaskManager.TasksModel.SortVirtualDesktop
        groupMode: TaskManager.TasksModel.GroupDisabled

        activity: activityInfo.currentActivity
        virtualDesktop: virtualDesktopInfo.currentDesktop
        screenGeometry: wallpaper.screenGeometry // Warns "Unable to assign [undefined] to QRect" during init, but works thereafter.

        filterByActivity: true
        filterByVirtualDesktop: true
        filterByScreen: true

        // onActiveTaskChanged: updateWindowsinfo(shader.smartPlay)
        // onDataChanged: updateWindowsinfo(shader.smartPlay)
        Component.onCompleted: {
            onlyWindowsModel.sourceModel = tasksModel
        }
    }

    PlasmaCore.SortFilterModel {
        id: onlyWindowsModel
        filterRole: 'IsWindow'
        filterRegExp: 'true'
        onDataChanged: updateWindowsinfo(shader.smartPlay)
    }

    function setRunning(running) {
        console.log(running?'shader restarted':'shader stopped')
        runShader = running
        shader.running = running
    }

    function contains(rectOuter, rectInner){
        return rectOuter.left <= rectInner.left &&
            rectOuter.top <= rectInner.top &&
            rectOuter.bottom >= rectInner.bottom &&
            rectOuter.right >= rectInner.right
    }
    function updateShaderEffect(screenGeometry, winGeometry, index = 0){
        let varRegex = /vec2\s(o[0-9])\s=\svec2(\([+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+\))/g;

        let currentShaderContent = wallpaper.configuration.selectedShaderContent;
        let matches = currentShaderContent.match(varRegex);
        // console.log(`matches: ${matches}`);
        let matched = matches[index]; // only need to modify requested;
        // console.log(`matched: ${matched}`);

        // find groups within matched pattern
        let matchedGroup = varRegex.exec(matched);
        varRegex.lastIndex = 0; // RESET REGEX INDEX !!!!
        // console.log(`matchedgroup ${matchedGroup}`)
        // console.log(`matchedGroup 1: ${matchedGroup[1]}`); // variable's name
        // console.log(`matchedGroup 2: ${matchedGroup[2]}`); // variable's value
        if (matchedGroup){
          let newVariable;
          let newValue;
          if(matchedGroup[1] == 'o1') {
            console.log('OONE');
            console.log('sG.r: '+screenGeometry.right);
            console.log('wG.l: '+winGeometry.left);
            console.log('wG.l/sG.r: '+winGeometry.left/screenGeometry.right+'\n\n');
            console.log('sG.b: '+screenGeometry.bottom);
            console.log('wG.b: '+winGeometry.bottom);
            console.log('wG.t/sG.b: '+(screenGeometry.bottom - winGeometry.bottom) / screenGeometry.bottom+'\n\n');

            newValue = '('+winGeometry.left/screenGeometry.right+','+ (screenGeometry.bottom - winGeometry.bottom) / screenGeometry.bottom+')';
            newVariable = matched.replace(matchedGroup[2],newValue);
          }
          if(matchedGroup[1] == 'o2') {
            console.log('OTWO');
            console.log('wG.r/wG.r: '+winGeometry.left/screenGeometry.right+'\n');
            // console.log('wG.t/sG.b: '+winGeometry.top / screenGeometry.bottom+'\n\n\n');
            newValue = '('+winGeometry.right/screenGeometry.right+','+(screenGeometry.bottom - winGeometry.bottom) / screenGeometry.bottom+')';
            newVariable = matched.replace(matchedGroup[2],newValue);
          }
          // if(matchedGroup[1] == 'o3') {
          //   newVariable = matched.replace(matchedGroup[2],'(0.'+geometry.right+',0.'+geometry.top+')');
          // }
          // if(matchedGroup[1] == 'o4') {
          //   newVariable = matched.replace(matchedGroup[2],'(0.'+geometry.right+',0.'+geometry.bottom+')');
          // }

          // if (contains(screenGeometry, winGeometry)){
            // console.log(`OLD VALUE: ${matchedGroup[2]} || NEW VALUE: ${newValue} || NEW VARIABLE ${newVariable}`)
            currentShaderContent = currentShaderContent.replace(matched, newVariable);
            // assign modified var to current shader
            wallpaper.configuration.selectedShaderContent = currentShaderContent;
          // }

        }

    }
    function updateWindowsinfo(smartPlay) {
        const screenGeometry = shader.parent.parent.parent.screenGeometry;

        let appWindows = [];

        // if(WindowLine){
          for (let i = 0 ; i < onlyWindowsModel.count ; i++){
              let appWindow = onlyWindowsModel.get(i)
              if (!appWindow.IsMinimized){
                // if(i=0){
                  // wallpaper.configuration.win0_top    = appWindow.Geometry.top;
                  // wallpaper.configuration.win0_bottom = appWindow.Geometry.bottom;
                  // wallpaper.configuration.win0_left   = appWindow.Geometry.left;
                  // wallpaper.configuration.win0_right  = appWindow.Geometry.right;
                  updateShaderEffect(screenGeometry, appWindow.Geometry,0);
                  updateShaderEffect(screenGeometry, appWindow.Geometry,1);
                // }
                // appWindows.push(appWindow.Geometry);
              }
          }
        // }

        if(!smartPlay){
            setRunning(true)
        } else {
            for (let i = 0 ; i < onlyWindowsModel.count ; i++){
                let appWindow = onlyWindowsModel.get(i)
                if (!appWindow.IsMinimized){
                    if (appWindow.IsFullScreen || appWindow.IsMaximized){
                        // This is a crude way to check if window is on the same
                        // screen as the shader for multi monitor setups.
                        // Ideally it would check the other way around
                        // (check if screenGeometry is contained within window,
                        // which would mean that the whole screen is covered
                        // by the window), but this doesn't work on the main
                        // screen because of the taskbar
                        if (contains(screenGeometry, appWindow.Geometry)){
                            setRunning(false)
                            return
                        }
                    }
                }
            }
            setRunning(true)
        }
    }
}

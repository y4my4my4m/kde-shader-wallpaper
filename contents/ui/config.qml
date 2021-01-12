import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import QtQuick.Dialogs 1.3
import Qt.labs.folderlistmodel 2
import "./Components"

import org.kde.plasma.core 2.0 as PlasmaCore

Item {
  property alias cfg_selectedShader:   selectedShaderField.text
  property alias cfg_checkGl3Ver:      checkGl3Ver.checked
  property alias cfg_checkedSmartPlay: checkedSmartPlay.checked
  property alias cfg_iChannel0_flag:   iChannel0_flag.checked
  property alias cfg_iChannel1_flag:   iChannel1_flag.checked
  property alias cfg_iChannel2_flag:   iChannel2_flag.checked
  property alias cfg_iChannel3_flag:   iChannel3_flag.checked


  // Resume/Pause
  ColumnLayout {
    spacing: units.largeSpacing
    Layout.fillWidth: true

    Label {
      width:100
      text: i18n("Pause:")
    }

    RowLayout{

      ImageBtn {
          width: 32
          height: 32
          imageUrl: isPaused ?  "./Resources/play.svg" : "./Resources/pause.svg"
          tipText: isPaused ? "Resume" : "Pause"
          property bool isPaused: false
          onClicked: {
              wallpaper.configuration.running = isPaused
              isPaused = !isPaused;
          }
          Rectangle {
              anchors.fill: parent
              color: "transparent"
              border.width: parent.containsMouse ? 1 : 0
              border.color: "gray"
          }
      }

      Text {
          text: wallpaper.configuration.running ? fpsItem.fps + " fps" : "stopped"
          color: "white"
          anchors.verticalCenter: parent.verticalCenter
      }

    }
  }

  //**********************
  //*** Configuration  ***
  //**********************
  ColumnLayout {

    //************************
    //*** Shader Selection ***
    //************************

    ColumnLayout {

      RowLayout {

        Label {
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: formAlignment - units.largeSpacing /2
          horizontalAlignment: Text.AlignRight
          text: "Selected Shader:"
        }

        ComboBox {
          id: selectedShader
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: 435
          model: FolderListModel {
            id: folderListModel
            showDirs: false
            nameFilters: ["*.frag"]
            folder: "./Shaders"
          }
          delegate: Component {
            id: folderListDelegate
            ItemDelegate {
                text: fileBaseName.replace("_"," ")
             }
          }

          textRole: "fileBaseName"
          displayText: currentText.replace("_"," ")

          onCurrentTextChanged: {
            selectedShaderField.text = Qt.resolvedUrl("./Shaders/"+model.get(currentIndex, "fileName"));
            getShaderContent();
          }
        }
      }

      RowLayout {

        Label {
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: formAlignment - units.largeSpacing /2
          horizontalAlignment: Text.AlignRight
          text: "Shader Path:"
        }

        TextField {
          id: selectedShaderField
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: 435
          onEditingFinished: {
            selectedShaderField.text;
            getShaderContent();
          }
        }

        Button {
          id: imageButton
          implicitWidth: height
          PlasmaCore.IconItem {
            anchors.fill: parent
            source: "document-open"
            PlasmaCore.ToolTipArea {
              anchors.fill: parent
              subText: "Pick Shader"
            }
          }
          MouseArea {
            anchors.fill: parent
            onClicked: {
              fileDialog.folder = fileDialog.shortcuts.home+"/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders/"
              fileDialog.open()
            }
          }
        }

      }

    }

    //********************************
    //*** GUI Shader Customization ***
    //********************************

    // Title
    RowLayout {
      Layout.topMargin: 25
      Layout.bottomMargin: 5

      Text {
        width:100
        font.bold: true
        color: "white"
        font.pointSize: 16
        text: i18n("Customization:")
      }
      Rectangle{
        Layout.fillWidth: true
        height: 1
        color: Qt.rgba(255,255,255,0.25);
      }
    }
    // Content FIXME: ScrollView doesnt actually scroll?
    ScrollView {
      id: scrollview
      clip: true
      Layout.fillWidth: true
      Layout.fillHeight: true
      contentItem:scrollviewContent
      ScrollBar.vertical.policy: ScrollBar.AlwaysOn
      // ScrollBar.vertical.visible: ScrollBar.vertical.size < 1
      ScrollBar.horizontal.policy: ScrollBar.AlwaysOn
      // ScrollBar.horizontal.visible: ScrollBar.horizontal.size < 1
      padding: 10

      ColumnLayout{
        id: scrollviewContent
        //**************
        //*** Global ***
        //**************

        // Shader Speed
        RowLayout {

          Text {
            color: "white"
            padding: 5
            width:100
            text: i18n("Speed: %1\n(default is 1.0)", wallpaper.configuration.shaderSpeed)
          }

          Slider {
            from: -10.0
            to: 10.0
            id: speedSlider
            stepSize: 0.01
            Layout.fillWidth: true
            value: wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0
            onValueChanged: wallpaper.configuration.shaderSpeed = value
          }
          Text {
            text: ""
            padding: 5
          }
          Rectangle{
            anchors.fill: parent
            // anchors.centerIn: parent
            border.color: Qt.rgba(255,255,255,0.05)
            border.width: 1
            radius: 4
            color: "transparent"
          }
        }


        //*******************
        //*** Vec3s/Vars ***
        //*******************

        // Customization elements
        GridLayout{
          columns:2

          // iChannels
          ColumnLayout {
            Layout.columnSpan: 1
            Rectangle{
              Layout.fillHeight: true
              Layout.fillWidth: true
              anchors.fill: parent
              // anchors.centerIn: parent
              border.color: Qt.rgba(255,255,255,0.05)
              border.width: 1
              radius: 4
              color: "transparent"
            }
            ColumnLayout{

              Layout.fillHeight: true
              Layout.fillWidth: true
              anchors.verticalCenter: parent.verticalCenter
              anchors.horizontalCenter: parent.horizontalCenter
              // iChannel0
              RowLayout {
                spacing: units.largeSpacing / 2
                anchors.horizontalCenter: parent.horizontalCenter
                Text {
                  color: "white"
                  padding: 5
                  text: "iChannel0:"
                }
                CheckBox {
                  id: iChannel0_flag
                  width: 35
                  checked: false
                  onCheckedChanged: {
                    if (!checked) wallpaper.configuration.iChannel0 = ""
                    else wallpaper.configuration.iChannel0 = iChannel0Field.text;
                    getShaderContent();
                  }
                }
                TextField {
                  id: iChannel0Field
                  placeholderText: "path to iChannel0"
                  text: wallpaper.configuration.iChannel0
                  // opacity: 0.45
                  // enabled: false
                  onEditingFinished: {
                    wallpaper.configuration.iChannel0 =  iChannel0Field.text;
                    getShaderContent();
                  }
                }

                Button {
                  implicitWidth: height
                  PlasmaCore.IconItem {
                    anchors.fill: parent
                    source: "document-open"
                    PlasmaCore.ToolTipArea {
                      anchors.fill: parent
                      subText: "Load iChannel Image/Shader"
                    }
                  }
                  MouseArea {
                    anchors.fill: parent
                    onClicked: {
                      fileDialog_ich0.folder = fileDialog_ich0.shortcuts.home+"/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/"
                      fileDialog_ich0.open()
                    }
                  }
                }

              }
              // iChannel1
              RowLayout {
                spacing: units.largeSpacing / 2
                anchors.horizontalCenter: parent.horizontalCenter
                Text {
                  color: "white"
                  padding: 5
                  text: "iChannel1:"
                }
                CheckBox {
                  id: iChannel1_flag
                  width: 35
                  checked: false
                  onCheckedChanged: {
                    if (!checked) wallpaper.configuration.iChannel1 = ""
                    else wallpaper.configuration.iChannel1 = iChannel1Field.text;
                    getShaderContent();
                  }
                }
                TextField {
                  id: iChannel1Field
                  placeholderText: "path to iChannel1"
                  text: wallpaper.configuration.iChannel1
                  onEditingFinished: {
                      if(iChannel1Field.text !== "") iChannel1_flag.checked
                      wallpaper.configuration.iChannel1 = iChannel1Field.text;
                      getShaderContent();
                  }
                  // opacity: 0.45
                  // enabled: false
                }
                Button {
                  implicitWidth: height
                  PlasmaCore.IconItem {
                    anchors.fill: parent
                    source: "document-open"
                    PlasmaCore.ToolTipArea {
                      anchors.fill: parent
                      subText: "Load iChannel Image/Shader"
                    }
                  }
                  MouseArea {
                    anchors.fill: parent
                    onClicked: {
                      fileDialog_ich1.folder = fileDialog_ich1.shortcuts.home+"/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/"
                      fileDialog_ich1.open()
                    }
                  }
                }
              }
              // iChannel2
              RowLayout {
                spacing: units.largeSpacing / 2
                anchors.horizontalCenter: parent.horizontalCenter
                Text {
                  color: "white"
                  padding: 5
                  text: "iChannel2:"
                }
                CheckBox {
                  id: iChannel2_flag
                  width: 35
                  checked: false
                  onCheckedChanged: {
                    if (!checked) wallpaper.configuration.iChannel2 = ""
                    else wallpaper.configuration.iChannel2 = iChannel2Field.text;
                    getShaderContent();
                  }
                }
                TextField {
                  id: iChannel2Field
                  placeholderText: "path to iChannel2"
                  text: wallpaper.configuration.iChannel2
                  onEditingFinished: {
                    wallpaper.configuration.iChannel2 = iChannel2Field.text;
                    getShaderContent();
                  }
                  // opacity: 0.45
                  // enabled: false
                }
                Button {
                  implicitWidth: height
                  PlasmaCore.IconItem {
                    anchors.fill: parent
                    source: "document-open"
                    PlasmaCore.ToolTipArea {
                      anchors.fill: parent
                      subText: "Load iChannel Image/Shader"
                    }
                  }
                  MouseArea {
                    anchors.fill: parent
                    onClicked: {
                      fileDialog_ich2.folder = fileDialog_ich2.shortcuts.home+"/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/"
                      fileDialog_ich2.open()
                    }
                  }
                }
              }
              // iChannel3
              RowLayout {
                spacing: units.largeSpacing / 2
                anchors.horizontalCenter: parent.horizontalCenter
                Text {
                  color: "white"
                  padding: 5
                  text: "iChannel3:"
                }
                CheckBox {
                  id: iChannel3_flag
                  width: 35
                  checked: false
                  onCheckedChanged: {
                    if (!checked) wallpaper.configuration.iChannel3 = ""
                    else wallpaper.configuration.iChannel3 = iChannel3Field.text;
                    getShaderContent();
                  }
                }
                TextField {
                  id: iChannel3Field
                  placeholderText: "path to iChannel3"
                  text: wallpaper.configuration.iChannel3
                  onEditingFinished: {
                    wallpaper.configuration.iChannel3 = iChannel3Field.text;
                    getShaderContent();
                  }
                  // opacity: 0.45
                  // enabled: false
                }

                Button {
                  implicitWidth: height
                  PlasmaCore.IconItem {
                    anchors.fill: parent
                    source: "document-open"
                    PlasmaCore.ToolTipArea {
                      anchors.fill: parent
                      subText: "Load iChannel Image/Shader"
                    }
                  }
                  MouseArea {
                    anchors.fill: parent
                    onClicked: {
                      fileDialog_ich3.folder = fileDialog_ich3.shortcuts.home+"/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/"
                      fileDialog_ich3.open()
                    }
                  }
                }
              }
            }

          }

          // vec3s container
          ColumnLayout{
            Layout.fillHeight: true
            Layout.fillWidth: true

            Layout.columnSpan: 1

            Rectangle{
              Layout.fillHeight: true
              Layout.fillWidth: true
              anchors.fill: parent
              border.color: Qt.rgba(255,255,255,0.05)
              border.width: 1
              radius: 4
              color: "transparent"
            }

            GridLayout {
              Layout.fillHeight: true
              Layout.fillWidth: true
              id: buttonContainer
              anchors.verticalCenter: parent.verticalCenter
              anchors.horizontalCenter: parent.horizontalCenter
              columns: 3
              // Layout.maximumWidth: parent.fillWidth / 2
              // anchors.left: parent.left
            }
          }

        }

        // vars container
        RowLayout{

          Rectangle{
            anchors.fill: parent
            border.color: Qt.rgba(255,255,255,0.05)
            border.width: 1
            Layout.fillHeight: true
            Layout.fillWidth : true
            radius: 4
            color: "transparent"
          }
          GridLayout{
            Layout.topMargin: 10
            Layout.bottomMargin:10
            Layout.fillHeight: true
            Layout.fillWidth : true
            anchors.horizontalCenter: parent.horizontalCenter
            columns: 3
            id: variableContainer
          }
        }
        // // v2 container
        // RowLayout{
        //
        //   Rectangle{
        //     anchors.fill: parent
        //     border.color: Qt.rgba(255,255,255,0.05)
        //     border.width: 1
        //     Layout.fillHeight: true
        //     Layout.fillWidth : true
        //     radius: 4
        //     color: "transparent"
        //   }
        //   GridLayout{
        //     Layout.topMargin: 10
        //     Layout.bottomMargin:10
        //     Layout.fillHeight: true
        //     Layout.fillWidth : true
        //     anchors.horizontalCenter: parent.horizontalCenter
        //     columns: 3
        //     id: v2Container
        //   }
        // }

        //*******************
        //*** Performance ***
        //*******************


        ColumnLayout {
          // Title
          RowLayout {
            Layout.topMargin: 25
            Text {
              width:100
              font.bold: true
              color: "white"
              font.pointSize: 16
              text: i18n("Performance:")
            }
            Rectangle{
              Layout.fillWidth: true
              height: 1
              color: Qt.rgba(255,255,255,0.25);
            }
          }
          // Content
          ColumnLayout {

              Rectangle{
                Layout.fillHeight: true
                Layout.fillWidth: true
                anchors.fill: parent
                border.color: Qt.rgba(255,255,255,0.05)
                border.width: 1
                radius: 4
                color: "transparent"
              }

              RowLayout{
                Text {
                  width:100
                  color: "white"
                  padding:5
                }
                CheckBox {
                  id: checkGl3Ver
                  text: i18n("Compatibility mode (GL3 version)")
                  checked: true
                }
              }
              // TODO: Fullscreen/Busy
              RowLayout{
                Text {
                  width:100
                  color: "white"
                  padding:5
                }
                CheckBox {
                  id: checkedSmartPlay
                  checked: false
                  text: i18n("Pause the shader when covered by maximized or full-screen windows.")
                }
              }
          }


        }

        //****************
        //*** Footnote ***
        //****************
        ColumnLayout {
          Layout.topMargin: 20
          Layout.bottomMargin: 10
          // Title
          RowLayout {
            Text {
              font.bold: true
              color: "white"
              font.pointSize: 16
              text: i18n("Info:")
            }
            Rectangle{
              Layout.fillWidth: true
              height: 1
              color: Qt.rgba(255,255,255,0.25);
            }
          }

          // Content
          ColumnLayout {
            Layout.fillHeight: true
            Layout.fillWidth: true
            // Notice
            RowLayout{
              Layout.bottomMargin: 20
              Text {
                color: "white"
                text: "In case of emergency, delete folder in\n\"~/.local/share/plasma/wallpaper/online.knowmad.shaderwallpaper\",\nthen run: \"pkill plasmashell && plasmashell &\" to relaunch it.\n\nUse with caution."
              }
            }

            RowLayout{
              Layout.fillWidth: true
              // Donation
              ColumnLayout {
                Layout.fillWidth: true
                Layout.bottomMargin: 20
                Layout.maximumWidth: 200
                anchors.left: parent.left
                Label {
                  font.bold: true
                  font.pointSize: 14
                  text: "Donate:"
                }

                Text {
                  Layout.minimumWidth: width
                  Layout.maximumWidth: width
                  width: formAlignment - units.largeSpacing
                  horizontalAlignment: Text.AlignLeft
                  text: "<a href='https://ko-fi.com/y4my4my4m'>ko-fi</a>"
                  onLinkActivated: Qt.openUrlExternally(link)
                  color:"white"
                  MouseArea {
                    anchors.fill: parent
                    acceptedButtons: Qt.NoButton
                    cursorShape: parent.hoveredLink ? Qt.PointingHandCursor : Qt.ArrowCursor
                  }
                }
              }
              // Support
              ColumnLayout {
                Layout.fillWidth: true
                anchors.right: parent.right
                Label {
                  font.bold: true
                  font.pointSize: 14
                  text: "Support:"
                }

                Text {
                  text: "<a href='https://github.com/y4my4my4m'>Github</a> | <a href='https://twitter.com/y4my4my4m'>Twitter</a>"
                  onLinkActivated: Qt.openUrlExternally(link)
                  color:"white"
                  MouseArea {
                    anchors.fill: parent
                    acceptedButtons: Qt.NoButton // we don't want to eat clicks on the Text
                    cursorShape: parent.hoveredLink ? Qt.PointingHandCursor : Qt.ArrowCursor
                  }
                }
              }
            }
          }

        }

      }

    }


  }

  //*******************
  //*** Components  ***
  //*******************
  // property string tempColor: colorDialog.color.r + ", " + colorDialog.color.g + ", " + colorDialog.color.b;

  ColorDialog {
    id: colorDialog
    title: "Please choose a color"
    property string previousColor: colorDialog.color.r + ", " + colorDialog.color.g + ", " + colorDialog.color.b;
    color: getInitialColor(number);
    property int number: 0
    onCurrentColorChanged: {
      let color = colorDialog.currentColor.r + ", " + colorDialog.currentColor.g + ", " + colorDialog.currentColor.b;
      findAndReplaceColor(color, number, true);
    }
    onAccepted: {
      // let color = colorDialog.currentColor.r + ", " + colorDialog.currentColor.g + ", " + colorDialog.currentColor.b;
      // findAndReplaceColor(color, number, true);
      // console.log("You chose: " + colorDialog.color.r, colorDialog.color.g, colorDialog.color.b)
      Qt.quit()
    }
    onRejected: {
      findAndReplaceColor(previousColor, number, true);
      Qt.quit()
    }
  }

  FPSItem {
    id: fpsItem
    running: wallpaper.configuration.running
  }

  FileDialog {
    id: fileDialog
    selectMultiple : false
    title: "Pick a shader file"
    // nameFilters: [ "Video files (*.mp4 *.mpg *.ogg *.mov *.webm *.flv *.matroska *.avi *wmv)", "All files (*)" ]
    onAccepted: {
      selectedShaderField.text = fileDialog.fileUrls[0]
      getShaderContent();
    }
  }
  // TODO: re-use the same file dialog...
  FileDialog {
    id: fileDialog_ich0
    selectMultiple : false
    title: "Pick a shader file"
    // nameFilters: [ "Video files (*.mp4 *.mpg *.ogg *.mov *.webm *.flv *.matroska *.avi *wmv)", "All files (*)" ]
    onAccepted: {
      iChannel0Field.text = fileDialog_ich0.fileUrls[0]
      getShaderContent();
    }
  }

  FileDialog {
    id: fileDialog_ich1
    selectMultiple : false
    title: "Pick a shader file"
    // nameFilters: [ "Video files (*.mp4 *.mpg *.ogg *.mov *.webm *.flv *.matroska *.avi *wmv)", "All files (*)" ]
    onAccepted: {
      iChannel1Field.text = fileDialog_ich1.fileUrls[0]
      getShaderContent();
    }
  }

  FileDialog {
    id: fileDialog_ich2
    selectMultiple : false
    title: "Pick a shader file"
    // nameFilters: [ "Video files (*.mp4 *.mpg *.ogg *.mov *.webm *.flv *.matroska *.avi *wmv)", "All files (*)" ]
    onAccepted: {
      iChannel2Field.text = fileDialog_ich2.fileUrls[0]
      getShaderContent();
    }
  }
  FileDialog {
    id: fileDialog_ich3
    selectMultiple : false
    title: "Pick a shader file"
    // nameFilters: [ "Video files (*.mp4 *.mpg *.ogg *.mov *.webm *.flv *.matroska *.avi *wmv)", "All files (*)" ]
    onAccepted: {
      iChannel3Field.text = fileDialog_ich3.fileUrls[0]
      getShaderContent();
    }
  }
  //****************************
  //*** Shader Loading Logic ***
  //****************************

  function getShaderContent(){
    var xhr = new XMLHttpRequest;
    var isFile = false;
    if (selectedShaderField.text.substr(0, 7) === "file://") {
      isFile = true;
      xhr.open("GET", selectedShaderField.text);
    }
    else {
      isFile = false;
      var shaderID = selectedShaderField.text;
      // console.log(shaderID)
      shaderID = shaderID.substr(shaderID.length - 6, shaderID.length);
      // console.log(shaderID)
      xhr.open("GET", "https://www.shadertoy.com/api/v1/shaders/"+shaderID+"?key=rd8t44"); // using @y4my4my4m's api key, be nice
    }
    xhr.onreadystatechange = function () {
      if(xhr.readyState === XMLHttpRequest.DONE){
        var response = xhr.responseText;
        // console.log("shader content:\n"+response);

        // TODO / FIXME  make all of this pragmatic
        var shaderCode;
        var channel0,channel1,channel2,channel3;
        var renderpass0;
        var ch0media,ch1media,ch2media,ch3media;
        if(!isFile){
          response = JSON.parse(response);
          renderpass0 = response.Shader.renderpass[0]
          ch0media    = response.Shader.renderpass[0].inputs[0]
          ch1media    = response.Shader.renderpass[0].inputs[1]
          ch2media    = response.Shader.renderpass[0].inputs[2]
          ch3media    = response.Shader.renderpass[0].inputs[3]
          shaderCode  = response.Shader.renderpass[0].code
          // code = response.code
          // FIXME
          // inputs[0] is first, but maybe should use "channel" key/value to be safe
          // perhaps channel0 can be unused but channel1 is and this messes it up?
          if(ch0media){
            channel0 = `https://www.shadertoy.com/${ch0media.src}`;
            iChannel0Field.text = channel0;
            iChannel0_flag.checked = true;
          }
          if(ch1media){
            channel1 = `https://www.shadertoy.com/${ch1media.src}`;
            iChannel1Field.text = channel1;
            iChannel1_flag.checked = true;
          }
          if(ch2media){
            channel2 = `https://www.shadertoy.com/${ch2media.src}`;
            iChannel2Field.text = channel2;
            iChannel2_flag.checked = true;
          }
          if(ch3media){
            channel3 = `https://www.shadertoy.com/${ch3media.src}`;
            iChannel3Field.text = channel3;
            iChannel3_flag.checked = true;
          }
          wallpaper.configuration.selectedShaderContent = shaderCode;
        }
        else{
          wallpaper.configuration.selectedShaderContent = response;
        }
        // create GUI buttons of the containing vec3
        createVec3Buttons();
        createVariableFields();
      }
    }

    xhr.send();
  }

  // *********************
  // *** GUI VARIABLES ***
  // *********************

  // find all vars in shader (to create textfields for each)
  // return array[{name,value}];
  function getShaderVars(){

    let varRegex = /float\s(\w+)\s*=\s*([+-]?[0-9][.0-9]+)/g;

    let currentShaderContent = wallpaper.configuration.selectedShaderContent;
    let matches = currentShaderContent.match(varRegex);
    // console.log(`matches: ${matches}`);
    //
    // let test = varRegex.exec(matches[1]);
    // console.log(`matchedGroup 1????: ${test}`); // variable

    let allMatches = []
    for (var i=0; i<matches.length; i++){
      // find groups within matched pattern
      // console.log(`matches      ${i}: ${matches[i]}`);
      let matchedGroup = varRegex.exec(matches[i]);
      varRegex.lastIndex = 0; // RESET REGEX INDEX !!!!
      // console.log(`matchedGroup ${i}: ${matchedGroup}`); // variable
      // console.log(`matchedGroup 1: ${matchedGroup[1]}`); // variable's name
      // console.log(`matchedGroup 2: ${matchedGroup[2]}`); // variable's value
      let matchedObj = {};
      if (matchedGroup){
        // matchedObj['full'] = matchedGroup[0];
        matchedObj['name']  = matchedGroup[1];
        matchedObj['value'] = matchedGroup[2];
        allMatches.push(matchedObj)
      }
    }
    return allMatches;

  }

  // string       variables                      the new value to replace
  // int          index      default 0          match case for the vec3 / which variable to hijack color of
  function findAndReplaceVar(newValue, index = 0){

    let varRegex = /float\s(\w+)\s*=\s*([+-]?[0-9][.0-9]+)/g;

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
      let newVariable = matched.replace(matchedGroup[2],newValue);
      // console.log(`OLD VALUE: ${matchedGroup[2]} || NEW VALUE: ${newValue} || NEW VARIABLE ${newVariable}`)
      currentShaderContent = currentShaderContent.replace(matched, newVariable);
      // assign modified var to current shader
      wallpaper.configuration.selectedShaderContent = currentShaderContent;
    }


  }

  function createVariableFields(){
    for(var i = variableContainer.children.length; i > 0; i--) {
        variableContainer.children[i-1].destroy();
    }
    let variables = getShaderVars();
    for (var i=0; i<variables.length; i++) {

        // should load GUIVariableField.qml instead
        // console.log(`variables: ${JSON.stringify(variables)}`)
        // console.log('trying to create variable textfield')
        // console.log(`variables[i]: ${i} ${variables[i].name} ${variables[i].value}`)
        // console.log(`variables[i].name: ${variables[i].name}`)
        // console.log(`variables[i].value: ${variables[i].value}`)
        // if (!variables[i]) return;

        let objStr = `
            import QtQuick 2.12;
            import QtQuick.Layouts 1;
            import QtQuick.Controls 2.12;
            RowLayout {
              spacing: units.largeSpacing / 2
              Label {
                Layout.minimumWidth: width
                Layout.maximumWidth: width
                horizontalAlignment: Text.AlignRight
                width: 120
                text: '${variables[i].name}:'
              }
              TextField {
                id: varField_${i}
                Layout.minimumWidth: width
                Layout.maximumWidth: width
                width: 150
                text: '${variables[i].value}'
                onEditingFinished: {
                  findAndReplaceVar(varField_${i}.text, ${i});
                }
              }
            }`;
        Qt.createQmlObject(objStr, variableContainer);
    }
  }
  // find all vars in shader (to create textfields for each)
  // return array[{name,value}];
  // function getWindowLines(){
  //   // vec2 o1 = vec2(0.15,0.15);
  //   let vec2regex   = /vec2\s(o[0-9])\s=\svec2(\([+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+\))/g;
  //
  //   let currentShaderContent = wallpaper.configuration.selectedShaderContent;
  //   let matches = currentShaderContent.match(vec2regex);
  //   // console.log(`matches: ${matches}`);
  //   //
  //   // let test = varRegex.exec(matches[1]);
  //   // console.log(`matchedGroup 1????: ${test}`); // variable
  //
  //   let allMatches = []
  //   for (var i=0; i<matches.length; i++){
  //     // find groups within matched pattern
  //     // console.log(`matches      ${i}: ${matches[i]}`);
  //     let matchedGroup = vec2regex.exec(matches[i]);
  //     vec2regex.lastIndex = 0; // RESET REGEX INDEX !!!!
  //     console.log(`matchedGroup ${i}: ${matchedGroup}`); // variable
  //     // console.log(`matchedGroup 1: ${matchedGroup[1]}`); // variable's name
  //     // console.log(`matchedGroup 2: ${matchedGroup[2]}`); // variable's value
  //     let matchedObj = {};
  //     if (matchedGroup){
  //       // matchedObj['full'] = matchedGroup[0];
  //       let newVariable;
  //       if(matchedGroup[1] == 'o1') newVariable = matched.replace(matchedGroup[2],'vec2('+wallpaper.configuration.win0_left+','+wallpaper.configuration.win0_top+')');
  //       // if(matchedGroup[1] == 'o2') newVariable = matched.replace(matchedGroup[2],wallpaper.configuration.win0_right);
  //       // if(matchedGroup[1] == 'o3') newVariable = matched.replace(matchedGroup[2],wallpaper.configuration.win0_bottom);
  //       // if(matchedGroup[1] == 'o4') newVariable = matched.replace(matchedGroup[2],wallpaper.configuration.win0_top);
  //       // matchedObj['name']  = matchedGroup[1];
  //       // matchedObj['value'] = matchedGroup[2];
  //       // allMatches.push(matchedObj)
  //       currentShaderContent = currentShaderContent.replace(matched, newVariable);
  //       // assign modified var to current shader
  //     }
  //   }
  //   wallpaper.configuration.selectedShaderContent = currentShaderContent;
  //   // return allMatches;
  //
  // }


    // // string       variables                      the new value to replace
    // // int          index      default 0          match case for the vec3 / which variable to hijack color of
    // function findAndReplaceLines(index = 0){
    //
    //   let varRegex = /vec2\s(o[0-9])\s=\svec2(\([+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+\))/g;
    //
    //   let currentShaderContent = wallpaper.configuration.selectedShaderContent;
    //
    //   let matches = currentShaderContent.match(varRegex);
    //   // console.log(`matches: ${matches}`);
    //   let matched = matches[index]; // only need to modify requested;
    //   // console.log(`matched: ${matched}`);
    //
    //   // find groups within matched pattern
    //   let matchedGroup = varRegex.exec(matched);
    //   varRegex.lastIndex = 0; // RESET REGEX INDEX !!!!
    //   // console.log(`matchedgroup ${matchedGroup}`)
    //   console.log(`matchedGroup 1: ${matchedGroup[1]}`); // variable's name
    //   console.log(`matchedGroup 2: ${matchedGroup[2]}`); // variable's value
    //   if (matchedGroup){
    //     if(matchedGroup[1] == 'o1') {
    //       let newVariable = matched.replace(matchedGroup[2],'vec2('+wallpaper.configuration.win0_left+','+wallpaper.configuration.win0_top+')');
    //
    //       console.log(`OLD VALUE: ${matchedGroup[2]} || NEW VALUE: ${wallpaper.configuration.win0_left} || NEW VARIABLE ${newVariable}`)
    //       // currentShaderContent = currentShaderContent.replace(matched, newVariable);
    //       // assign modified var to current shader
    //       // wallpaper.configuration.selectedShaderContent = currentShaderContent;
    //     }
    //
    //   }
    //
    //
    // }
      //
      // function createLineFields(){
      //   for(var i = v2Container.children.length; i > 0; i--) {
      //       v2Container.children[i-1].destroy();
      //   }
      //   let variables = getWindowLines();
      //   for (var i=0; i<variables.length; i++) {
      //
      //       // should load GUIVariableField.qml instead
      //       // console.log(`variables: ${JSON.stringify(variables)}`)
      //       // console.log('trying to create variable textfield')
      //       // console.log(`variables[i]: ${i} ${variables[i].name} ${variables[i].value}`)
      //       // console.log(`variables[i].name: ${variables[i].name}`)
      //       // console.log(`variables[i].value: ${variables[i].value}`)
      //       // if (!variables[i]) return;
      //
      //       let objStr = `
      //           import QtQuick 2.12;
      //           import QtQuick.Layouts 1;
      //           import QtQuick.Controls 2.12;
      //           RowLayout {
      //             spacing: units.largeSpacing / 2
      //             Label {
      //               Layout.minimumWidth: width
      //               Layout.maximumWidth: width
      //               horizontalAlignment: Text.AlignRight
      //               width: 120
      //               text: '${variables[i].name}:'
      //             }
      //             TextField {
      //               id: v2Field_${i}
      //               Layout.minimumWidth: width
      //               Layout.maximumWidth: width
      //               width: 150
      //               text: '${variables[i].value}'
      //               onEditingFinished: {
      //                 findAndReplaceVar(v2Field_${i}.text, ${i});
      //               }
      //             }
      //           }`;
      //       Qt.createQmlObject(objStr, v2Container);
      //   }
      // }

  // ******************
  // *** GUI COLORS ***
  // ******************

  // find all vec3 in shader (to create buttons for each)
  // return int;
  function getShaderVec3s(){
    let vec3regex         = /(vec3\([+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+\))/g;
    let vec3regexSingular = /(vec3\([+-]?([0-9]*[.])?[0-9]+\))/g;

    let currentShaderContent = wallpaper.configuration.selectedShaderContent;
    let matches = currentShaderContent.match(vec3regex);
    if (matches.length == 0) matches = currentShaderContent.match(vec3regexSingular);

    return matches.length ? matches.length : 0;
  }

  // string   color    rgb                  combined color from colorDialog in rgb
  // int      number   default 0           match case for the vec3 / which variable to hijack color of
  function findAndReplaceColor(color, number = 0, replace = true){

    let vec3regex         = /(vec3\([+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+\))/g; // vec3(0.0, 0.0, 0.0)
    let vec3regexSingular = /(vec3\([+-]?([0-9]*[.])?[0-9]+\))/g; // vec3(0.0)

    let currentShaderContent = wallpaper.configuration.selectedShaderContent;

    // matches is the vec3(0.0, 0.0, 0.0) format
    let matches = currentShaderContent.match(vec3regex);
    let replacement = 'vec3('+color+')'

    // matchesSingular is the vec3(0.0) format
    let matchesSingular = currentShaderContent.match(vec3regexSingular);
    for (var i=0; i<matchesSingular.length; i++){
      matches.push(matchesSingular[i])
    }
    if (replace){
      // replace the color in the temp string
      currentShaderContent = currentShaderContent.replace(matches[number], replacement);
      // assign modified color to current shader
      wallpaper.configuration.selectedShaderContent = currentShaderContent;
      return;
    }

    else{
      // return an array of rgb values
      // for (var i=0; i<matches.length; i++){
      //   // console.log(`shader color before: ${matches[i]}`)
      //   matches[i] = matches[i].substr(5, matches[i].length);
      //   // console.log(`shader color during: ${matches[i]}`)
      //   matches[i] = matches[i].substr(0, matches[i].length - 1);
      //   // console.log(`shader color after: ${matches[i]}`)
      // }

      // separate rgb colors in an array from a split string and return it
      matches[number] = matches[number].substr(5, matches[number].length);
      matches[number] = matches[number].substr(0, matches[number].length -1);
      let colors = matches[number].split(',').map(parseFloat);
      console.log(`colors: ${colors}`);
      return colors;
    }

  }


  function getInitialColor(number, numOnly = false){
    let colors = findAndReplaceColor("", number, false);
    // FIXME: doesnt need to be like that
    if (colors.length > 1 && !numOnly) return Qt.rgba(colors[0],colors[1],colors[2],1);
    else if (colors.length > 1 && numOnly) return `${colors[0]},${colors[1]},${colors[2]}`;
    else if (numOnly) return `${colors[0]}`;
    return Qt.rgba(colors[0],colors[0],colors[0],1);
  }

  function createVec3Buttons(){
    for(var i = buttonContainer.children.length; i > 0; i--) {
        buttonContainer.children[i-1].destroy();
    }
    for (var i=0; i<getShaderVec3s(); i++) {
        // should load GUIButton.qml instead
        let prevC = getInitialColor(i, true);
        let prevCrgb = prevC.split(',');
        console.log(`prevCrgb ${prevCrgb}`)
        let objStr = `
            import QtQuick 2.12;
            import QtQuick.Controls 2.12;
            import QtQuick.Controls 2.12;
            import org.kde.plasma.core 2.0 as PlasmaCore;
            Button {
              property int number: ${i}
              id: vec3button_${i}
              text: i18n(" Change color of ${i}")
              Rectangle {
                width:10
                height:10
                x: 5
                anchors.verticalCenterOffset: -2.5
                anchors.verticalCenter: parent.verticalCenter
                color: Qt.rgba(${prevCrgb},1)
              }
              onClicked: {
                colorDialog.number = ${i}
                colorDialog.visible = !colorDialog.visible
                colorDialog.previousColor = ${JSON.stringify(prevC)};
              }
            }`;
        var button = Qt.createQmlObject(objStr, buttonContainer);
    }
  }

  Component.onCompleted: {
    if(!selectedShaderField.text) getShaderContent();

    createVec3Buttons();
    createVariableFields();
    // if(!selectedShaderField.text == 'WindowLines')
    // selectedShaderField.text = Qt.resolvedUrl("./Shaders/"+model.get(selectedShader.currentIndex, "fileName"));
  }
}

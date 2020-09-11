import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import QtQuick.Dialogs 1.3
import Qt.labs.folderlistmodel 2
import "./Components"

import org.kde.plasma.core 2.0 as PlasmaCore

Item {
  property alias cfg_selectedShader: selectedShaderField.text
  property alias cfg_checkGl3Ver:  checkGl3Ver.checked
  property alias cfg_checkedSmartPlay: checkedSmartPlay.checked
  property alias cfg_checkedBusyPlay:  checkedBusyPlay.checked

  Layout.fillWidth: true

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
      spacing: units.largeSpacing / 2
      RowLayout {
          spacing: units.largeSpacing / 2

          ColumnLayout {
            spacing: units.largeSpacing

            RowLayout {
              spacing: units.largeSpacing / 2

              Label {
                Layout.minimumWidth: width
                Layout.maximumWidth: width
                width: formAlignment - units.largeSpacing
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
              spacing: units.largeSpacing / 2

              Label {
                Layout.minimumWidth: width
                Layout.maximumWidth: width
                width: formAlignment - units.largeSpacing
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
            spacing: units.largeSpacing
            Layout.columnSpan: 1
            Rectangle{
              anchors.fill: parent
              // anchors.centerIn: parent
              border.color: Qt.rgba(255,255,255,0.05)
              border.width: 1
              radius: 4
              color: "transparent"
            }

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
                checked: wallpaper.configuration.iChannel0_flag
                onCheckedChanged: {
                  wallpaper.configuration.iChannel0_flag != wallpaper.configuration.iChannel0_flag
                }
              }
              TextField {
                id: iChannel0Field
                placeholderText: "TODO: path to iChannel0"
                opacity: 0.45
                enabled: false
                onEditingFinished: {
                  // iChannel0Field.text;
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
                checked: wallpaper.configuration.iChannel1_flag
                onCheckedChanged: {
                  wallpaper.configuration.iChannel1_flag != wallpaper.configuration.iChannel1_flag
                }
              }
              TextField {
                id: iChannel1Field
                placeholderText: "TODO: path to iChannel1"
                onEditingFinished: {
                  // iChannel0Field.text;
                }
                opacity: 0.45
                enabled: false
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
                id: iChanne2_flag
                width: 35
                checked: wallpaper.configuration.iChannel2_flag
                onCheckedChanged: {
                  wallpaper.configuration.iChannel2_flag != wallpaper.configuration.iChannel2_flag
                }
              }
              TextField {
                id: iChannel2Field
                placeholderText: "TODO: path to iChannel2"
                onEditingFinished: {
                  // iChannel0Field.text;
                }
                opacity: 0.45
                enabled: false
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
                id: iChanne3_flag
                width: 35
                checked: wallpaper.configuration.iChannel3_flag
                onCheckedChanged: {
                  wallpaper.configuration.iChannel3_flag != wallpaper.configuration.iChannel3_flag
                }
              }
              TextField {
                id: iChannel3Field
                placeholderText: "TODO: path to iChannel3"
                onEditingFinished: {
                  // iChannel0Field.text;
                }
                opacity: 0.45
                enabled: false
              }
            }

          }

          // vec3s container
          ColumnLayout{
            spacing: units.largeSpacing
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
                RadioButton {
                  id: checkedSmartPlay
                  checkable: false
                  opacity: 0.25
                  text: i18n("TODO: Pause the shader when maximized or full-screen windows.")
                  // onCheckedChanged: {
                  //   checkedBusyPlay.checked = !checkedSmartPlay.checked
                  // }
                }
              }

              RowLayout{
                Layout.fillWidth: true
                Text {
                  width:100
                  color: "white"
                  padding:5
                }
                RadioButton {
                  id: checkedBusyPlay
                  checkable: false
                  opacity: 0.25
                  // checked: !checkedSmartPlay.checked
                  text: i18n("TODO: Pause the shader when the desktop is busy.")
                  // onCheckedChanged: {
                  //   checkedSmartPlay.checked = !checkedBusyPlay.checked
                  // }
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
  ColorDialog {
    id: colorDialog
    title: "Please choose a color"
    property string previousColor: colorDialog.color.r + ", " + colorDialog.color.g + ", " + colorDialog.color.b;
    property int number: 0
    onCurrentColorChanged: {
      // console.log("You are choosing: " + colorDialog.currentColor.r, colorDialog.currentColor.g, colorDialog.currentColor.b)
      let color = colorDialog.currentColor.r + ", " + colorDialog.currentColor.g + ", " + colorDialog.currentColor.b;
      findAndReplaceColor(color, number);
    }
    onAccepted: {
      // console.log("You chose: " + colorDialog.color.r, colorDialog.color.g, colorDialog.color.b)
      Qt.quit()
    }
    onRejected: {
      findAndReplaceColor(previousColor, number);
      // console.log("Canceled, set previous color back")
      Qt.quit()
    }
  }

  FPSItem {
    id: fpsItem
    running: shaderEngine.running
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
        if(!isFile){
          response = JSON.parse(response)
          response = response.Shader.renderpass[0].code
        }
        wallpaper.configuration.selectedShaderContent = response;
        // create GUI buttons of the containing vec3
        // main.shaderEngine.iChannel0 = Qt.resolvedUrl("./Resources/Shadertoy_Pebbles.png")
        console.log(wallpaper)
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
  function findAndReplaceColor(color, number = 0){

    let vec3regex         = /(vec3\([+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+,\s*[+-]?([0-9]*[.])?[0-9]+\))/g; // vec3(0.0, 0.0, 0.0)
    let vec3regexSingular = /(vec3\([+-]?([0-9]*[.])?[0-9]+\))/g; // vec3(0.0)

    let currentShaderContent = wallpaper.configuration.selectedShaderContent;

    let matches = currentShaderContent.match(vec3regex);
    let replacement = 'vec3('+color+')'

    let matchesSingular = currentShaderContent.match(vec3regexSingular);
    for (var i=0; i<matchesSingular.length; i++){
      matches.push(matchesSingular[i])
    }

    // replace the color in the temp string
    currentShaderContent = currentShaderContent.replace(matches[number], replacement);

    // assign modified color to current shader
    wallpaper.configuration.selectedShaderContent = currentShaderContent;

  }

  function createVec3Buttons(){
    for(var i = buttonContainer.children.length; i > 0; i--) {
        buttonContainer.children[i-1].destroy();
    }
    for (var i=0; i<getShaderVec3s(); i++) {
        // should load GUIButton.qml instead
        // FIXME: ColorDialog defaults to a color when opened, should use the current variable
        let objStr = `
            import QtQuick 2.12;
            import QtQuick.Controls 2.12;
            Button {
            property int number: `+i+`
            id: vec3button_`+i+`
            text: i18n("Change color of "+`+i+`)
            onClicked: {
              colorDialog.number = `+i+`
              colorDialog.visible = !colorDialog.visible
            }
          }`;
        var button = Qt.createQmlObject(objStr, buttonContainer);
    }
  }

  Component.onCompleted: {
    if(!selectedShaderField.text) getShaderContent();

    createVec3Buttons();
    createVariableFields();
    // selectedShaderField.text = Qt.resolvedUrl("./Shaders/"+model.get(selectedShader.currentIndex, "fileName"));
  }
}

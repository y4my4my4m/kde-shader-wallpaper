import QtQuick 2.12;
import QtQuick.Controls 2.12;

Button {
  property int number: 0
  id: vec3button_+number
  text: i18n("Change color of "+number)
  onClicked: {
    colorDialog.number = number
    colorDialog.visible = !colorDialog.visible
  }
}

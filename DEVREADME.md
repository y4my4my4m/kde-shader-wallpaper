qsb is in `/usr/lib/qt6/bin` 
`export PATH:$PATH:/usr/lib/qt6/bin` and now we can all it anywhere

https://doc.qt.io/qt-6/qtshadertools-qsb.html

`Executing qsb -o shader.frag.qsb shader.frag results in generating shader.frag.qsb. Inspecting this file with qsb -d shader.frag.qsb`

`qsb --glsl "100 es,120,150" --hlsl 50 --msl 12 -o waves.frag.qsb waves.frag`


## Install the package

`kpackagetool6 -t Plasma/Wallpaper -i package`


https://invent.kde.org/plasma/libplasma
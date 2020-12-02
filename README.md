# KDE / Plasma - Shader Wallpaper plugin


## Shader Wallpaper is a KDE/Plasma Wallpaper Plugin that allows you to run shaders as your wallpaper.

### Installation:
#### Install through KDE
- Right click on your desktop > Configure Desktop
- Click on the "[Get New Plugins](https://user-images.githubusercontent.com/8145020/92334553-c1f1f480-f054-11ea-959d-1017fec92db4.png)" button
- Search and Install the latest version of "Shader Wallpaper"

#### Install from Source
- clone this repository or [download the latest release](https://github.com/y4my4my4m/kde-shader-wallpaper/releases)
- install from folder: `kpackagetool5 -t Plasma/Wallpaper -i kde-shader-wallpaper`
- install from archive: `kpackagetool5 -t Plasma/Wallpaper -i online.knowmad.shaderwallpaper-1.3.tar.gz`

#### Upgrade
- `kpackagetool5 -t Plasma/Wallpaper --upgrade kde-shader-wallpaper`

#### Uninstall
- You can uninstall it via KDE's desktop settings otherwise, you can uninstall like this: `kpackagetool5 -t Plasma/Wallpaper --remove online.knowmad.shaderwallpaper`

### Repo:
I'll probably maintain it on Github principally for issues/PR but I'll try my best to maintain both, if anything contact me on twitter [@y4my4my4m](https://twitter.com/@y4my4my4m).

#### Links:
- KDE Store: https://store.kde.org/p/1413010/
- Opencode: https://www.opencode.net/y4my4my4m/kde-shader-wallpaper

#### Roadmap:
- [x] Version 1.0  - Simply load shaders
- [x] Version 1.1  - File Dialog added
- [x] Version 1.2  - iGPU fix
- [x] Version 1.3  - 70 new shaders + autolisting
- [x] Version 2.0a - Customize shaders via GUI, directly load shaders from shadertoy.com or file **(current version)**
- [ ] Version 2.x  - Save/Load edits, better customization, better buffers/channel

#### Notes:
- GUI Customization is highly experimental, bugs will occur.
- Shadertoy.com imports doesn't work on all shaders, that is because iChannels/Buffers are not fully implemented yet
- Performance may vary depending of your specs, but it's actually not all that resource intensive, depends on the shader too.
- If you modify the shader files and want to see the changes, the KDE Wallpaper QtQuick App itself needs to be restart, I recommend simply to `pkill plasmashell` and restart it.

#### Videos:

##### v1.2 using iGPU (and kvantum) in VirtualBox:

[![ShaderWallpaperVideoPreviewV1.2](https://cdn-cf-east.streamable.com/image/1g7muc_first.jpg?Expires=1599641820&Signature=kBzPch9XeiD3AieRh4sXd84JdQIknV2KK1m~w7KtXcO-5LH~JCeG8Wngq2p45Z521BWfd2jxpaujTV3618h91u4EnBSzMDRskpxPuSQ4x9uihB0gQ7u4OZjfLt3g-dXLa69Vh6V8~NCDuqo6v3G24vlQND-GArKa~lDPQvnNj2qt-cOIuFLyO0cBwJG4MTu-9C2zOe2wjR2s-cj8IAi4PweeMpJqeKZepDpe9grl8Wry8s3ahP9hZfUyCBs53LnWsEbfe2Ze01j6Bo07gXXb5rAQXYvfI7WxIDX2S7L5f33OxxJNxa4v1Jeg-aAsrW9Ij-86b9qtfsjN1IE6wUOzpQ__&Key-Pair-Id=APKAIEYUVEN4EVB2OKEQ)](https://streamable.com/1g7muc)

##### v1.0:
[![ShaderWallpaperVideoPreviewV1.0](https://cdn-cf-east.streamable.com/image/yeqam9.jpg?Expires=1599641220&Signature=NCZXLhg5owCeCiBx8wg7FIO2oOZ~6y9b-we72JE0icG9Cw649dYPPRqDzuOnXsvOEe0omZhhlckbcdLZg6QKbMm9R6UUkN3g-hs4Y8WAJcWIXrantAsWlg309a2vu-gIkHV06eOYczdC3BBzprRHLh8BuKGRQyIAvxLYyf25mWexhPVrZHvrXsl-PFWN1tH~LLL14vD1oaoysupJxnF26qLVv1nAGB-AzYn7GVAcnJmpOPUbKz~jl2Z6iWy1fgJYu~Dym5Hxphc21-XIOHSqXYjkZFDslyevRJVcfqAsnfOzsm3GwRmBQ8hYB5wO5lpp4DnAUuDjtzY9d5sB025U0Q__&Key-Pair-Id=APKAIEYUVEN4EVB2OKEQ)](https://streamable.com/yeqam9)

#### Screenshots:

[![ShaderWallpaperPreviewImage](https://cdn.pling.com/img/c/5/d/1/ef67e0df43137d0d42b81afe700e83aa9cf2c911ab4619aa6ba072894a404c658546.png)](https://cdn.pling.com/img/c/5/d/1/ef67e0df43137d0d42b81afe700e83aa9cf2c911ab4619aa6ba072894a404c658546.png)

[![ShaderWallpaperPreviewImage2](https://cdn.pling.com/img/4/1/4/0/95ec8cf5ca97eac0504faa68b297355964a9c6d4e1e1e161609997356b9a6d75fe6d.png)](https://cdn.pling.com/img/4/1/4/0/95ec8cf5ca97eac0504faa68b297355964a9c6d4e1e1e161609997356b9a6d75fe6d.png)

[![ShaderWallpaperPreviewImage3](https://cdn.pling.com/img/f/8/2/c/67b57155b2a2a2cd63f6d5545af2f6da3f5298c081c5ab05a72f6c17aa56aee79afd.png)](https://cdn.pling.com/img/f/8/2/c/67b57155b2a2a2cd63f6d5545af2f6da3f5298c081c5ab05a72f6c17aa56aee79afd.png)

[![ShaderWallpaperPreviewImage4](https://cdn.pling.com/img/9/e/c/9/b5026604b9009c3541e25b98bbaa0450d17a52ceee878f8b44383bb5e3570c3f251d.png)](https://cdn.pling.com/img/9/e/c/9/b5026604b9009c3541e25b98bbaa0450d17a52ceee878f8b44383bb5e3570c3f251d.png)


### Donations:
[![ko-fi](https://www.ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I525V5R)

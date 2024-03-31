#version 450

// Define the layout for the vertex inputs
layout(location = 0) in vec4 qt_Vertex; // Vertex position input
layout(location = 1) in vec2 qt_MultiTexCoord0; // Texture coordinate input

// Define the output to the fragment shader
out gl_PerVertex {
    vec4 gl_Position; // Mandatory output
};
out vec2 qt_TexCoord0; // Pass texture coordinates to the fragment shader

// Define the uniform buffer for transformation matrices
layout(std140, binding = 0) uniform MatrixBlock {
    mat4 qt_Matrix; // Transformation matrix (model-view-projection)
};

void main() {
    gl_Position = qt_Matrix * qt_Vertex; // Transform vertex position
    qt_TexCoord0 = qt_MultiTexCoord0; // Pass texture coordinates through
}

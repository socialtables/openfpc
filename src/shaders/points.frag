uniform vec3 color;
uniform sampler2D texture;
void main() {
	vec4 texColor = texture2D( texture, gl_PointCoord );
	gl_FragColor = vec4( color , 1.0 );
	gl_FragColor = gl_FragColor * texColor;
	if ( texColor.a < ALPHATEST ) discard;
}

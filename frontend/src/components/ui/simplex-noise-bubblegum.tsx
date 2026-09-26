"use client";

import React, { useEffect, useRef, useState } from "react";

export interface ShaderBackgroundProps {
  className?: string;
  style?: React.CSSProperties;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLSL Shaders for Simplex Noise · Bubblegum
// High-performance procedural simplex noise with bubblegum pastel palette
// ─────────────────────────────────────────────────────────────────────────────

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;

// Simplex 2D noise implementation (Stefan Gustavson)
vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,  // (3.0-sqrt(3.0))/6.0
    0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626, // -1.0 + 2.0 * C.x
    0.024390243902439   // 1.0 / 41.0
  );

  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fast, streamlined 2-octave FBM for smooth organic flow without GPU bottlenecks
float fbm(vec2 p) {
  return 0.62 * snoise(p) + 0.38 * snoise(p * 2.05 + vec2(1.7, 9.2));
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  st.x *= aspect;

  float t = u_time * 0.16;

  // Domain warping for fluid bubblegum swirls
  vec2 q = vec2(
    fbm(st + 0.05 * t),
    fbm(st + vec2(5.2, 1.3) + 0.07 * t)
  );

  vec2 r = vec2(
    fbm(st + 1.8 * q + vec2(1.7, 9.2) + 0.11 * t),
    fbm(st + 1.8 * q + vec2(8.3, 2.8) + 0.08 * t)
  );

  float f = fbm(st + 1.6 * r + 0.04 * t);
  f = clamp((f + 1.0) * 0.5, 0.0, 1.0);

  // Signature Paper Shaders "Bubblegum" Palette
  // C1: Deep periwinkle / violet
  vec3 c1 = vec3(0.38, 0.42, 0.82); 
  // C2: Bubblegum pastel pink
  vec3 c2 = vec3(1.0, 0.72, 0.84);  
  // C3: Vibrant candy coral
  vec3 c3 = vec3(0.98, 0.42, 0.52); 
  // C4: Soft sunny yellow
  vec3 c4 = vec3(1.0, 0.88, 0.58);  
  // C5: Light pastel cream / white
  vec3 c5 = vec3(0.98, 0.98, 1.0);   

  // Layered smooth gradient blend
  vec3 color = mix(c1, c2, smoothstep(0.0, 0.35, f));
  color = mix(color, c3, smoothstep(0.25, 0.65, f));
  color = mix(color, c4, smoothstep(0.55, 0.85, f));
  color = mix(color, c5, smoothstep(0.75, 1.0, f));

  // Gentle soft tone curve for comfortable chat background readability
  color = mix(color, vec3(0.97, 0.98, 1.0), 0.32);

  gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function ShaderBackground({ className = "", style }: ShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webGLFailed, setWebGLFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (canvas.getContext("webgl", {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: "low-power",
      }) ||
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    } catch (e) {
      gl = null;
    }

    if (!gl) {
      setWebGLFailed(true);
      return;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    if (!vs || !fs) {
      setWebGLFailed(true);
      return;
    }

    const program = createProgram(gl, vs, fs);
    if (!program) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      setWebGLFailed(true);
      return;
    }

    gl.useProgram(program);

    // Quad geometry covering full clip space
    const quadVertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const positionAttr = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttr);
    gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

    const resolutionUniform = gl.getUniformLocation(program, "u_resolution");
    const timeUniform = gl.getUniformLocation(program, "u_time");

    let animationFrameId: number;
    let startTime = performance.now();
    let lastDrawTime = 0;
    const targetInterval = 1000 / 35; // ~35 FPS is ideal for smooth ambient background drift
    let isPageVisible = !document.hidden;
    let isScrolling = false;
    let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const onScrollActivity = () => {
      isScrolling = true;
      if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
      scrollDebounceTimer = setTimeout(() => {
        isScrolling = false;
      }, 90);
    };

    window.addEventListener("scroll", onScrollActivity, { passive: true, capture: true });
    window.addEventListener("wheel", onScrollActivity, { passive: true, capture: true });

    const resizeCanvas = () => {
      if (!canvas || !gl) return;
      const rect = canvas.getBoundingClientRect();
      // Cap DPR to 0.65 for soft ambient background - drastically cuts fragment shading load
      // while bilinear texture filtering keeps the pastel gradients silky and organic
      const dpr = Math.min(window.devicePixelRatio || 1, 0.65);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvas);

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) {
        startTime = performance.now() - (performance.now() - startTime);
        loop(performance.now());
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const loop = (now: number) => {
      if (!isPageVisible || !gl) return;

      animationFrameId = requestAnimationFrame(loop);

      // During active user scroll, throttle shader redraws to leave GPU 100% available for buttery 60-120fps scrolling
      const minInterval = isScrolling ? 75 : targetInterval;
      const elapsed = now - lastDrawTime;
      if (elapsed < minInterval) return;

      lastDrawTime = now - (elapsed % minInterval);

      const currentTime = (now - startTime) * 0.001;
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      gl.uniform1f(timeUniform, currentTime);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
      window.removeEventListener("scroll", onScrollActivity, { capture: true });
      window.removeEventListener("wheel", onScrollActivity, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resizeObserver.disconnect();

      if (gl) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        const loseContext = gl.getExtension("WEBGL_lose_context");
        if (loseContext) loseContext.loseContext();
      }
    };
  }, []);

  if (webGLFailed) {
    // Fallback: Elegant pastel gradient background if WebGL is unavailable
    return (
      <div
        className={`pointer-events-none ${className}`}
        style={{
          background:
            "linear-gradient(135deg, #ffd1e0 0%, #dbeafe 35%, #ffd36b 70%, #fdf2f8 100%)",
          ...style,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none block select-none ${className}`}
      style={{
        transform: "translate3d(0, 0, 0)",
        willChange: "transform",
        contain: "strict",
        backfaceVisibility: "hidden",
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export default ShaderBackground;

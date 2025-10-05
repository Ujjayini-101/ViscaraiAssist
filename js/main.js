// ------------- main.js --------------
// Scroll reveal
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("show");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal, .feature-card").forEach((el) =>
  io.observe(el)
);

// ---------------------------- Login buttons redirect ----------------------------

function attachLoginButtons() {
  document.querySelectorAll(".btn-login").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      // store the page user came from
      localStorage.setItem(
        "redirectAfterLogin",
        window.location.pathname + window.location.search
      );
      window.location.href = "./login.html";
    });
  });
}
attachLoginButtons();

// ---------------------------- CTA Button Update for Hero Section ----------------------------

import { onAuthChange } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const ctaBtn = document.getElementById("ctaBtn");
  const ctaText = document.getElementById("ctaText");

  if (!ctaBtn || !ctaText) return;

  // Fallback 
  function setGuest() {
    ctaText.textContent = "Get Started";
    ctaBtn.onclick = () => {
      window.location.href = "./career-assist.html";
    };
  }

  // Logged-in state
  function setLoggedIn() {
    ctaText.textContent = "Your Dashboard";
    ctaBtn.onclick = () => {
      window.location.href = "./dashboard.html";
    };
  }

  // Default while auth resolves
  setGuest();

  try {
    // Reusing the same auth listener from auth.js
    onAuthChange((user) => {
      if (user) {
        setLoggedIn();
      } else {
        setGuest();
      }
    });
  } catch (err) {
    console.warn("main.js CTA auth change failed:", err);
    setGuest();
  }
});

  (() => {
  // ------------- CONFIG tuned for smoothness --------------
  const CONFIG = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    CAPTURE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 3.5,
    VELOCITY_DISSIPATION: 2.0,
    PRESSURE: 0.1,
    PRESSURE_ITERATIONS: 20,
    CURL: 3.0,
    SPLAT_RADIUS: 0.2,          
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLOR_UPDATE_SPEED: 10,
    BACK_COLOR: { r: 0.0, g: 0.0, b: 0.0 },  
    TRANSPARENT: true,
  };

  // ------------- OUR COLOR PALETTE  ---------------
 const PALETTE = [
  "#a62d29", // rich reddish brown 
  "#4e342e", // deep dark brown
  "#6d4c41", // medium earthy brown
  "#8d6e63", // soft mocha brown
  "#3e2723"  // almost black brown
].map(hexToRGB);

  function pickPaletteColor() {
    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    // Slightly dim the color so it blends nicely
    return { r: c.r * 0.25, g: c.g * 0.25, b: c.b * 0.25 };
  }
  function hexToRGB(hex){
    const m = hex.replace('#','');
    const r = parseInt(m.slice(0,2),16)/255;
    const g = parseInt(m.slice(2,4),16)/255;
    const b = parseInt(m.slice(4,6),16)/255;
    return {r,g,b};
  }

  // ----------- SETUP -----------
  const canvas = document.getElementById('fluid');
  const pointers = [newPointer()];

  function newPointer(){
    return {
      id:-1, texcoordX:0, texcoordY:0, prevTexcoordX:0, prevTexcoordY:0,
      deltaX:0, deltaY:0, down:false, moved:false, color:[0,0,0]
    };
  }

  const { gl, ext } = getWebGLContext(canvas);
  if (!gl) return;

  if (!ext.supportLinearFiltering) {
    CONFIG.DYE_RESOLUTION = 256;
    CONFIG.SHADING = false;
  }

  // ------------- WebGL helpers -------------
  function getWebGLContext(canvas){
    const params = { alpha:true, depth:false, stencil:false, antialias:false, preserveDrawingBuffer:false };
    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if(!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    if(!gl) return { gl:null, ext:{} };

    let halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }
    gl.clearColor(0,0,0,1);
    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;
    let formatRGBA, formatRG, formatR;

    function getSupportedFormat(gl, internalFormat, format, type){
      if(!supportRenderTextureFormat(gl, internalFormat, format, type)){
        switch(internalFormat){
          case gl.R16F: return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
          case gl.RG16F: return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
          default: return null;
        }
      }
      return { internalFormat, format };
    }
    function supportRenderTextureFormat(gl, internalFormat, format, type){
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      return status === gl.FRAMEBUFFER_COMPLETE;
    }

    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG   = getSupportedFormat(gl, gl.RG16F,   gl.RG,   halfFloatTexType);
      formatR    = getSupportedFormat(gl, gl.R16F,    gl.RED,  halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG   = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatR    = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    return { gl, ext:{ formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering } };
  }

  function createProgram(vs, fs){
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
  }
  function getUniforms(program){
    const uniforms = [];
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return uniforms;
  }
  function compileShader(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  function addKeywords(src, keywords){
    if(!keywords) return src;
    return keywords.map(k => `#define ${k}\n`).join('') + src;
  }

  class ProgramWrap {
    constructor(vs, fs) {
      this.program = createProgram(vs, fs);
      this.uniforms = getUniforms(this.program);
    }
    bind(){ gl.useProgram(this.program); }
  }
  class Material {
    constructor(vs, fsSrc){
      this.vs = vs; this.fsSrc = fsSrc; this.programs = []; this.active=null; this.uniforms=[];
    }
    setKeywords(kw){
      let hash = 0; for (let i=0;i<kw.length;i++) hash += hashCode(kw[i]);
      let p = this.programs[hash];
      if(!p){
        const fs = compileShader(gl.FRAGMENT_SHADER, addKeywords(this.fsSrc, kw));
        p = this.programs[hash] = createProgram(this.vs, fs);
      }
      if (p === this.active) return;
      this.uniforms = getUniforms(p);
      this.active = p;
    }
    bind(){ gl.useProgram(this.active); }
  }

  const baseVS = compileShader(gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    uniform vec2 texelSize;
    void main(){
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition,0.0,1.0);
    }
  `);

  const copyFS = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; uniform sampler2D uTexture;
    void main(){ gl_FragColor = texture2D(uTexture, vUv); }
  `);
  const clearFS = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;
    void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }
  `);
  const displayFSSrc = `
    precision highp float; precision highp sampler2D;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    uniform sampler2D uTexture; uniform vec2 texelSize;
    void main(){
      vec3 c = texture2D(uTexture, vUv).rgb;
      #ifdef SHADING
        vec3 lc = texture2D(uTexture, vL).rgb;
        vec3 rc = texture2D(uTexture, vR).rgb;
        vec3 tc = texture2D(uTexture, vT).rgb;
        vec3 bc = texture2D(uTexture, vB).rgb;
        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);
        vec3 n = normalize(vec3(dx, dy, length(texelSize)));
        vec3 l = vec3(0.0, 0.0, 1.0);
        float diffuse = clamp(dot(n,l)+0.7,0.7,1.0);
        c *= diffuse;
      #endif
      float a = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c, a);
    }
  `;
  const splatFS = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float; precision highp sampler2D;
    varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;
    uniform vec3 color; uniform vec2 point; uniform float radius;
    void main(){
      vec2 p = vUv - point; p.x *= aspectRatio;
      vec3 splat = exp(-dot(p,p)/radius)*color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }
  `);
  const advectionFS = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float; precision highp sampler2D;
    varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;
    uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;
    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5; vec2 iuv = floor(st); vec2 fuv = fract(st);
      vec4 a = texture2D(sam, (iuv + vec2(0.5,0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5,0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5,1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5,1.5)) * tsize);
      return mix(mix(a,b,fuv.x), mix(c,d,fuv.x), fuv.y);
    }
    void main(){
      #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
      #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
      #endif
      float decay = 1.0 + dissipation * dt;
      gl_FragColor = result / decay;
    }
  `);
  const divergenceFS = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uVelocity;
    void main(){
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; }
      if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; }
      if (vB.y < 0.0) { B = -C.y; }
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
  `);
  const curlFS = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uVelocity;
    void main(){
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      float vorticity = R - L - T + B;
      gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
  `);
  const vorticityFS = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float; precision highp sampler2D;
    varying vec2 vUv,vL,vR,vT,vB; uniform sampler2D uVelocity,uCurl;
    uniform float curl; uniform float dt;
    void main(){
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T)-abs(B), abs(R)-abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C; force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity += force * dt;
      velocity = min(max(velocity, -1000.0), 1000.0);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);
  const pressureFS = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uPressure,uDivergence;
    void main(){
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float C = texture2D(uPressure, vUv).x;
      float divergence = texture2D(uDivergence, vUv).x;
      float pressure = (L + R + B + T - divergence) * 0.25;
      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
  `);
  const gradSubFS = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uPressure,uVelocity;
    void main(){
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity.xy -= vec2(R - L, T - B);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  const copyProgram = new ProgramWrap(baseVS, copyFS);
  const clearProgram = new ProgramWrap(baseVS, clearFS);
  const splatProgram = new ProgramWrap(baseVS, splatFS);
  const advectionProgram = new ProgramWrap(baseVS, advectionFS);
  const divergenceProgram = new ProgramWrap(baseVS, divergenceFS);
  const curlProgram = new ProgramWrap(baseVS, curlFS);
  const vorticityProgram = new ProgramWrap(baseVS, vorticityFS);
  const pressureProgram = new ProgramWrap(baseVS, pressureFS);
  const gradSubProgram = new ProgramWrap(baseVS, gradSubFS);
  const displayMaterial = new Material(baseVS, displayFSSrc);

  const blit = (() => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    return (target, clear=false) => {
      if (target == null) {
        gl.viewport(0,0,gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0,0,target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) { gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
  })();

  // FBO helpers
  function createFBO(w,h,internalFormat,format,type,param){
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,internalFormat,w,h,0,format,type,null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0,0,w,h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture, fbo, width:w, height:h, texelSizeX:1/w, texelSizeY:1/h,
      attach(id){ gl.activeTexture(gl.TEXTURE0+id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; }
    };
  }
  function createDoubleFBO(w,h,internalFormat,format,type,param){
    let fbo1 = createFBO(w,h,internalFormat,format,type,param);
    let fbo2 = createFBO(w,h,internalFormat,format,type,param);
    return {
      width:w,height:h, texelSizeX:fbo1.texelSizeX, texelSizeY:fbo1.texelSizeY,
      get read(){ return fbo1; }, set read(v){ fbo1=v; },
      get write(){ return fbo2; }, set write(v){ fbo2=v; },
      swap(){ const t=fbo1; fbo1=fbo2; fbo2=t; }
    };
  }
  function resizeFBO(target,w,h,internalFormat,format,type,param){
    const newFBO = createFBO(w,h,internalFormat,format,type,param);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(newFBO);
    return newFBO;
  }
  function resizeDoubleFBO(target,w,h,internalFormat,format,type,param){
    if(target.width===w && target.height===h) return target;
    target.read = resizeFBO(target.read,w,h,internalFormat,format,type,param);
    target.write = createFBO(w,h,internalFormat,format,type,param);
    target.width=w; target.height=h; target.texelSizeX=1/w; target.texelSizeY=1/h;
    return target;
  }

  function getResolution(res){
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(res);
    const max = Math.round(res * aspect);
    return (gl.drawingBufferWidth > gl.drawingBufferHeight) ? { width:max, height:min } : { width:min, height:max };
  }
  function scaleByPixelRatio(v){ const r = window.devicePixelRatio || 1; return Math.floor(v * r); }
  function hashCode(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return h; }

  // Framebuffers
  let dye, velocity, divergence, curl, pressure;

  function initFramebuffers(){
    const simRes = getResolution(CONFIG.SIM_RESOLUTION);
    const dyeRes = getResolution(CONFIG.DYE_RESOLUTION);
    const type  = ext.halfFloatTexType;
    const rgba  = ext.formatRGBA;
    const rg    = ext.formatRG;
    const r     = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    if(!dye) dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, type, filtering);
    else dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, type, filtering);

    if(!velocity) velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, type, filtering);
    else velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, type, filtering);

    divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
    curl       = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
    pressure   = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
  }

  function updateKeywords(){
    const kw = []; if (CONFIG.SHADING) kw.push('SHADING'); displayMaterial.setKeywords(kw);
  }

  // ---------- SIM LOOP ---------
  let lastUpdate = Date.now();
  let colorTimer = 0;

  function calcDT(){
    const now = Date.now();
    let dt = (now - lastUpdate)/1000;
    dt = Math.min(dt, 0.016666);
    lastUpdate = now;
    return dt;
  }
  function resizeCanvas(){
    const w = scaleByPixelRatio(canvas.clientWidth);
    const h = scaleByPixelRatio(canvas.clientHeight);
    if (canvas.width !== w || canvas.height !== h){ canvas.width=w; canvas.height=h; return true; }
    return false;
  }
  function updateColors(dt){
    colorTimer += dt * CONFIG.COLOR_UPDATE_SPEED;
    if (colorTimer >= 1){
      colorTimer = colorTimer % 1;
      pointers.forEach(p => { const c = pickPaletteColor(); p.color = [c.r,c.g,c.b]; });
    }
  }
  function applyInputs(){ pointers.forEach(p => { if(p.moved){ p.moved=false; splatPointer(p); }}); }

  function step(dt){
    gl.disable(gl.BLEND);

    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, CONFIG.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write); velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, CONFIG.PRESSURE);
    blit(pressure.write); pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for(let i=0;i<CONFIG.PRESSURE_ITERATIONS;i++){
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write); pressure.swap();
    }

    gradSubProgram.bind();
    gl.uniform2f(gradSubProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradSubProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradSubProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write); velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering)
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    let velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
    blit(velocity.write); velocity.swap();

    if (!ext.supportLinearFiltering)
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.DENSITY_DISSIPATION);
    blit(dye.write); dye.swap();
  }

  function render(target){
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    const width  = target==null ? gl.drawingBufferWidth  : target.width;
    const height = target==null ? gl.drawingBufferHeight : target.height;
    displayMaterial.bind();
    if (CONFIG.SHADING) gl.uniform2f(displayMaterial.uniforms.texelSize, 1/width, 1/height);
    gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    blit(target);
  }

  function correctRadius(radius){
    let aspect = canvas.width / canvas.height;
    if(aspect > 1) radius *= aspect;
    return radius;
  }
  function splatPointer(p){
    const dx = p.deltaX * CONFIG.SPLAT_FORCE;
    const dy = p.deltaY * CONFIG.SPLAT_FORCE;
    splat(p.texcoordX, p.texcoordY, dx, dy, {r:p.color[0],g:p.color[1],b:p.color[2]});
  }
  function splat(x,y,dx,dy,color){
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius(CONFIG.SPLAT_RADIUS/100.0));
    blit(velocity.write); velocity.swap();

    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
    blit(dye.write); dye.swap();
  }

  function updatePointerDownData(p,id,x,y){
    p.id = id; p.down = true; p.moved=false;
    p.texcoordX = x / canvas.width; p.texcoordY = 1 - y / canvas.height;
    p.prevTexcoordX = p.texcoordX; p.prevTexcoordY = p.texcoordY;
    p.deltaX = 0; p.deltaY = 0;
    const c = pickPaletteColor(); p.color = [c.r,c.g,c.b];
  }
  function updatePointerMoveData(p,x,y,color){
    p.prevTexcoordX = p.texcoordX; p.prevTexcoordY = p.texcoordY;
    p.texcoordX = x / canvas.width; p.texcoordY = 1 - y / canvas.height;
    p.deltaX = correctDeltaX(p.texcoordX - p.prevTexcoordX);
    p.deltaY = correctDeltaY(p.texcoordY - p.prevTexcoordY);
    p.moved = Math.abs(p.deltaX) > 0 || Math.abs(p.deltaY) > 0;
    p.color = color;
  }
  function updatePointerUpData(p){ p.down = false; }
  function correctDeltaX(d){ let a = canvas.width / canvas.height; if(a<1) d *= a; return d; }
  function correctDeltaY(d){ let a = canvas.width / canvas.height; if(a>1) d /= a; return d; }

  // --------- INIT ---------
  updateKeywords();
  initFramebuffers();

  function frame(){
    const dt = calcDT();
    if (resizeCanvas()) initFramebuffers();
    updateColors(dt);
    applyInputs();
    step(dt);
    render(null);
    requestAnimationFrame(frame);
  }
  frame();

  // ---------- EVENTS (mouse & touch) ----------
  window.addEventListener('mousedown', (e)=>{
    const p = pointers[0];
    updatePointerDownData(p, -1, scaleByPixelRatio(e.clientX), scaleByPixelRatio(e.clientY));
    const c = pickPaletteColor();
    const dx = 10*(Math.random()-0.5), dy = 30*(Math.random()-0.5);
    splat(p.texcoordX, p.texcoordY, dx, dy, c);
  });

  window.addEventListener('mousemove', (e)=>{
    const p = pointers[0];
    updatePointerMoveData(p, scaleByPixelRatio(e.clientX), scaleByPixelRatio(e.clientY), p.color);
  });

  window.addEventListener('touchstart', (e)=>{
    const touches = e.targetTouches; const p = pointers[0];
    for(let i=0;i<touches.length;i++){
      updatePointerDownData(p, touches[i].identifier, scaleByPixelRatio(touches[i].clientX), scaleByPixelRatio(touches[i].clientY));
    }
  }, {passive:true});

  window.addEventListener('touchmove', (e)=>{
    const touches = e.targetTouches; const p = pointers[0];
    for(let i=0;i<touches.length;i++){
      updatePointerMoveData(p, scaleByPixelRatio(touches[i].clientX), scaleByPixelRatio(touches[i].clientY), p.color);
    }
  }, {passive:true});

  window.addEventListener('touchend', (e)=>{
    const touches = e.changedTouches; const p = pointers[0];
    for(let i=0;i<touches.length;i++){ updatePointerUpData(p); }
  });

})();  


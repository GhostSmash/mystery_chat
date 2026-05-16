// three-bg.js · Mystery Chat v2
let renderer, scene, camera, particlesMesh, glitchTimer = 0;
let bgIntensity = 0.6;
const PARTICLE_COUNT = 1800;

export function initThreeBackground(intensityStart = 0.6) {
  bgIntensity = intensityStart;
  const canvas = document.getElementById("bg-canvas");
  if (!canvas || !window.THREE) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05060a, 1);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 10;

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors    = new Float32Array(PARTICLE_COUNT * 3);
  const sizes     = new Float32Array(PARTICLE_COUNT);
  const palette   = [
    new THREE.Color(0x7c6fff), new THREE.Color(0x2dd4bf),
    new THREE.Color(0xf5d020), new THREE.Color(0x1a1b2e), new THREE.Color(0x3a3560),
  ];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i*3]   = (Math.random()-.5)*18;
    positions[i*3+1] = (Math.random()-.5)*18;
    positions[i*3+2] = (Math.random()-.5)*18;
    const c = palette[Math.floor(Math.random()*palette.length)];
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    sizes[i] = Math.random()*2.2+0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions,3));
  geo.setAttribute("color",    new THREE.BufferAttribute(colors,3));
  geo.setAttribute("size",     new THREE.BufferAttribute(sizes,1));

  const mat = new THREE.ShaderMaterial({
    uniforms:{ uTime:{value:0}, uGlitch:{value:0}, uIntensity:{value:bgIntensity} },
    vertexShader:`
      attribute float size; varying vec3 vColor;
      uniform float uTime, uGlitch;
      void main(){
        vColor=color; vec3 pos=position;
        pos.x+=sin(uTime*.18+position.y*.5)*.06;
        pos.y+=cos(uTime*.14+position.x*.4)*.06;
        float gl=step(.94,fract(uTime*.8+position.y*.1));
        pos.x+=uGlitch*gl*(fract(sin(uTime*400.)*4000.)-.5)*1.2;
        vec4 mv=modelViewMatrix*vec4(pos,1.);
        gl_PointSize=size*(8./-mv.z); gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      varying vec3 vColor; uniform float uTime,uIntensity;
      void main(){
        vec2 uv=gl_PointCoord-vec2(.5); float d=length(uv);
        if(d>.5)discard;
        float a=pow(1.-d*2.,2.);
        a*=(0.75+0.25*sin(uTime*2.5+vColor.r*15.+vColor.b*7.))*uIntensity;
        gl_FragColor=vec4(vColor,a);
      }`,
    transparent:true, vertexColors:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });

  particlesMesh = new THREE.Points(geo, mat);
  scene.add(particlesMesh);

  window.addEventListener("resize",()=>{
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  });

  let last=0;
  function animate(time){
    requestAnimationFrame(animate);
    const t=time*.001, delta=t-last; last=t;
    glitchTimer-=delta;
    let gv=0;
    if(glitchTimer<=0){ glitchTimer=4+Math.random()*8; gv=Math.random()>.4?1:0; }
    if(particlesMesh){
      particlesMesh.material.uniforms.uTime.value=t;
      particlesMesh.material.uniforms.uGlitch.value=gv;
      particlesMesh.material.uniforms.uIntensity.value=bgIntensity;
      particlesMesh.rotation.y=t*.018;
      particlesMesh.rotation.x=t*.009;
    }
    renderer.render(scene,camera);
  }
  animate(0);
}

export function setBgIntensity(val){ bgIntensity=Math.max(0,Math.min(1,val)); }

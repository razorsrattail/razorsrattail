// Full VR App Script with Fixes
import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { Stats } from './libs/stats.module.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App {
  constructor() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    this.assetsPath = './assets/';

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 500);
    this.camera.position.set(0, 1.6, 0);

    this.dolly = new THREE.Object3D();
    this.dolly.position.set(0, 0, 10);
    this.dolly.add(this.camera);
    this.dummyCam = new THREE.Object3D();
    this.camera.add(this.dummyCam);

    this.scene = new THREE.Scene();
    this.scene.add(this.dolly);

    const ambient = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 0.8);
    this.scene.add(ambient);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(this.renderer.domElement);

    this.setEnvironment();

    window.addEventListener('resize', this.resize.bind(this));

    this.clock = new THREE.Clock();
    this.up = new THREE.Vector3(0, 1, 0);
    this.origin = new THREE.Vector3();
    this.workingVec3 = new THREE.Vector3();
    this.workingQuaternion = new THREE.Quaternion();
    this.raycaster = new THREE.Raycaster();

    this.stats = new Stats();
    container.appendChild(this.stats.dom);

    this.loadingBar = new LoadingBar();
    this.loadCollege();

    this.immersive = false;

    fetch('./college.json')
      .then((response) => response.json())
      .then((obj) => {
        this.boardShown = '';
        this.boardData = obj;
      });
  }

  setEnvironment() {
    const loader = new RGBELoader().setPath(this.assetsPath);

    loader.load('rogland_clear_night_1k.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;

        this.scene.background = texture;    // Set the scene's background to the HDR texture
        this.scene.environment = texture;  // Use HDR for reflective lighting too

        console.log("✅ HDR skybox 'rogland_clear_night_1k.hdr' loaded successfully");
    }, undefined, (err) => {
        console.error("❌ Failed to load HDR environment:", err);
    });
}

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loadCollege() {
    const loader = new GLTFLoader().setPath(this.assetsPath);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./libs/three/js/draco/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      'college.glb',
      (gltf) => {
        const college = gltf.scene.children[0];
        this.scene.add(college);

        college.traverse(function (child) {
					if (child.isMesh){
						if (child.name.indexOf("PROXY") !== -1){
							child.material.visible = false;
							self.proxy = child;
						}else if (child.material.name.indexOf('Glass') !== -1){
							child.material.opacity = 0.1;
							child.material.transparent = true;
						}else if (child.material.name.indexOf("SkyBox") !== -1){
							child.material.dispose();
							child.material = new THREE.MeshBasicMaterial({
								color: 0x000000, // fallback black (will be hidden by HDR)
								side: THREE.BackSide
							});
						}
					}
				});

        const door1 = college.getObjectByName('LobbyShop_Door__1_');
        const door2 = college.getObjectByName('LobbyShop_Door__2_');
        const pos = door1.position.clone().sub(door2.position).multiplyScalar(0.5).add(door2.position);
        const obj = new THREE.Object3D();
        obj.name = 'LobbyShop';
        obj.position.copy(pos);
        college.add(obj);

        this.loadingBar.visible = false;
        this.setupXR();
      },
      (xhr) => {
        this.loadingBar.progress = xhr.loaded / xhr.total;
      },
      (error) => {
        console.error('An error happened:', error);
      }
    );
  }

  setupXR() {
    this.renderer.xr.enabled = true;
    new VRButton(this.renderer);

    const timeoutId = setTimeout(() => {
      this.useGaze = true;
      this.gazeController = new GazeController(this.scene, this.dummyCam);
    }, 2000);

    this.controllers = this.buildControllers(this.dolly);

    this.controllers.forEach((controller) => {
      controller.addEventListener('selectstart', () => (controller.userData.selectPressed = true));
      controller.addEventListener('selectend', () => (controller.userData.selectPressed = false));
      controller.addEventListener('connected', () => clearTimeout(timeoutId));
    });

    const config = {
      panelSize: { height: 0.5 },
      height: 256,
      name: { fontSize: 50, height: 70 },
      info: {
        position: { top: 70 },
        backgroundColor: '#222',
        fontColor: '#ffcc00',
        fontSize: 30,
      },
    };

    const content = {
      name: 'name',
      info: 'info',
    };

    this.ui = new CanvasUI(content, config);
    this.scene.add(this.ui.mesh);
    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  buildControllers(parent = this.scene) {
    const controllerModelFactory = new XRControllerModelFactory();
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(geometry);
    line.scale.z = 0;

    const controllers = [];
    for (let i = 0; i <= 1; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.add(line.clone());
      controller.userData.selectPressed = false;
      parent.add(controller);
      controllers.push(controller);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      parent.add(grip);
    }
    return controllers;
  }

  get selectPressed() {
    return this.controllers && (this.controllers[0].userData.selectPressed || this.controllers[1].userData.selectPressed);
  }

  moveDolly(dt) {
    if (!this.proxy) return;
    const wallLimit = 1.3;
    const speed = 2;
    let pos = this.dolly.position.clone();
    pos.y += 1;
    const quaternion = this.dolly.quaternion.clone();
    this.dolly.quaternion.copy(this.dummyCam.getWorldQuaternion(this.workingQuaternion));
    this.dolly.getWorldDirection(this.workingVec3).negate();
    this.raycaster.set(pos, this.workingVec3);

    let blocked = false;
    let intersect = this.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0 && intersect[0].distance < wallLimit) blocked = true;
    if (!blocked) this.dolly.translateZ(-dt * speed);

    pos = this.dolly.getWorldPosition(this.origin);
    ['x', '-x'].forEach((axis) => {
      this.workingVec3.set(axis === 'x' ? 1 : -1, 0, 0);
      this.workingVec3.applyMatrix4(this.dolly.matrix).normalize();
      this.raycaster.set(pos, this.workingVec3);
      intersect = this.raycaster.intersectObject(this.proxy);
      if (intersect.length > 0 && intersect[0].distance < wallLimit) {
        this.dolly.translateX(axis === 'x' ? intersect[0].distance - wallLimit : wallLimit - intersect[0].distance);
      }
    });

    this.workingVec3.set(0, -1, 0);
    pos.y += 1.5;
    this.raycaster.set(pos, this.workingVec3);
    intersect = this.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) this.dolly.position.copy(intersect[0].point);
    this.dolly.quaternion.copy(quaternion);
  }

  showInfoboard(name, info, pos) {
    if (!this.ui) return;
    this.ui.position.copy(pos).add(this.workingVec3.set(0, 1.3, 0));
    const camPos = this.dummyCam.getWorldPosition(this.workingVec3);
    this.ui.updateElement('name', info.name);
    this.ui.updateElement('info', info.info);
    this.ui.update();
    this.ui.lookAt(camPos);
    this.ui.visible = true;
    this.boardShown = name;
  }

  render() {
    const dt = this.clock.getDelta();
    if (this.renderer.xr.isPresenting) {
      let moveGaze = false;
      if (this.useGaze && this.gazeController) {
        this.gazeController.update();
        moveGaze = this.gazeController.mode == GazeController.Modes.MOVE;
      }
      if (this.selectPressed || moveGaze) {
        this.moveDolly(dt);
        if (this.boardData) {
          const dollyPos = this.dolly.getWorldPosition(new THREE.Vector3());
          let boardFound = false;
          Object.entries(this.boardData).forEach(([name, info]) => {
            const obj = this.scene.getObjectByName(name);
            if (obj && dollyPos.distanceTo(obj.getWorldPosition(new THREE.Vector3())) < 3) {
              boardFound = true;
              if (this.boardShown !== name) this.showInfoboard(name, info, obj.position);
            }
          });
          if (!boardFound) {
            this.boardShown = '';
            this.ui.visible = false;
          }
        }
      }
    }
    if (this.immersive !== this.renderer.xr.isPresenting) {
      this.resize();
      this.immersive = this.renderer.xr.isPresenting;
    }
    this.stats.update();
    this.renderer.render(this.scene, this.camera);
  }
}

export { App };

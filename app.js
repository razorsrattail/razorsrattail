import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { Stats } from './libs/stats.module.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js'
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

		const ambient = new THREE.HemisphereLight(0xFFFFFF, 0xAAAAAA, 0.8);
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
		this.immersive = false;

		this.loadCollege();

		fetch('./college.json')
			.then(res => res.json())
			.then(data => {
				this.boardShown = '';
				this.boardData = data;
			});
	}

	setEnvironment() {
		const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
		const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
		pmremGenerator.compileEquirectangularShader();

		loader.load('./assets/hdr/bambanani_sunset_1k.hdr', (texture) => {
			const envMap = pmremGenerator.fromEquirectangular(texture).texture;
			pmremGenerator.dispose();
			this.scene.environment = envMap;
			this.scene.background = envMap;
			texture.dispose();
		}, undefined, (err) => {
			console.error('❌ Failed to load HDRI:', err);
			this.scene.background = new THREE.Color(0x808080);
		});
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

		loader.load('college.glb', (gltf) => {
			const college = gltf.scene.children[0];
			this.scene.add(college);

			college.traverse((child) => {
				if (child.isMesh) {
					if (child.material.name.includes('Glass')) {
						child.material = child.material.clone();
						child.material.transparent = true;
						child.material.opacity = 0.1;
					}
					if (child.name.toLowerCase().includes("wall") || child.material.name.toLowerCase().includes("wall")) {
						child.material = child.material.clone();
						child.material.color.set('#DAA520'); // your chosen wall color
					}
					if (child.material.name.includes("SkyBox")) {
						const mat = child.material;
						child.material = new THREE.MeshBasicMaterial({ map: mat.map });
						mat.dispose();
					}
					if (child.name.includes("PROXY")) {
						child.material.visible = false;
						this.proxy = child;
					}
				}
			});

			// Add Breaking Bad models
			this.loadExtraModel('BREAKING BAD RV.glb', new THREE.Vector3(5, 0, -18), Math.PI);
			this.loadExtraModel('JESSE PINKMAN.glb', new THREE.Vector3(16, 0,  -20));
			this.loadExtraModel('WALTER WHITE.glb', new THREE.Vector3(19, 0, -20));

			this.loadingBar.visible = false;
			this.setupXR();
		}, xhr => {
			this.loadingBar.progress = xhr.loaded / xhr.total;
		}, err => {
			console.error('❌ Error loading college.glb:', err);
		});
	}

	loadExtraModel(filename, position, rotationY = 0) {
		const loader = new GLTFLoader().setPath(this.assetsPath);
		loader.load(filename, (gltf) => {
			const model = gltf.scene;
			model.position.copy(position);
			model.rotation.y = rotationY;
			model.scale.set(3, 3, 3);
			this.scene.add(model);
		}, undefined, (err) => {
			console.error(`❌ Failed to load ${filename}`, err);
		});
	}

	setupXR() {
		this.renderer.xr.enabled = true;
		new VRButton(this.renderer);

		const timeoutId = setTimeout(() => {
			this.useGaze = true;
			this.gazeController = new GazeController(this.scene, this.dummyCam);
		}, 2000);

		const controllers = this.buildControllers(this.dolly);
		controllers.forEach(controller => {
			controller.addEventListener('selectstart', () => controller.userData.selectPressed = true);
			controller.addEventListener('selectend', () => controller.userData.selectPressed = false);
			controller.addEventListener('connected', () => clearTimeout(timeoutId));
		});
		this.controllers = controllers;

		const config = {
			panelSize: { height: 0.5 },
			height: 256,
			name: { fontSize: 50, height: 70 },
			info: { position: { top: 70, backgroundColor: "#ccc", fontColor: "#000" } }
		};
		const content = {
			name: "name",
			info: "info"
		};
		this.ui = new CanvasUI(content, config);
		this.scene.add(this.ui.mesh);

		this.renderer.setAnimationLoop(this.render.bind(this));
	}

	buildControllers(parent = this.scene) {
		const factory = new XRControllerModelFactory();
		const geometry = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, 0, -1)
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
			grip.add(factory.createControllerModel(grip));
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
		let dir = new THREE.Vector3();

		const quaternion = this.dolly.quaternion.clone();
		this.dolly.quaternion.copy(this.dummyCam.getWorldQuaternion(this.workingQuaternion));
		this.dolly.getWorldDirection(dir);
		dir.negate();

		this.raycaster.set(pos, dir);
		let intersect = this.raycaster.intersectObject(this.proxy);
		if (intersect.length > 0 && intersect[0].distance < wallLimit) return;

		this.dolly.translateZ(-dt * speed);
		pos = this.dolly.getWorldPosition(this.origin);

		for (let x of [-1, 1]) {
			dir.set(x, 0, 0).applyMatrix4(this.dolly.matrix).normalize();
			this.raycaster.set(pos, dir);
			intersect = this.raycaster.intersectObject(this.proxy);
			if (intersect.length > 0 && intersect[0].distance < wallLimit) {
				this.dolly.translateX(x === -1 ? wallLimit - intersect[0].distance : intersect[0].distance - wallLimit);
			}
		}

		dir.set(0, -1, 0);
		pos.y += 1.5;
		this.raycaster.set(pos, dir);
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

	render(timestamp, frame) {
		const dt = this.clock.getDelta();

		if (this.renderer.xr.isPresenting) {
			let moveGaze = false;
			if (this.useGaze && this.gazeController) {
				this.gazeController.update();
				moveGaze = (this.gazeController.mode === GazeController.Modes.MOVE);
			}
			if (this.selectPressed || moveGaze) {
				this.moveDolly(dt);
				if (this.boardData) {
					const dollyPos = this.dolly.getWorldPosition(new THREE.Vector3());
					let found = false;
					Object.entries(this.boardData).forEach(([name, info]) => {
						const obj = this.scene.getObjectByName(name);
						if (obj) {
							const pos = obj.getWorldPosition(new THREE.Vector3());
							if (dollyPos.distanceTo(pos) < 3) {
								found = true;
								if (this.boardShown !== name) this.showInfoboard(name, info, pos);
							}
						}
					});
					if (!found) {
						this.boardShown = "";
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

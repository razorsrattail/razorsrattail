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

class App{
	constructor(){
		const container = document.createElement( 'div' );
		document.body.appendChild( container );

		this.assetsPath = './assets/';
		
		this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 500 );
		this.camera.position.set( 0, 1.6, 0 );
		
		this.dolly = new THREE.Object3D();
		this.dolly.position.set(0, 0, 10);
		this.dolly.add( this.camera );
		this.dummyCam = new THREE.Object3D();
		this.camera.add( this.dummyCam );
		
		this.scene = new THREE.Scene();
		this.scene.add( this.dolly );

		this.scene.fog = new THREE.Fog(0x111122, 10, 40);

		const ambient = new THREE.HemisphereLight(0xFFFFFF, 0xAAAAAA, 0.8);
		this.scene.add(ambient);

		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.2;
		container.appendChild( this.renderer.domElement );
		this.setEnvironment();

		window.addEventListener( 'resize', this.resize.bind(this) );
		
		this.clock = new THREE.Clock();
		this.up = new THREE.Vector3(0,1,0);
		this.origin = new THREE.Vector3();
		this.workingVec3 = new THREE.Vector3();
		this.workingQuaternion = new THREE.Quaternion();
		this.raycaster = new THREE.Raycaster();
		
		this.stats = new Stats();
		container.appendChild( this.stats.dom );
		
		this.loadingBar = new LoadingBar();
		this.loadCollege();
		this.immersive = false;

		const self = this;
		fetch('./college.json')
			.then(response => response.json())
			.then(obj =>{
				self.boardShown = '';
				self.boardData = obj;
			});
	}

	setEnvironment() {
		const loader = new RGBELoader().setPath(this.assetsPath);
		const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
		pmremGenerator.compileEquirectangularShader();

		loader.load('rogland_clear_night_1k.hdr', (texture) => {
			const envMap = pmremGenerator.fromEquirectangular(texture).texture;
			this.scene.background = envMap;
			this.scene.environment = envMap;
			texture.dispose();
			pmremGenerator.dispose();
			console.log("✅ HDR environment 'rogland_clear_night_1k.hdr' loaded successfully");
		}, undefined, (err) => {
			console.error("❌ Failed to load HDR environment:", err);
			this.scene.background = new THREE.Color(0x111122); // fallback
		});

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
		directionalLight.position.set(5, 10, 7.5);
		this.scene.add(directionalLight);
	}

	resize(){
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( window.innerWidth, window.innerHeight );	
	}

	loadCollege(){
		const loader = new GLTFLoader().setPath(this.assetsPath);
		const dracoLoader = new DRACOLoader();
		dracoLoader.setDecoderPath( './libs/three/js/draco/' );
		loader.setDRACOLoader( dracoLoader );

		const self = this;
		loader.load('college.glb', function ( gltf ) {
			const college = gltf.scene.children[0];
			self.scene.add( college );

			college.traverse(function (child) {
				if (child.isMesh){
					if (child.name.indexOf("PROXY")!=-1){
						child.material.visible = false;
						self.proxy = child;
					}else if (child.material.name.indexOf('Glass')!=-1){
						child.material.opacity = 0.1;
						child.material.transparent = true;
					}else if (child.material.name.toLowerCase().includes("sky")){
						child.visible = false;
					}
				}
			});

			const door1 = college.getObjectByName("LobbyShop_Door__1_");
			const door2 = college.getObjectByName("LobbyShop_Door__2_");

			if (door1 && door2) {
				const pos = door1.position.clone().sub(door2.position).multiplyScalar(0.5).add(door2.position);
				const obj = new THREE.Object3D();
				obj.name = "LobbyShop";
				obj.position.copy(pos);
				college.add(obj);
			}

			self.loadingBar.visible = false;
			self.setupXR();
		});
	}

	setupXR(){
		this.renderer.xr.enabled = true;
		new VRButton( this.renderer );
		const self = this;
		const timeoutId = setTimeout(() => {
			self.useGaze = true;
			self.gazeController = new GazeController( self.scene, self.dummyCam );
		}, 2000);

		const onSelectStart = function () { this.userData.selectPressed = true; };
		const onSelectEnd = function () { this.userData.selectPressed = false; };
		const onConnected = function () { clearTimeout( timeoutId ); };

		this.controllers = this.buildControllers( this.dolly );
		this.controllers.forEach( controller => {
			controller.addEventListener( 'selectstart', onSelectStart );
			controller.addEventListener( 'selectend', onSelectEnd );
			controller.addEventListener( 'connected', onConnected );
		});

		const config = {
			panelSize: { height: 0.6 },
			height: 300,
			body: {
				fontFamily: "Arial",
				fontColor: "#FFFFFF",
				backgroundColor: "#111111"
			},
			name: {
				fontSize: 60,
				height: 80,
				fontColor: "#FFD700"
			},
			info: {
				position: { top: 80 },
				fontSize: 36,
				backgroundColor: "#222222",
				fontColor: "#DDDDDD"
			}
		};

		const content = {
			name: "name",
			info: "info"
		};

		this.ui = new CanvasUI( content, config );
		this.scene.add( this.ui.mesh );
		this.renderer.setAnimationLoop( this.render.bind(this) );
	}

	buildControllers( parent = this.scene ) {
		const controllerModelFactory = new XRControllerModelFactory();
		const geometry = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)
		]);
		const line = new THREE.Line( geometry );
		line.scale.z = 0;
		const controllers = [];
		for(let i=0; i<=1; i++){
			const controller = this.renderer.xr.getController(i);
			controller.add( line.clone() );
			controller.userData.selectPressed = false;
			parent.add( controller );
			controllers.push( controller );
			const grip = this.renderer.xr.getControllerGrip(i);
			grip.add( controllerModelFactory.createControllerModel(grip) );
			parent.add( grip );
		}
		return controllers;
	}

	get selectPressed(){
		return ( this.controllers !== undefined && (this.controllers[0].userData.selectPressed || this.controllers[1].userData.selectPressed) );
	}

	showInfoboard( name, info, pos ){
		if (this.ui === undefined ) return;
		this.ui.position.copy(pos).add( this.workingVec3.set( 0, 1.3, 0 ) );
		const camPos = this.dummyCam.getWorldPosition( this.workingVec3 );
		this.ui.updateElement( 'name', info.name );
		this.ui.updateElement( 'info', info.info );
		this.ui.update();
		this.ui.lookAt( camPos );
		this.ui.visible = true;
		this.boardShown = name;
	}

	render(){
		const dt = this.clock.getDelta();
		if (this.renderer.xr.isPresenting){
			let moveGaze = false;
			if ( this.useGaze && this.gazeController!==undefined){
				this.gazeController.update();
				moveGaze = (this.gazeController.mode == GazeController.Modes.MOVE);
			}
			if (this.selectPressed || moveGaze){
				this.moveDolly(dt);
				if (this.boardData){
					const dollyPos = this.dolly.getWorldPosition( new THREE.Vector3() );
					let boardFound = false;
					Object.entries(this.boardData).forEach(([name, info]) => {
						const obj = this.scene.getObjectByName( name );
						if (obj !== undefined){
							const pos = obj.getWorldPosition( new THREE.Vector3() );
							if (dollyPos.distanceTo( pos ) < 3){
								boardFound = true;
								if ( this.boardShown !== name) this.showInfoboard( name, info, pos );
							}
						}
					});
					if (!boardFound){
						this.boardShown = "";
						this.ui.visible = false;
					}
				}
			}
		}
		if ( this.immersive != this.renderer.xr.isPresenting){
			this.resize();
			this.immersive = this.renderer.xr.isPresenting;
		}
		this.stats.update();
		this.renderer.render(this.scene, this.camera);
	}
}

export { App };

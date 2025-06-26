<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>VR Gallery</title>
	<style>
		body {
			margin: 0;
			overflow: hidden;
			font-family: 'Courier New', monospace;
		}
		canvas {
			display: block;
		}
		#startButton, #musicToggle {
			position: absolute;
			left: 50%;
			transform: translateX(-50%);
			font-size: 20px;
			padding: 12px 24px;
			border-radius: 8px;
			cursor: pointer;
			z-index: 10;
			background-color: #111111;
			color: #00ffcc;
			border: 2px solid #00ffcc;
		}
		#startButton {
			top: 50%;
		}
		#musicToggle {
			top: calc(50% + 70px);
		}
		/* 🔄 Custom Loader */
		#customLoader {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: #000;
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 9999;
			flex-direction: column;
			color: #00ffcc;
			font-family: 'Courier New', monospace;
		}
	</style>
</head>
<body>

	<!-- 🎬 Video Background -->
	<video id="bgVideo" autoplay muted loop playsinline style="
		position: fixed;
		right: 0;
		bottom: 0;
		min-width: 100%;
		min-height: 100%;
		z-index: -1;
		object-fit: cover;
	">
		<source src="./assets/bg_video_breaking_bad.mp4" type="video/mp4" />
		Your browser does not support the video tag.
	</video>

	<!-- ✅ UI Buttons -->
	<button id="startButton">Start Experience</button>
	<button id="musicToggle">🔇 Turn Video Sound On</button>

	<!-- 🔄 Loading Bar -->
	<div id="customLoader">
		<p style="margin-bottom: 16px;">Loading Experience...</p>
		<div style="
			width: 50%;
			min-width: 250px;
			height: 15px;
			background-color: #333;
			border-radius: 10px;
			overflow: hidden;
		">
			<div id="progressFill" style="
				width: 0%;
				height: 100%;
				background-color: #00ffcc;
				transition: width 0.2s ease;
			"></div>
		</div>
	</div>

	<!-- ✅ Script -->
	<script type="module">
		import { App } from './app.js';

		let app;
		const bgVideo = document.getElementById('bgVideo');
		const musicBtn = document.getElementById('musicToggle');

		// 🎵 MP3 background music
		const backgroundMusic = new Audio('./assets/breaking_bad_main_theme.mp3');
		backgroundMusic.loop = true;
		backgroundMusic.volume = 1.0;

		// 🔊 Video sound toggle
		let videoSoundOn = false;
		musicBtn.addEventListener('click', () => {
			if (videoSoundOn) {
				bgVideo.muted = true;
				videoSoundOn = false;
				musicBtn.textContent = '🔇 Turn Video Sound On';
			} else {
				const playPromise = bgVideo.play();
				if (playPromise !== undefined) {
					playPromise.then(() => {
						bgVideo.muted = false;
						videoSoundOn = true;
						musicBtn.textContent = '🔊 Turn Video Sound Off';
					}).catch((err) => {
						console.error("❌ Failed to enable video sound:", err);
					});
				}
			}
		});

		// ▶️ Start Experience
		document.getElementById('startButton').addEventListener('click', () => {
			document.getElementById('startButton').style.display = 'none';
			musicBtn.style.display = 'none';
			bgVideo.style.display = 'none';
			bgVideo.pause();
			bgVideo.muted = true;

			// Show loading bar
			const loader = document.getElementById('customLoader');
			const progressBar = document.getElementById('progressFill');

			let progress = 0;
			const interval = setInterval(() => {
				progress += 1;
				progressBar.style.width = `${progress}%`;

				if (progress >= 100) {
					clearInterval(interval);
					loader.style.display = 'none';
					
					app = new App();

					backgroundMusic.play().catch((err) => {
						console.error("❌ Failed to play MP3:", err);
					});
				}
			}, 25); // 100 * 25ms = 2.5 seconds simulated load
		});
	</script>
</body>
</html>

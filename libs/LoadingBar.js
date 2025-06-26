class LoadingBar {
	constructor(options) {
		this.domElement = document.createElement("div");
		this.domElement.style.position = 'fixed';
		this.domElement.style.top = '0';
		this.domElement.style.left = '0';
		this.domElement.style.width = '100%';
		this.domElement.style.height = '100%';
		this.domElement.style.background = '#000';
		this.domElement.style.opacity = '0.85';
		this.domElement.style.display = 'flex';
		this.domElement.style.flexDirection = 'column';
		this.domElement.style.alignItems = 'center';
		this.domElement.style.justifyContent = 'center';
		this.domElement.style.zIndex = '1111';

		// Outer bar
		const barBase = document.createElement("div");
		barBase.style.background = '#222';
		barBase.style.width = '50%';
		barBase.style.minWidth = '250px';
		barBase.style.borderRadius = '12px';
		barBase.style.height = '20px';
		barBase.style.boxShadow = '0 0 15px #00ffccaa';
		barBase.style.overflow = 'hidden';
		this.domElement.appendChild(barBase);

		// Actual progress fill
		const bar = document.createElement("div");
		bar.style.background = 'linear-gradient(90deg, #00ffcc, #0066ff)';
		bar.style.borderRadius = '12px';
		bar.style.height = '100%';
		bar.style.width = '0';
		bar.style.transition = 'width 0.3s ease-in-out';
		barBase.appendChild(bar);
		this.progressBar = bar;

		// Optional: Loading text
		const text = document.createElement("div");
		text.innerText = "Loading Experience...";
		text.style.color = "#00ffcc";
		text.style.marginTop = "20px";
		text.style.fontSize = "18px";
		text.style.fontFamily = "'Courier New', monospace";
		this.domElement.appendChild(text);

		document.body.appendChild(this.domElement);
	}

	set progress(delta) {
		const percent = delta * 100;
		this.progressBar.style.width = `${percent}%`;
	}

	set visible(value) {
		this.domElement.style.display = value ? 'flex' : 'none';
	}
}

export { LoadingBar };

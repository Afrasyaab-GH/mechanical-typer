<div align="center">

# ⌨️ PLATEN: 3D Mechanical Typewriter

### *The Photorealistic, Physically Modeled 3D Mechanical Typewriter Simulator*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Zero Knowledge](https://img.shields.io/badge/Privacy-100%25_On--Device-00C853?style=for-the-badge&logo=shield&logoColor=white)](#-zero-knowledge-on-device-privacy)

[**🌐 Launch Live Simulator**](https://afrasyaab-gh.github.io/Mechanical-Typer/) • [**📖 Documentation**](#-architecture--mechanics) • [**💡 Our Vision & Dream**](#-the-vision--the-dream) • [**🤝 Contributing**](CONTRIBUTING.md)

</div>

---

## 🌟 The Vision & The Dream

In a world filled with endless notifications, sterile flat screens, and disposable digital noise, **Platen** was born from a singular dream: **to resurrect the tactile poetry, mechanical ingenuity, and uninterrupted focus of analog writing in full, photorealistic 3D fidelity.**

### Our Mission
We are building the **world's definitive open-source mechanical typewriter experience in the browser**:
1. **Uncompromising Mechanical Authenticity**: Every single mechanical linkage — from the 44 stamped sheet-metal typebars to the spring-loaded escapement wheel, bichrome ribbon spools, keylever elbows, and margin warning bell — is physically and kinematically modeled.
2. **Acoustic Realism**: Real-time procedural audio synthesis capturing the exact acoustic resonance of cast iron, vulcanized platen rubber, and striking steel blades.
3. **Absolute Privacy by Design**: Zero cloud tracking, zero telemetry, zero keystroke logging. Your words belong strictly to you, computed entirely on your local GPU and CPU.
4. **The Ultimate Writer's Sanctuary**: A serene, distraction-free environment that turns writing from a chore into a mesmerizing, meditative craft.

---

## 📸 Key Features at a Glance

```
                                  [ PLATEN 3D SIMULATOR ]
   +-----------------------------------------------------------------------------------+
   |  [Carriage & Platen]       - Spring-loaded escapement advancement (44-tooth rack) |
   |                            - Vulcanized rubber platen & knurled Bakelite knobs    |
   |                            - Relocated resonant brass margin warning bell         |
   |                                                                                   |
   |  [Basket & Kinematics]     - 44 Stamped steel typebars with fan kinematics        |
   |                            - Cast-iron comb segment casting & fulcrum wire        |
   |                            - Sculpted U-cradle cowl & S-curve swept deck panels   |
   |                                                                                   |
   |  [Ribbon & Vibrator]       - Bichrome silk ribbon with kidney lightening spools   |
   |                            - Center bifurcated ribbon vibrator carrier lift       |
   |                                                                                   |
   |  [Sound Synthesis]         - Dynamic Web Audio procedural clack, thud & bell ring |
   |  [Paper Engine]            - Single-sheet draft tilt & continuous loop scroll     |
   |  [X-Ray Inspection]        - Exploded view disassembly & kinematic chain tracing  |
   |  [Universal Export]        - PDF, Word (.docx), HTML, Plaintext & Steganography   |
   +-----------------------------------------------------------------------------------+
```

---

## ⚙️ Architecture & Mechanics

### 1. 🏗️ Full Procedural 3D Kinematics (`src/machine/buildMachine.ts`)
- **44 Stamped Steel Typebars**: Procedurally generated with authentic eyelet fulcrums, tapering shanks, and dual-character slugs striking the platen print point with accurate trigonometric arc paths.
- **90° Keylever Assembly**: Stamped keylevers with horizontal pivot rods, fulcrum combs, vertical stem sockets, and spring recovery.
- **Typebar Basket Segment**: Heavy cast-iron comb casting featuring 44 radial broached slots and a continuous spring-steel fulcrum wire.
- **Escapement & Carriage Rails**: Spring-damped escapement advance, star wheel, escapement gear rack, margin stops, and knurled Bakelite platen hand-wheels.
- **Sculpted Vintage Chassis**: Continuous swept deck cowls, wrinkle-finish cast iron, satin nickel hardware, and form-fitted under-basket cradle shield.

### 2. 🔊 Dynamic Procedural Acoustic Engine (`src/audio/MechanicalAudio.ts`)
- Powered by the **Web Audio API** with zero external audio samples:
  - **Keylever Depress & Clack**: High-frequency metallic impact and spring twang.
  - **Typebar Strike & Platen Thud**: Low-frequency resonant absorption of vulcanized rubber and cast-iron frame.
  - **Escapement Step**: Snappy mechanical escapement click on character advance.
  - **Margin Warning Bell**: Dual-mode resonant brass chime and striker clapper.
  - **Carriage Return**: Tactile sliding friction and ratchet click.

### 3. 📄 Live Paper Physics & Typography (`src/scene/Paper.tsx`)
- **Dual Paper Modes**:
  - **Single Sheet Mode**: Realistic paper curl, feeder tray tilt, and top margin bail alignment.
  - **Continuous Scroll Mode**: Endless paper loop for deep journaling, stream-of-consciousness, and long-form novel drafting.
- **Organic Ink Bleed**: Procedural ink absorption shader, ribbon ink exhaustion modeling, and authentic vintage typeface rendering (Cutive Mono, Special Elite, IBM Plex Mono, Space Mono, Geist Mono).

### 4. 🔬 Interactive X-Ray & Mechanism Inspection
- **Exploded View Disassembly**: Smooth slider to explode the machine into its fundamental assemblies (Platen, Basket, Keyboard, Chassis, Ribbon, Escapement).
- **Kinematic Chain Tracing**: Live visual inspection showing how a keypress travels from finger touch through the lever, link, typebar, segment, vibrator, and escapement rack.

### 5. 🔒 Zero-Knowledge On-Device Privacy
- **100% Local Processing**: No data ever leaves your computer or browser.
- **Universal Exporters**: Instant client-side export to:
  - **PDF** (Crisp vector/rasterized print layout)
  - **Microsoft Word** (`.docx`)
  - **Standalone Interactive HTML**
  - **Plaintext** (`.txt`) & **JSON State**
- **Cryptographic Steganography**: Built-in zero-width and pixel-level steganographic encoder/decoder to embed hidden watermarks and secret cryptographic messages inside your typed documents.

---

## 🗺️ Roadmap to Photorealism & Future Horizons

We have ambitious plans to push the boundaries of WebGL, WebGPU, and browser simulation:

- [ ] **WebGPU Real-Time Path Tracing**: Raytraced reflections, ambient occlusion, and optical glass keycap refractions.
- [ ] **Spatial Computing / WebXR**: Full VR/AR mode for Apple Vision Pro, Meta Quest, and spatial web browsers.
- [ ] **Historical Typewriter Models**:
  - *Underwood No. 5 (1900)*
  - *Royal Quiet De Luxe (1940)*
  - *Hermes 3000 (1958)*
  - *Olympia SM9 (1964)*
- [ ] **Dynamic Paper Physics**: Physical cloth and parchment tear, crease, and wrinkle simulation.
- [ ] **Multilingual Mechanical Sets**: Alternate typebar segments for international layouts (QWERTZ, AZERTY, Cyrillic, Greek, Arabic ligature wheels).

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- [npm](https://www.npmjs.com/) v10+

### Installation
```bash
# Clone the repository
git clone https://github.com/Afrasyaab-GH/Mechanical-Typer.git

# Navigate into the project directory
cd Mechanical-Typer

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to experience the typewriter!

### Building for Production
```bash
npm run build
```

---

## 🤝 Contributing

We warmly welcome contributions from the community! Whether you want to refine the procedural 3D geometries, improve audio synthesis equations, design new themes, or enhance performance:

1. Read our [**Contributing Guidelines**](CONTRIBUTING.md).
2. Adhere to our [**Code of Conduct**](CODE_OF_CONDUCT.md).
3. Fork the repository, create a branch, and submit a PR!

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Crafted with passion for typography, mechanical engineering, and open-source creativity.</sub>
</div>

# Contributing to Platen 3D Mechanical Typewriter

Thank you for your interest in contributing to **Platen: 3D Mechanical Typewriter**! We welcome contributions from developers, 3D artists, typographers, sound engineers, and mechanical history enthusiasts to help us achieve our dream of building the world's most authentic, photorealistic, and mechanically faithful digital typewriter.

---

## 🌟 Our Mission & Vision

Our goal is to preserve and elevate the tactile poetry, mechanical precision, and distraction-free beauty of analog typewriting in the digital age. Every typebar, escapement tooth, stamped keylever, and audio acoustic resonance is crafted with physical fidelity and zero-knowledge privacy in mind.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher

### Getting Started
1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/Afrasyaab-GH/Mechanical-Typer.git
   cd Mechanical-Typer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Verify TypeScript & Production Build**:
   ```bash
   npm run build
   ```

---

## 🏛️ Codebase Architecture

```
src/
├── app/                  # Application core, document state store & events
├── audio/                # Procedural Web Audio API sound synthesis engine
│   └── MechanicalAudio.ts # Key clacks, platen thuds, escapement clicks, margin bell
├── components/           # Reusable UI component library (Shadcn / Radix UI)
├── export/               # Multi-format document exporters (PDF, DOCX, HTML, TXT, JSON)
├── machine/              # Procedural 3D mechanical model definitions
│   └── buildMachine.ts   # 44 typebars, keylevers, segment, escapement, platen, chassis
├── scene/                # Three.js / React Three Fiber scene & interaction layer
│   ├── Machine.tsx       # Live interactive 3D typewriter viewport & keystroke bindings
│   ├── Materials.ts      # PBR shaders, Bakelite, wrinkle enamel, satin nickel, rubber
│   └── Paper.tsx         # Live canvas document rasterizer & ink bleed shader
├── styles/               # CSS design tokens & animations
└── ui/                   # Control panels, theme selector, export drawer, X-ray mode
```

---

## 📐 Procedural 3D & Mechanical Kinematics Guidelines

1. **Procedural First**: All mechanical parts (typebars, keylevers, segment casting, escapement wheels, paper bail, ribbon spools) are procedurally modeled using Three.js geometry primitives and parametric curves to ensure lightweight bundles and runtime customizability.
2. **Physical Kinematic Accuracy**:
   - Strike arcs follow real mechanical fulcrum centers.
   - Escapement carriage advancement is stepped per character pitch.
   - Keylevers depress along accurate angular pivots with spring recovery.
3. **PBR Material Standards**:
   - Use curated PBR materials (`castIron`, `wrinkleEnamel`, `nickel`, `bakelite`, `vulcanizedRubber`).
   - Keep surface roughness, metalness, and subtle procedural normal maps balanced for high realism.

---

## 🔊 Acoustic Sound Design Guidelines

1. All sound effects are generated 100% procedurally on-device using the **Web Audio API** (`src/audio/MechanicalAudio.ts`).
2. Acoustic profiles include:
   - Variable frequency response based on key lever length and distance from center.
   - Dynamic velocity scaling for hard vs soft typing.
   - Platen rubber acoustic absorption and hollow metal chassis cavity resonance.

---

## 🔒 Zero-Knowledge Privacy Standard

Platen is committed to absolute user privacy:
- **100% Local Execution**: No keystrokes, typed text, telemetry, or document data are ever sent over a network.
- All PDF/DOCX/HTML export processing occurs strictly in-memory in the client browser.

---

## 🚀 Submitting a Pull Request

1. Create a feature branch (`git checkout -b feature/amazing-feature`).
2. Ensure your changes compile cleanly without errors:
   ```bash
   npm run build
   ```
3. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat(machine): add knurled variable line-space ratchet wheel"
   ```
4. Push to your fork and submit a Pull Request describing your changes.

---

## 📜 License

By contributing to Platen, you agree that your contributions will be licensed under its [MIT License](LICENSE).

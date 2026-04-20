# ClipGenius AI 🎬

ClipGenius AI is a powerful desktop application built with Tauri, Rust, React, and Python, designed to transform long-form video content into viral-ready shorts. It uses AI to automatically detect the best moments, transcribe speech, and reframe landscape video into 9:16 portrait format.

## ✨ Features

- **AI Transcription**: Powered by OpenAI's Whisper (Faster-Whisper implementation) for fast and accurate subtitles.
- **Smart Framing**: Automatically detects segments and crops video to portrait format (9:16).
- **Multi-Model Support**: Choose between Base, Small, and Medium models to balance speed and accuracy.
- **Viral Styling**: Generates "Burst" style subtitles for high engagement.
- **Fast Performance**: Built with Rust backend and hardware-accelerated processing where available.

## 📦 Sidecars (Required)

Due to repository size limits, the required binary sidecars are **not** included in this repository. You must provide them manually in the `scripts/` folder:

1.  **`ffmpeg-x86_64-pc-windows-msvc.exe`**: Download from official FFmpeg site.
2.  **`whisper-x86_64-pc-windows-msvc.exe`**: Generated from `whisper_app.py` using PyInstaller.
3.  **`llama-x86_64-pc-windows-msvc.exe`**: Generated from `llama_wrapper.py` using PyInstaller.

Refer to the internal documentation for build instructions.

## 🚀 Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS (optional), Lucide Icons.
- **Backend**: Rust (Tauri framework).
- **AI/ML**: Python (Whisper for transcription, Llama for analysis).
- **Packaging**: Tauri Sidecars for distributing Python scripts as standalone binaries.

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: v18 or later.
- **Rust**: Latest stable version via `rustup`.
- **Python**: 3.9+ (if running scripts manually).
- **FFmpeg**: Required for video processing.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/clipgenius-ai.git
   cd clipgenius-ai
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies** (only for development):
   ```bash
   pip install -r requirements.txt
   ```

4. **Run in Development Mode**:
   ```bash
   npm run tauri dev
   ```

## 🏗️ Build

To create a production-ready installer:
```bash
npm run tauri build
```

## 📄 License

[MIT](LICENSE)

---
Built with ❤️ for Content Creators.

# CropDoctor 🌿

> **"A doctor in every farmer's pocket — it speaks their language, works without internet, and shows its reasoning."**
>
> **Live Demo (Vercel)**: [https://temporary-turbo-cello-fo1iquv.vercel.app](https://temporary-turbo-cello-fo1iquv.vercel.app)

---

## 📸 Overview

**CropDoctor** is an offline-first, AI-powered plant disease diagnosis Progressive Web App (PWA) tailored for Indian farmers. Designed with a high-contrast dark glassmorphic interface for outdoors and high sunlight visibility, it works seamlessly both on-device (offline) and cloud-connected (online).

When a farmer takes or uploads a picture of a diseased leaf, CropDoctor provides:
- **Crop & Disease Identification**: Instant diagnosis across 26 plant disease classes.
- **On-Device Offline Diagnosis**: Instant local inference via MobileNetV3 TFLite in a Web Worker (no internet needed).
- **Grad-CAM Visual Heatmaps**: Cloud explainability (FastAPI + EfficientNetB0) highlighting exact leaf lesion regions.
- **Comprehensive Treatment**: Organic remedies, chemical treatments, exact dosage instructions, and preventative measures.
- **Multilingual Support**: Available in 7 Indian languages (**Hindi, Marathi, Tamil, Telugu, Bengali, Kannada, English**) with text-to-speech voice playback.
- **Auto-Sync Engine**: Scans recorded offline automatically sync with MongoDB when internet connectivity is restored.

---

## 🌟 Key Features

| Feature | Description |
| :--- | :--- |
| ⚡ **Offline-First PWA** | Integrated Service Worker + IndexedDB. Complete scanning function works standard on-device when network is offline. |
| 🎨 **High-Contrast Glassmorphism UI** | Modern dark theme (`#08120b` canvas) with high-contrast text and glowing badges built for field usability. |
| 🔍 **Visual Explainability (Grad-CAM)** | Superimposes heatmaps over leaf photos to show farmers *why* a diagnosis was made. |
| 🗣️ **Multilingual & Audio-First** | Native Web Speech API synthesis + localized JSON strings across 7 regional languages. |
| 📊 **Scan History & Feedback** | Historical diagnoses tracking with user feedback capability for continuous model improvement. |
| 🚀 **Vercel CDN Ready** | Pre-configured `vercel.json` for static PWA routing and Node API serverless functions. |

---

## 🏗️ Architecture & Tech Stack

```
                                  ┌────────────────────────┐
                                  │      React 18 PWA      │
                                  │ (Web Worker + TFLite) │
                                  └───────────┬────────────┘
                                              │
                                   HTTP / REST API / Sync
                                              │
                                              ▼
                                  ┌────────────────────────┐
                                  │   Node.js / Express    │
                                  │      (Port 3001)       │
                                  └───────────┬────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
            ┌────────────────────────┐                ┌────────────────────────┐
            │   FastAPI Inference    │                │     MongoDB Database    │
            │  (EfficientNet + CAM)  │                │    (Scans & Auth DB)   │
            │      (Port 8000)       │                └────────────────────────┘
            └────────────────────────┘
```

### Layer Details

- **Frontend (`web/`)**: React 18, `@tensorflow/tfjs-tflite`, Lucide Icons, Vanilla CSS Glassmorphic System, PWA Service Worker.
- **Backend API (`api/`)**: Node.js, Express, Mongoose, JWT Guest/Farmer Auth, S3 Image Handler, Translation Router.
- **Inference Service (`inference-service/`)**: Python 3.11, FastAPI, TensorFlow/Keras, OpenCV Grad-CAM generator, Uvicorn.
- **Machine Learning (`ml/`)**: MobileNetV3 Small (TFLite int8 quant, ~2.8MB) & EfficientNetB0 (Keras FP32).

---

## 📁 Repository Structure

```
Crop Disease Diagnosis/
├── web/                         # React 18 PWA Frontend
│   ├── public/
│   │   ├── models/              # MobileNetV3 TFLite web model
│   │   └── manifest.json        # PWA Web App Manifest
│   ├── src/
│   │   ├── components/          # Camera, Scan, History, Disease Catalog
│   │   ├── offline/             # IndexedDB & Sync Manager
│   │   ├── index.css            # High-Contrast Glassmorphism Theme
│   │   └── App.jsx              # Main PWA Router
│   └── package.json
│
├── api/                         # Express REST API
│   ├── src/
│   │   ├── routes/              # Auth, Scans, Diseases, Sync, Feedback
│   │   ├── middleware/          # Guest & JWT Bearer Auth
│   │   ├── db.js                # Mongo Connection & Memory Fallback
│   │   └── app.js               # Express application
│   └── package.json
│
├── inference-service/           # FastAPI Cloud Model + Grad-CAM
│   ├── app/
│   │   ├── main.py              # /predict and /gradcam endpoints
│   │   └── gradcam.py           # Layer visualizer
│   └── requirements.txt
│
├── ml/                          # ML Pipelines & Quantization
│   ├── labels.json              # Class index dictionary (26 classes)
│   ├── train_mobilenet.py       # MobileNetV3 training script
│   ├── train_efficientnet.py    # EfficientNetB0 training script
│   └── convert_tflite.py        # TFLite int8 conversion tool
│
├── content/
│   ├── diseases.en.json         # Master English treatment dataset
│   └── scripts/
│       └── translate_content.js # Multilingual translation pipeline
│
├── docker-compose.yml           # Complete containerization spec
├── vercel.json                  # Vercel deployment spec
└── README.md
```

---

## 🌾 Supported Crops & 26 Disease Classes

Defined in `ml/labels.json`:

| Crop | Supported Diagnoses |
| :--- | :--- |
| 🍅 **Tomato** | Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Septoria Leaf Spot, Spider Mites, Target Spot, Yellow Leaf Curl Virus, Mosaic Virus, Healthy |
| 🥔 **Potato** | Early Blight, Late Blight, Healthy |
| 🌾 **Rice** | Bacterial Leaf Blight, Brown Spot, Leaf Blast, Neck Blast, Healthy |
| 🌽 **Maize** | Cercospora Leaf Spot, Common Rust, Northern Leaf Blight, Healthy |
| 🌾 **Wheat** | Brown Rust, Yellow Rust, Septoria Leaf Spot, Healthy |

---

## 🌐 Supported Languages

CropDoctor supports 7 Indian languages with localized disease names, symptom descriptions, organic/chemical treatments, and voice playback:

- 🇬🇧 **English (`en`)**
- 🇮🇳 **Hindi (`hi` - हिन्दी)**
- 🇮🇳 **Marathi (`mr` - मराठी)**
- 🇮🇳 **Tamil (`ta` - தமிழ்)**
- 🇮🇳 **Telugu (`te` - తెలుగు)**
- 🇮🇳 **Bengali (`bn` - বাংলা)**
- 🇮🇳 **Kannada (`kn` - ಕನ್ನಡ)**

---

## ⚡ Quick Start & Local Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/crop-disease-diagnosis.git
cd crop-disease-diagnosis
```

### 2. Launch Local Servers

#### Option A: Running Manually (Recommended for Quick Testing)

**Start FastAPI Inference Service (Terminal 1):**
```bash
cd inference-service
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

**Start Express Node API (Terminal 2):**
```bash
cd api
npm install
npm start
# Runs API server on http://localhost:3001
```

**Start React PWA (Terminal 3):**
```bash
cd web
npm install
npm start
# Opens http://localhost:3000
```

#### Option B: Running with Docker Compose
```bash
docker-compose up --build
```

---

## ☁️ Deployment

### Vercel Deployment
This repository includes a production-ready `vercel.json` configuration for deployment to Vercel:

```bash
npx vercel deploy --prod
```

Live Production Link: **[https://temporary-turbo-cello-fo1iquv.vercel.app](https://temporary-turbo-cello-fo1iquv.vercel.app)**

---

## 🧪 Testing & Quality Assurance

Run complete test suites across all modules:

```bash
# Test Machine Learning Preprocessing Parity
python -m pytest ml/tests/test_preprocessing_parity.py

# Test FastAPI Inference & Grad-CAM Endpoints
python -m pytest inference-service/tests/test_main.py

# Test Express API Endpoints
cd api && npm test

# Test React Component Rendering
cd web && npm test
```

---

## 🛡️ Disclaimer

> ⚠️ **Educational & Diagnostic Support Tool Only**  
> Treatment recommendations provided in CropDoctor are for general guidance. Farmers should verify product dosages with local agricultural extension officers or certified agronomists before large-scale pesticide applications.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more details.

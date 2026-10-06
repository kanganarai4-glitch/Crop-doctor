# CropDoctor 🌿

> **"A doctor in every farmer's pocket — it speaks their language, works without internet, and shows its reasoning."**
>
> HSA-94: Plant Disease Diagnosis | Hackathon Project

---

## Overview

CropDoctor is an offline-first AI-powered plant disease diagnosis Progressive Web App (PWA) for Indian farmers.

A farmer photographs a diseased leaf → within seconds the app shows:
- The **crop and disease name** in the farmer's local language
- A **confidence score** with a visual bar
- Top-3 alternative diagnoses
- **Grad-CAM heatmap** (online only) showing *where* the model is looking
- Full **treatment advice** — organic + chemical, dosage, precautions, prevention
- **Voice playback** (Bhashini TTS) in the farmer's language
- Works **completely offline** with on-device MobileNetV3 inference

---

## Repository Structure

```
cropdoctor/
├── ml/                          # ML training and conversion
│   ├── labels.json              # ← Single source of truth for all 26 classes
│   ├── PREPROCESSING_SPEC.md    # ← Normative preprocessing spec
│   ├── generate_dummy_models.py # ← Run this first (no GPU needed)
│   ├── train_efficientnet.py
│   ├── train_mobilenet.py
│   ├── evaluate.py
│   ├── convert_tflite.py
│   └── tests/
│       └── test_preprocessing_parity.py
│
├── inference-service/           # FastAPI (EfficientNetB0 + Grad-CAM)
│   ├── app/
│   │   ├── main.py
│   │   └── gradcam.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── api/                         # Node/Express backend
│   ├── src/
│   │   ├── index.js
│   │   ├── app.js
│   │   ├── db.js
│   │   ├── middleware/
│   │   └── routes/
│   ├── package.json
│   └── Dockerfile
│
├── web/                         # React PWA
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json        # ← PWA manifest
│   │   ├── sw.js                # ← Service Worker
│   │   └── models/              # ← TFLite model for offline inference
│   ├── src/
│   │   ├── index.js
│   │   ├── index.css            # ← Design system
│   │   └── App.jsx
│   ├── package.json
│   └── Dockerfile
│
├── content/
│   ├── diseases.en.json         # ← English disease treatment content (seed)
│   └── scripts/
│       └── translate_content.js # ← Bhashini translation pipeline (Phase 4)
│
├── .github/workflows/
│   ├── ci.yml                   # ← PR: lint + test
│   └── deploy.yml               # ← main merge: build + push + ECS deploy
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Crops & Diseases

**26 classes** across 5 crops (defined in `ml/labels.json`):

| Crop   | Classes |
|--------|---------|
| Tomato | Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Septoria Leaf Spot, Spider Mites, Target Spot, Yellow Leaf Curl Virus, Mosaic Virus, Healthy |
| Potato | Early Blight, Late Blight, Healthy |
| Rice   | Bacterial Leaf Blight, Brown Spot, Leaf Blast, Neck Blast, Healthy |
| Maize  | Cercospora Leaf Spot, Common Rust, Northern Leaf Blight, Healthy |
| Wheat  | Brown Rust, Yellow Rust, Septoria, Healthy |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React PWA (Create React App) |
| On-device ML | MobileNetV3Small → TFLite (int8) via `@tensorflow/tfjs-tflite` |
| Server ML | EfficientNetB0 (FastAPI) |
| Explainability | Grad-CAM (last conv layer of EfficientNet) |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose) |
| Storage | AWS S3 (pre-signed URLs) |
| Translation + TTS | Bhashini API |
| Containers | Docker + docker-compose |
| CI/CD | GitHub Actions |
| Deployment | AWS ECS Fargate + ECR |

---

## Phase Build Status

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Done | Skeleton, docker-compose, dummy models, labels |
| 1 | 🔲 Pending | TFLite browser smoke test |
| 2 | 🔲 Pending | ML training + FastAPI /predict /gradcam /health |
| 3 | 🔲 Pending | MongoDB schemas, seed, Node API all routes |
| 4 | 🔲 Pending | Bhashini translation + TTS pipeline |
| 5 | 🔲 Pending | React PWA all screens |
| 6 | 🔲 Pending | Offline: Service Worker, IndexedDB, sync |
| 7 | 🔲 Pending | Dockerfiles, CI/CD, ECS deployment |
| 8 | 🔲 Pending | Tests, Lighthouse fixes, demo script |

---

## Quick Start (Phase 0)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker Desktop

### 1. Clone and setup env
```bash
git clone <your-repo-url> cropdoctor
cd cropdoctor
cp .env.example .env
# Edit .env with your secrets
```

### 2. Generate dummy models (no GPU needed)
```bash
pip install tensorflow-cpu pillow numpy
python ml/generate_dummy_models.py
```
This creates:
- `ml/models/efficientnet_dummy.keras`
- `ml/models/mobilenet_dummy.keras`
- `ml/models/mobilenet_dummy.tflite`  ← used by FastAPI
- `ml/models/mobilenet_dummy_int8.tflite`
- `web/public/models/mobilenet_dummy.tflite`  ← used by PWA

### 3. Run with Docker Compose
```bash
docker-compose up --build
```

| Service | URL |
|---------|-----|
| React PWA | http://localhost:3000 |
| Node API | http://localhost:3001 |
| API Docs | http://localhost:3001/docs |
| FastAPI | http://localhost:8000 |
| FastAPI Docs | http://localhost:8000/docs |

### 4. Verify Phase 0 health
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"cropdoctor-api"}

curl http://localhost:8000/health
# {"status":"ok","modelLoaded":true,...}

curl -X POST http://localhost:3001/api/auth/guest
# {"token":"...","userId":"guest_...","role":"guest"}
```

---

## Running Without Docker

### FastAPI Inference Service
```bash
cd inference-service
pip install -r requirements.txt
export MODEL_DIR=../ml/models
export LABELS_PATH=../ml/labels.json
uvicorn app.main:app --reload --port 8000
```

### Node API
```bash
cd api
npm install
# Ensure MongoDB is running on localhost:27017
cp ../.env.example .env  # fill in JWT_SECRET at minimum
npm run dev
```

### React PWA
```bash
cd web
npm install
npm start
# Opens http://localhost:3000
```

---

## ML Training (When Dataset is Available)

### Datasets
- **PlantVillage**: ~54,000 lab images across 26 disease classes
- **PlantDoc**: ~2,500 real-field images (noisier, more realistic)

### Dataset Split Strategy
(See `ml/PREPROCESSING_SPEC.md` for rationale)
```
Train  : PlantVillage 80% + PlantDoc 80%
Val    : PlantVillage 10% + PlantDoc 10%
Test   : PlantDoc 10% ONLY  (out-of-domain — harder, more honest)
```

### Prepare dataset directory
```
/path/to/dataset/
  train/
    tomato_bacterial_spot/  img1.jpg img2.jpg ...
    tomato_early_blight/    ...
    ...
  val/
    ...
  test/
    ...
```

### Train EfficientNetB0 (server model)
```bash
python ml/train_efficientnet.py \
  --data_dir /path/to/dataset \
  --output_dir ml/models \
  --epochs_head 10 \
  --epochs_finetune 20
```

### Train MobileNetV3Small (on-device model)
```bash
python ml/train_mobilenet.py \
  --data_dir /path/to/dataset \
  --output_dir ml/models \
  --epochs_head 10 \
  --epochs_finetune 20
```

### Evaluate
```bash
python ml/evaluate.py \
  --model ml/models/efficientnet_final.keras \
  --test_dir /path/to/dataset/test
# → ml/eval_results/metrics.json
# → ml/eval_results/confusion_matrix.png
```

### Convert to TFLite
```bash
python ml/convert_tflite.py \
  --model ml/models/mobilenet_final.keras \
  --val_dir /path/to/dataset/val \
  --output_dir ml/models
# → ml/models/mobilenet_final.tflite   (~4-6 MB)
# → ml/models/mobilenet_final_int8.tflite  (~2-3 MB)
```

---

## Preprocessing Contract

**CRITICAL**: All services must follow this exactly — see `ml/PREPROCESSING_SPEC.md`.

| Step | Value |
|------|-------|
| Resize | 224 × 224 px (bilinear) |
| Color | RGB |
| Dtype | float32 |
| Pixel range | **0 – 255** (NO normalisation by caller) |
| Internal rescaling | Done inside the Keras model |

---

## Supported Languages

| Code | Language |
|------|----------|
| en | English |
| hi | Hindi (हिन्दी) |
| mr | Marathi (मराठी) |
| ta | Tamil (தமிழ்) |
| te | Telugu (తెలుగు) |
| bn | Bengali (বাংলা) |
| kn | Kannada (ಕನ್ನಡ) |

---

## Environment Variables

See `.env.example` for all required variables with descriptions.

Key variables:
- `JWT_SECRET` — must be set before any auth will work
- `MONGO_URI` — MongoDB connection string
- `AWS_*` — S3 credentials for image storage
- `BHASHINI_*` — Bhashini API credentials for translation/TTS
- `LOW_CONFIDENCE_THRESHOLD` — default `0.60`

---

## API Endpoints (Phase 0 stubs, full in Phase 3)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | Public | API health check |
| POST | /api/auth/guest | Public | Issue guest JWT |
| POST | /api/auth/otp | Public | Request OTP (demo: always 123456) |
| POST | /api/auth/verify | Public | Verify OTP, get user JWT |
| POST | /api/scan | Bearer | Upload image, get diagnosis |
| GET | /api/scans | Bearer | Scan history |
| POST | /api/sync | Bearer | Bulk sync offline scans |
| GET | /api/disease/:key | Public | Treatment info (with ?lang=hi) |
| POST | /api/feedback | Bearer | Correct a scan prediction |
| GET | /api/model/latest | Public | Current TFLite version + S3 URL |
| GET | /api/stats | Bearer | Admin region/disease stats |
| GET | /docs | Public | Swagger UI |

---

## AWS Infrastructure (Manual Steps — Phase 7)

These steps must be done manually in the AWS console before deployment:

1. **ECR Repositories**: Create `cropdoctor-web`, `cropdoctor-api`, `cropdoctor-inference`
2. **ECS Cluster**: Create `cropdoctor-cluster` (Fargate)
3. **ECS Services**: Three services (web, api, inference)
4. **ALB**: Application Load Balancer with:
   - `/` → web service (port 80)
   - `/api/*` → api service (port 3001)
   - Inference service: internal only (not behind ALB)
5. **ACM Certificate**: For HTTPS (required for camera + service worker on real devices)
6. **S3 Bucket**: `cropdoctor-images` with CORS configured for the ALB domain
7. **IAM**: GitHub OIDC provider + deployment role with ECR push + ECS deploy permissions

Full step-by-step guide in Phase 7 output.

---

## Demo Script (Airplane-Mode Demo — Phase 8)

1. Open the app on a mobile device
2. Scan a healthy leaf → shows "Healthy" with high confidence
3. Enable airplane mode on the phone
4. Scan a diseased leaf → app uses on-device MobileNet → shows prediction
5. Re-enable network → app auto-syncs the offline scan with "Synced ✓" indicator
6. Show scan history with the offline scan now updated with cloud results
7. Tap "Listen" → plays treatment advice in the farmer's language

---

## Disclaimer

> ⚠️ **All treatment recommendations are for educational purposes only.**
> Always follow product label instructions exactly.
> For serious infestations or any doubt, consult your local agriculture officer.
> Accuracy metrics from dummy/random-weight models are meaningless and should never be cited.

---

## License

MIT License — see LICENSE file.

## Team

Built for HSA-94: Plant Disease Diagnosis hackathon challenge.

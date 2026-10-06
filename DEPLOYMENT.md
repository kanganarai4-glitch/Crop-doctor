# CropDoctor — Production Deployment Specification 🌿

> **Production Deployment Guide for HSA-94 CropDoctor Plant Disease Diagnosis PWA**

---

## 1. Overview Architecture

CropDoctor is deployed as a 3-container microservices architecture with a dedicated MongoDB persistence layer and AWS S3 object store.

```
                  ┌─────────────────────────────────────┐
                  │      AWS Application Load Balancer  │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │ HTTP/S (Port 80/443)    │ /api/* (Port 3001)      │
           ▼                         ▼                         │
 ┌───────────────────┐     ┌───────────────────┐               │ Internal VPC
 │  cropdoctor-web   │     │   cropdoctor-api  │               │ (Port 8000)
 │ (React PWA Nginx) │     │ (Node.js Express) │               ▼
 └───────────────────┘     └─────────┬─────────┘     ┌───────────────────┐
                                     │               │cropdoctor-inference│
                                     ├───► MongoDB   │ (FastAPI + TF)    │
                                     │    (27017)    └───────────────────┘
                                     │
                                     └───► AWS S3 (scans)
```

---

## 2. Docker & Local Deployment

### Prerequisites
- Docker Engine 24.0+ & Docker Compose v2
- Generated models (`ml/models/efficientnet_dummy.keras` & `mobilenet_dummy.tflite`)

### Single-Command Local Stack
```bash
# 1. Clone & environment setup
cp .env.example .env

# 2. Build and launch all 4 services (web, api, inference, mongo)
docker-compose up --build -d
```

### Service Health Verification
```bash
# Check running containers
docker-compose ps

# Health probes
curl http://localhost:3001/health
# -> {"status":"ok","service":"cropdoctor-api"}

curl http://localhost:8000/health
# -> {"status":"ok","modelLoaded":true,"modelVersion":"0.0.1-dummy","numClasses":26}

curl -I http://localhost:3000/
# -> HTTP/1.1 200 OK
```

---

## 3. Cloud Deployment (AWS ECS Fargate + ECR)

### Step 1: ECR Repositories Setup
Create three ECR repositories in your AWS region (`ap-south-1` recommended):
```bash
aws ecr create-repository --repository-name cropdoctor-web
aws ecr create-repository --repository-name cropdoctor-api
aws ecr create-repository --repository-name cropdoctor-inference
```

### Step 2: Build & Push Images
```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Web PWA
docker build --build-arg REACT_APP_API_URL=/api -t <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/cropdoctor-web:latest ./web
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/cropdoctor-web:latest

# Node API
docker build -t <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/cropdoctor-api:latest ./api
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/cropdoctor-api:latest

# Inference Service
docker build -t <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/cropdoctor-inference:latest ./inference-service
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/cropdoctor-inference:latest
```

### Step 3: CI/CD Pipeline Configuration (.github/workflows/deploy.yml)
Configure the following secrets in GitHub Repository Settings (`Settings` → `Secrets and variables` → `Actions`):

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `AWS_ROLE_ARN` | IAM OIDC Deployment Role | `arn:aws:iam::123456789012:role/GitHubActionsECR` |
| `ECR_REGISTRY` | AWS ECR Host URI | `123456789012.dkr.ecr.ap-south-1.amazonaws.com` |
| `ECS_CLUSTER` | AWS ECS Cluster Name | `cropdoctor-cluster` |
| `ECS_SERVICE_WEB` | ECS Web Service Name | `cropdoctor-web-service` |
| `ECS_SERVICE_API` | ECS API Service Name | `cropdoctor-api-service` |
| `ECS_SERVICE_INFERENCE` | ECS Inference Service Name | `cropdoctor-inference-service` |
| `ECS_TASK_DEF_WEB` | Path or name of web task def | `task-def-web.json` |
| `ECS_TASK_DEF_API` | Path or name of api task def | `task-def-api.json` |
| `ECS_TASK_DEF_INFERENCE` | Path or name of inference task def | `task-def-inference.json` |

---

## 4. Production Checklist

- [x] **CORS & Security Headers**: Helmet & CORS configured in `api/src/app.js`.
- [x] **API Rate Limiting**: 500 requests / 15 min configured per client IP.
- [x] **Image Preprocessing Parity**: 224×224 RGB float32 (0-255 range) contract enforced across Web Worker, Node API, and FastAPI.
- [x] **IndexedDB & Service Worker**: Offline scan persistence and auto-sync queue active in `web/src/offline/`.
- [x] **Automated Tests**: Unit and integration test suites passing 100% across all 4 sub-projects.

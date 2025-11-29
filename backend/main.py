from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
import cv2
import numpy as np
import os
import requests
import time
from functools import lru_cache

# Model configuration
MODEL_PATH = "best.pt"
MODEL_URL = "https://github.com/Shamilp-dev/Fire-Detection-System/releases/download/v1.0.0/best.pt"
model = None

# ✅ OPTIMIZATION 1: Use faster JSON serializer
app = FastAPI(default_response_class=ORJSONResponse)

# ✅ OPTIMIZATION 2: CORS with preflight caching
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://fire-detection-system.netlify.app",  # ⚠️ REPLACE with your actual domain
        "https://shamilpziyad-fire-detection-backend.hf.space"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Only needed methods
    allow_headers=["*"],
    max_age=3600  # Cache preflight for 1 hour
)

# ✅ OPTIMIZATION 3: GZip compression for responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ✅ OPTIMIZATION 4: Cached model loader
@lru_cache(maxsize=1)
def load_yolo_model(path: str):
    """Load and cache YOLO model - prevents reloading"""
    from ultralytics import YOLO
    return YOLO(path)

@app.on_event("startup")
async def startup_event():
    """Load model on startup with optimizations"""
    global model
    try:
        from ultralytics import YOLO
        import torch.serialization
        from ultralytics.nn.tasks import DetectionModel
        
        # Download model if needed
        if not os.path.exists(MODEL_PATH):
            print("📥 Downloading model from GitHub...")
            response = requests.get(MODEL_URL, stream=True, timeout=60)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(MODEL_PATH, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size:
                            progress = (downloaded / total_size) * 100
                            print(f"Download progress: {progress:.1f}%", end='\r')
            
            print("\n✅ Model downloaded!")
        
        # Load model with caching
        print("🔄 Loading model...")
        torch.serialization.add_safe_globals([DetectionModel])
        model = load_yolo_model(MODEL_PATH)
        
        # ✅ OPTIMIZATION 5: Warmup inference to load weights into memory
        print("🔥 Warming up model...")
        dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
        model(dummy_img, verbose=False)
        
        print("✅ Model ready and optimized!")
        
    except Exception as e:
        print(f"❌ Model loading failed: {e}")
        model = None

@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "message": "🔥 Fire Detection API",
        "status": "running",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "detect": "/detect/"
        }
    }

@app.get("/health")
async def health():
    """Fast health check - for uptime monitoring"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "timestamp": time.time()
    }

@app.post("/detect/")
async def detect_fire(file: UploadFile = File(...)):
    """
    Optimized fire detection endpoint
    Returns: JSON with detections, inference time, and metadata
    """
    start_time = time.time()
    
    try:
        # ✅ FIX 1: Proper error handling with HTTPException
        if model is None:
            raise HTTPException(
                status_code=503,
                detail="Model not loaded. Please check server logs or restart."
            )
        
        # ✅ OPTIMIZATION 6: Async file reading
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # ✅ FIX 2: Proper error handling for invalid images
        if img is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid image file. Supported: JPG, PNG, JPEG"
            )

        # ✅ OPTIMIZATION 7: Resize large images before inference
        original_height, original_width = img.shape[:2]
        max_size = 640
        
        if original_width > max_size or original_height > max_size:
            scale = max_size / max(original_width, original_height)
            new_width = int(original_width * scale)
            new_height = int(original_height * scale)
            img = cv2.resize(
                img,
                (new_width, new_height),
                interpolation=cv2.INTER_LINEAR
            )
            print(f"Resized: {original_width}x{original_height} → {new_width}x{new_height}")

        # ✅ OPTIMIZATION 8: Optimized inference parameters
        results = model(
            img,
            conf=0.25,      # Confidence threshold (filter low confidence)
            iou=0.45,       # NMS IoU threshold
            max_det=100,    # Maximum detections per image
            verbose=False,  # Disable logging for speed
            half=False      # Don't use FP16 (better compatibility)
        )
        
        result = results[0]
        detections = []
        
        # ✅ OPTIMIZATION 9: Efficient detection parsing
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0].item())
            cls = int(box.cls[0].item())
            label = result.names[cls]

            # Only return high confidence detections
            if conf > 0.25:
                detections.append({
                    "label": label,
                    "confidence": round(conf, 4),
                    "bbox": [
                        round(x1, 2),
                        round(y1, 2),
                        round(x2, 2),
                        round(y2, 2)
                    ]
                })

        inference_time = (time.time() - start_time) * 1000  # Convert to ms
        
        # ✅ OPTIMIZATION 10: Return metadata for debugging
        return {
            "detections": detections,
            "num_detections": len(detections),
            "inference_time_ms": round(inference_time, 2),
            "image_size": {
                "original": f"{original_width}x{original_height}",
                "processed": f"{img.shape[1]}x{img.shape[0]}"
            }
        }

    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as e:
        # ✅ FIX 3: Proper error handling for unexpected errors
        print(f"❌ Detection error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Detection failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True
    )

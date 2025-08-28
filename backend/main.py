from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import os
import requests

# Global variable for model
model = None
MODEL_PATH = "best.pt"
MODEL_URL = "https://github.com/Shamilp-dev/Fire-Detection-System/releases/download/v1.0.0/best.pt"

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Load model on startup - with automatic download"""
    global model
    try:
        from ultralytics import YOLO
        
        # Download model if it doesn't exist
        if not os.path.exists(MODEL_PATH):
            print("Downloading model from GitHub Releases...")
            response = requests.get(MODEL_URL, stream=True)
            response.raise_for_status()
            
            with open(MODEL_PATH, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            print("Model downloaded successfully!")
        
        # Now load the model
        print("Loading model...")
        model = YOLO(MODEL_PATH)
        print("Model loaded successfully!")
        
    except Exception as e:
        print(f"Model loading failed: {e}")
        print("API will run without model functionality")
        model = None

@app.get("/")
async def root():
    return {"message": "Fire Detection API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/detect/")
async def detect_fire(file: UploadFile = File(...)):
    try:
        if model is None:
            return {"error": "Model not loaded. Check backend logs."}, 503
            
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"error": "Invalid image file"}, 400

        results = model(img)
        result = results[0]

        detections = []
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = box.conf[0].item()
            cls = int(box.cls[0].item())
            label = result.names[cls]

            detections.append({
                "label": label,
                "confidence": conf,
                "bbox": [x1, y1, x2, y2]
            })

        return {"detections": detections}

    except Exception as e:
        return {"error": str(e)}, 500

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import os
import requests
import torch

# Use GitHub Releases URL
MODEL_URL = "https://github.com/Shamilp-dev/Fire-Detection-System/releases/download/v1.0.0/best.pt"
MODEL_PATH = "best.pt"

# Download model if it doesn't exist
if not os.path.exists(MODEL_PATH):
    print("Downloading model file from GitHub Releases...")
    try:
        response = requests.get(MODEL_URL, stream=True)
        response.raise_for_status()
        
        with open(MODEL_PATH, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        print("Model downloaded successfully from GitHub!")
        print(f"File size: {os.path.getsize(MODEL_PATH)} bytes")
        
    except Exception as e:
        print(f"Error downloading model: {e}")
        if os.path.exists(MODEL_PATH):
            os.remove(MODEL_PATH)
        raise

# Load your trained model - SIMPLIFIED approach
print("Loading model...")
try:
    # Use the standard YOLO loader but ensure compatibility
    model = YOLO(MODEL_PATH)
    print("Model loaded successfully!")
    
except Exception as e:
    print(f"Error loading model: {e}")
    if os.path.exists(MODEL_PATH):
        file_size = os.path.getsize(MODEL_PATH)
        print(f"Model file size: {file_size} bytes")
    # Don't raise here, let the app start but without model functionality
    model = None

app = FastAPI()

# CORS configuration - UPDATE WITH YOUR ACTUAL URLS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://localhost:3002",
        "http://localhost:3003",
        "https://fire-detection-system-backend.onrender.com",
        "https://your-app-name.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Fire Detection API is running"}

@app.get("/favicon.ico")
async def get_favicon():
    return Response(status_code=204)

@app.post("/detect/")
async def detect_fire(file: UploadFile = File(...)):
    try:
        if model is None:
            return {"error": "Model not loaded properly"}, 500
            
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

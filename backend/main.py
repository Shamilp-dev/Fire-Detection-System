from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import os
import requests
import torch
from ultralytics.nn.tasks import DetectionModel
from torch.nn.modules.container import Sequential  # Add this import

# Add ALL required safe globals for PyTorch 2.6 compatibility
torch.serialization.add_safe_globals([
    DetectionModel,
    Sequential,
    # Add any other classes that might be needed
    torch.nn.Module,
    torch.nn.Conv2d,
    torch.nn.BatchNorm2d,
    torch.nn.LeakyReLU,
    torch.nn.Upsample,
    torch.nn.MaxPool2d,
    torch.nn.SiLU,
])

# Use GitHub Releases URL
MODEL_URL = "https://github.com/Shamilp-dev/Fire-Detection-System/releases/download/v1.0.0/best.pt"
MODEL_PATH = "best.pt"

# Download model if it doesn't exist
if not os.path.exists(MODEL_PATH):
    print("Downloading model file from GitHub Releases...")
    try:
        response = requests.get(MODEL_URL, stream=True)
        response.raise_for_status()
        
        # Save the file
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

# Load your trained model
print("Loading model...")
try:
    model = YOLO(MODEL_PATH)
    print("Model loaded successfully!")
    
except Exception as e:
    print(f"Error loading model: {e}")
    if os.path.exists(MODEL_PATH):
        file_size = os.path.getsize(MODEL_PATH)
        print(f"Model file size: {file_size} bytes")
    raise

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-app-name.netlify.app"],
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
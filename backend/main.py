from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import os
import requests
import torch

# Model configuration
MODEL_URL = "https://drive.google.com/uc?export=download&id=1_4lscae-63ZzMZG1PZOOChaL6Qg2TkCO"
MODEL_PATH = "best.pt"

# Download model if it doesn't exist
if not os.path.exists(MODEL_PATH):
    print("Downloading model file from Google Drive...")
    try:
        response = requests.get(MODEL_URL)
        response.raise_for_status()  # Check for HTTP errors
        
        with open(MODEL_PATH, "wb") as f:
            f.write(response.content)
        print("Model downloaded successfully!")
    except Exception as e:
        print(f"Error downloading model: {e}")
        raise

# Fix for PyTorch weights_only error
def safe_torch_load(path):
    """Load PyTorch model safely with weights_only=False for compatibility"""
    try:
        # First try with weights_only=True (secure)
        return torch.load(path, map_location='cpu', weights_only=True)
    except:
        # Fallback to weights_only=False for older models
        print("Falling back to weights_only=False for compatibility")
        return torch.load(path, map_location='cpu', weights_only=False)

# Load your trained model with compatibility fix
print("Loading model with compatibility fix...")
try:
    # Patch the ultralytics loading function
    from ultralytics.nn.tasks import torch_safe_load
    
    # Replace the default loader with our safe loader
    original_torch_safe_load = torch_safe_load
    def patched_torch_safe_load(weight):
        try:
            return original_torch_safe_load(weight)
        except:
            # Fallback to our safe loader
            return safe_torch_load(weight), weight
    
    # Apply the patch
    import ultralytics.nn.tasks
    ultralytics.nn.tasks.torch_safe_load = patched_torch_safe_load
    
    # Now load the model
    model = YOLO(MODEL_PATH)
    print("Model loaded successfully with compatibility fix!")
    
except Exception as e:
    print(f"Error loading model: {e}")
    raise

app = FastAPI()

# CORS for both development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Development
        "https://your-app-name.netlify.app"  # Production - UPDATE THIS AFTER DEPLOYMENT
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
        # Read the uploaded image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"error": "Invalid image file"}, 400

        # Run YOLO detection
        results = model(img)
        result = results[0]

        # Parse the results
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
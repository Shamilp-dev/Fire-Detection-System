from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import os
import requests

# Model configuration - UPDATED URL
MODEL_URL = "https://drive.google.com/uc?export=download&id=1_4lscae-63ZzMZG1PZOOChaL6Qg2TkCO&confirm=t"
MODEL_PATH = "best.pt"

# Download model if it doesn't exist
if not os.path.exists(MODEL_PATH):
    print("Downloading model file from Google Drive...")
    try:
        # Use a session to handle cookies
        session = requests.Session()
        response = session.get(MODEL_URL, stream=True)
        response.raise_for_status()
        
        # Check if we got the actual file (not HTML)
        content_type = response.headers.get('content-type', '')
        if 'text/html' in content_type:
            raise Exception("Got HTML instead of model file - check Google Drive sharing settings")
        
        # Save the file
        with open(MODEL_PATH, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        print("Model downloaded successfully!")
        print(f"File size: {os.path.getsize(MODEL_PATH)} bytes")
        
    except Exception as e:
        print(f"Error downloading model: {e}")
        # Remove corrupted file if it exists
        if os.path.exists(MODEL_PATH):
            os.remove(MODEL_PATH)
        raise

# Load your trained model
print("Loading model...")
try:
    # Use ultralytics native loading which handles PyTorch compatibility
    model = YOLO(MODEL_PATH)
    print("Model loaded successfully!")
    
except Exception as e:
    print(f"Error loading model: {e}")
    # Check if file is valid
    if os.path.exists(MODEL_PATH):
        file_size = os.path.getsize(MODEL_PATH)
        print(f"Model file size: {file_size} bytes")
        if file_size < 1000000:  # Less than 1MB probably isn't a model
            print("File seems too small - may be corrupted or wrong file")
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
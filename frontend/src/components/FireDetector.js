import React, { useRef, useState, useEffect } from 'react';
import Webcam from "react-webcam";

const FireDetector = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Function to send a frame to the backend
  const detectFrame = async () => {
    if (!webcamRef.current) return;

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      // Use your actual Render backend URL
      const API_URL = 'https://shamilpziyad-fire-detection-backend.hf.space';
      
      const response = await fetch(`${API_URL}/detect/`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setDetections(data.detections || []);
      setError(null);
      
    } catch (error) {
      console.error("Error calling detection API:", error);
      setError(error.message);
    }
  };

  // Start/Stop detection
  const toggleDetection = () => {
    if (isDetecting) {
      setIsDetecting(false);
      clearInterval(intervalRef.current);
      setError(null);
    } else {
      setIsDetecting(true);
      setError(null);
      intervalRef.current = setInterval(detectFrame, 1000); // Slower to avoid overload
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Draw bounding boxes
  useEffect(() => {
  const canvas = canvasRef.current;
  const video = webcamRef.current?.video;
  if (!canvas || !video) return;

  const ctx = canvas.getContext('2d');
  
  // Get actual displayed dimensions (not natural dimensions)
  const displayedWidth = video.offsetWidth;
  const displayedHeight = video.offsetHeight;
  const naturalWidth = video.videoWidth;
  const naturalHeight = video.videoHeight;
  
  // Calculate scale factors
  const scaleX = displayedWidth / naturalWidth;
  const scaleY = displayedHeight / naturalHeight;

  canvas.width = displayedWidth;
  canvas.height = displayedHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach(det => {
    const [x1, y1, x2, y2] = det.bbox;

    if (det.confidence > 0.5) {
      // Scale coordinates to displayed size
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledX2 = x2 * scaleX;
      const scaledY2 = y2 * scaleY;
      const boxWidth = scaledX2 - scaledX1;
      const boxHeight = scaledY2 - scaledY1;

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX1, scaledY1, boxWidth, boxHeight);

      ctx.fillStyle = 'red';
      const text = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = '16px Arial';
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(scaledX1, scaledY1 - 20, textWidth + 10, 20);

      ctx.fillStyle = 'white';
      ctx.fillText(text, scaledX1 + 5, scaledY1 - 5);
    }
  });
}, [detections]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '20px',
      marginTop: '20px'
    }}>
      <div style={{ 
        position: 'relative',
        width: '640px',
        height: '480px'
      }}>
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '8px',
            border: '2px solid #ff5722'
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 'auto',
            pointerEvents: 'none'
          }}
        />
      </div>
      
      <button 
        onClick={toggleDetection}
        style={{
          padding: '12px 24px',
          backgroundColor: isDetecting ? '#dc3545' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background-color 0.3s',
          minWidth: '160px'
        }}
      >
        {isDetecting ? 'Stop Detection' : 'Start Detection'}
      </button>

      {error && (
        <div style={{ color: 'red', textAlign: 'center' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default FireDetector;

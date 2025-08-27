import React, { useRef, useState, useEffect } from 'react';
import Webcam from "react-webcam";

const FireDetector = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const intervalRef = useRef(null);

  // Function to send a frame to the backend
  const detectFrame = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      try {
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');

        // ✅ DEPLOYMENT READY: Environment variable support
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        
        const response = await fetch(`${API_URL}/detect/`, {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        
        // ✅ KEEP ORIGINAL BEHAVIOR: No pre-filtering
        setDetections(data.detections || []);
      } catch (error) {
        console.error("Error calling detection API:", error);
      }
    }
  };

  // Start/Stop detection
  const toggleDetection = () => {
    if (isDetecting) {
      setIsDetecting(false);
      clearInterval(intervalRef.current);
    } else {
      setIsDetecting(true);
      intervalRef.current = setInterval(detectFrame, 500);
    }
  };

  // ✅ Cleanup on component unmount (prevents memory leaks)
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // USE EFFECT TO DRAW BOXES WHEN DETECTIONS CHANGE
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;

      // ✅ ORIGINAL CONFIDENCE THRESHOLD: 0.5 (50%)
      if (det.confidence > 0.5) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        ctx.fillStyle = 'red';
        const text = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
        ctx.font = '16px Arial';
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x1, y1 - 20, textWidth + 10, 20);

        ctx.fillStyle = 'white';
        ctx.fillText(text, x1 + 5, y1 - 5);
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
          style={{
            width: '100%',
            height: '100%',
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
            height: '100%',
            pointerEvents: 'none'
          }}
        />
      </div>
      
      <button 
        onClick={toggleDetection}
        style={{
          padding: '12px 24px',
          backgroundColor: isDetecting ? '#dc3545' : '#16e832ff', // ✅ Your original green
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background-color 0.3s'
        }}
      >
        {isDetecting ? 'Stop Detection' : 'Start Detection'}
      </button>
    </div>
  );
};

export default FireDetector;
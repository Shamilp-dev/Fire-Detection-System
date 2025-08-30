import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from "react-webcam";

const FireDetector = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const requestInProgress = useRef(false);

  // Function to send a frame to the backend - OPTIMIZED
  const detectFrame = useCallback(async () => {
    if (!webcamRef.current || requestInProgress.current) return;

    try {
      requestInProgress.current = true;
      
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      // Convert directly without extra fetch call - OPTIMIZATION
      const base64Data = imageSrc.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());
      
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const API_URL = 'https://shamilpziyad-fire-detection-backend.hf.space';
      
      // Add AbortController for better timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_URL}/detect/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
      if (error.name !== 'AbortError') {
        console.error("Error calling detection API:", error);
        setError(error.message);
      }
    } finally {
      requestInProgress.current = false;
    }
  }, []);

  // Start/Stop detection - OPTIMIZED
  const toggleDetection = useCallback(() => {
    if (isDetecting) {
      setIsDetecting(false);
      clearInterval(intervalRef.current);
      setError(null);
      setDetections([]); // Clear detections when stopping
    } else {
      setIsDetecting(true);
      setError(null);
      // Use requestAnimationFrame for smoother intervals
      let lastCallTime = 0;
      const callDetectFrame = (timestamp) => {
        if (!isDetecting) return;
        
        if (timestamp - lastCallTime > 1000) { // 1 second interval
          lastCallTime = timestamp;
          detectFrame();
        }
        requestAnimationFrame(callDetectFrame);
      };
      requestAnimationFrame(callDetectFrame);
    }
  }, [isDetecting, detectFrame]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Draw bounding boxes - OPTIMIZED with requestAnimationFrame
  useEffect(() => {
    let animationFrameId;
    
    const drawBoundingBoxes = () => {
      const canvas = canvasRef.current;
      const video = webcamRef.current?.video;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      
      // Get actual displayed dimensions
      const displayedWidth = video.offsetWidth;
      const displayedHeight = video.offsetHeight;
      const naturalWidth = video.videoWidth;
      const naturalHeight = video.videoHeight;
      
      const scaleX = displayedWidth / naturalWidth;
      const scaleY = displayedHeight / naturalHeight;

      canvas.width = displayedWidth;
      canvas.height = displayedHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      detections.forEach(det => {
        const [x1, y1, x2, y2] = det.bbox;

        if (det.confidence > 0.5) {
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
      
      animationFrameId = requestAnimationFrame(drawBoundingBoxes);
    };

    drawBoundingBoxes();
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
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
        width: '100%',
        maxWidth: '640px',
        height: 'auto'
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
            height: '100%',
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

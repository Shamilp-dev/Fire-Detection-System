import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from "react-webcam";

const FireDetector = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const intervalRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  const API_URL = process.env.REACT_APP_API_URL || 'https://shamilpziyad-fire-detection-backend.hf.space';

  // ✅ FIX: Enhanced detection function with better error handling
  const detectFrame = useCallback(async () => {
    // Prevent overlapping requests
    if (isProcessing) return;
    
    // ✅ FIX 1: Check if webcam is ready and has video
    if (!webcamRef.current || !webcamRef.current.video || webcamRef.current.video.readyState !== 4) {
      console.log("Webcam not ready, skipping frame");
      return;
    }

    setIsProcessing(true);

    try {
      // ✅ FIX 2: Check video dimensions before capture
      const video = webcamRef.current.video;
      if (!video.videoWidth || !video.videoHeight) {
        console.log("Video dimensions not available");
        setIsProcessing(false);
        return;
      }

      // ✅ FIX 3: Capture screenshot with fallback
      let imageSrc;
      try {
        imageSrc = webcamRef.current.getScreenshot({
          width: 480,
          height: 360,
          quality: 0.7
        });
      } catch (screenshotError) {
        console.error("Screenshot error:", screenshotError);
        setIsProcessing(false);
        return;
      }

      if (!imageSrc) {
        console.log("No image captured, skipping");
        setIsProcessing(false);
        return;
      }

      // Convert base64 to blob
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/detect/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setIsProcessing(false);
        return;
      }
      
      setDetections(data.detections || []);
      setError(null);
      
      // Calculate FPS
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error("Request timeout - backend too slow");
        setError("Request timeout. Backend is slow.");
      } else {
        console.error("Detection error:", error);
        setError(error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, API_URL]);

  // Toggle detection
  const toggleDetection = () => {
    if (isDetecting) {
      setIsDetecting(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setError(null);
      setFps(0);
      frameCountRef.current = 0;
    } else {
      // ✅ FIX 4: Check webcam before starting
      if (!webcamRef.current || !webcamRef.current.video) {
        setError("Webcam not initialized. Please refresh the page.");
        return;
      }
      
      setIsDetecting(true);
      setError(null);
      // 2 FPS (500ms interval) - faster than before
      intervalRef.current = setInterval(detectFrame, 500);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // ✅ FIX 5: Enhanced drawing with better error handling
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) {
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    
    // Use video dimensions
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

    // Draw detections
    detections.forEach(det => {
      if (det.confidence < 0.5) return;

      const [x1, y1, x2, y2] = det.bbox;

      // Scale coordinates
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledX2 = x2 * scaleX;
      const scaledY2 = y2 * scaleY;
      const boxWidth = scaledX2 - scaledX1;
      const boxHeight = scaledY2 - scaledY1;

      // Draw box
      ctx.strokeStyle = det.label === 'fire' ? '#ff0000' : '#ff6600';
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX1, scaledY1, boxWidth, boxHeight);

      // Draw label background
      ctx.fillStyle = ctx.strokeStyle;
      const text = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(scaledX1, scaledY1 - 25, textWidth + 10, 25);

      // Draw label text
      ctx.fillStyle = 'white';
      ctx.fillText(text, scaledX1 + 5, scaledY1 - 7);
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
      {/* Connection status */}
      <div style={{
        padding: '8px 16px',
        borderRadius: '4px',
        backgroundColor: isDetecting ? '#4caf50' : '#757575',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        {isDetecting ? `🟢 Live Detection (${fps} FPS)` : '⚫ Stopped'}
      </div>

      <div style={{ 
        position: 'relative',
        width: '640px',
        height: '480px',
        maxWidth: '100%'
      }}>
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.7}
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
          onUserMediaError={(err) => {
            console.error("Webcam error:", err);
            setError("Camera access denied or unavailable");
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
        
        {/* Processing indicator */}
        {isProcessing && (
          <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(255, 87, 34, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            🔄 Processing...
          </div>
        )}
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
          minWidth: '160px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.9'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
      >
        {isDetecting ? '⏸ Stop Detection' : '▶ Start Detection'}
      </button>

      {/* Error display */}
      {error && (
        <div style={{ 
          color: 'white',
          backgroundColor: '#d32f2f',
          padding: '12px 20px',
          borderRadius: '6px',
          textAlign: 'center',
          maxWidth: '600px',
          fontSize: '14px'
        }}>
          ⚠️ Error: {error}
        </div>
      )}

      {/* Detection info */}
      {detections.length > 0 && (
        <div style={{
          backgroundColor: '#fff3e0',
          border: '2px solid #ff6f00',
          borderRadius: '8px',
          padding: '16px',
          maxWidth: '600px',
          width: '100%'
        }}>
          <div style={{ 
            color: '#e65100',
            fontWeight: 'bold',
            marginBottom: '8px',
            fontSize: '16px'
          }}>
            🔥 {detections.length} Detection(s) Found!
          </div>
          <ul style={{ 
            margin: 0,
            paddingLeft: '20px',
            color: '#bf360c'
          }}>
            {detections.map((det, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>
                <strong>{det.label}</strong> - {(det.confidence * 100).toFixed(1)}% confidence
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FireDetector;

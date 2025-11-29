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
  const [webcamReady, setWebcamReady] = useState(false);
  const intervalRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  const API_URL = process.env.REACT_APP_API_URL || 'https://shamilpziyad-fire-detection-backend.hf.space';

  // Enhanced detection function
  const detectFrame = useCallback(async () => {
    if (isProcessing || !webcamReady) return;
    
    if (!webcamRef.current || !webcamRef.current.video) {
      console.log("Webcam not available");
      return;
    }

    const video = webcamRef.current.video;
    if (video.readyState !== 4 || !video.videoWidth || !video.videoHeight) {
      console.log("Video not ready:", {
        readyState: video.readyState,
        width: video.videoWidth,
        height: video.videoHeight
      });
      return;
    }

    setIsProcessing(true);

    try {
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
        console.log("No image captured");
        setIsProcessing(false);
        return;
      }

      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/detect/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setIsProcessing(false);
        return;
      }
      
      setDetections(data.detections || []);
      setError(null);
      
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error("Request timeout");
        setError("Request timeout. Backend is slow.");
      } else {
        console.error("Detection error:", error);
        setError(error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, webcamReady, API_URL]);

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
      if (!webcamReady) {
        setError("Webcam not ready. Please wait or refresh the page.");
        return;
      }
      
      setIsDetecting(true);
      setError(null);
      intervalRef.current = setInterval(detectFrame, 500); // 2 FPS
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Draw detections on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) {
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha for transparent canvas
    
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
      if (det.confidence < 0.5) return;

      const [x1, y1, x2, y2] = det.bbox;

      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledX2 = x2 * scaleX;
      const scaledY2 = y2 * scaleY;
      const boxWidth = scaledX2 - scaledX1;
      const boxHeight = scaledY2 - scaledY1;

      ctx.strokeStyle = det.label === 'fire' ? '#ff0000' : '#ff6600';
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX1, scaledY1, boxWidth, boxHeight);

      ctx.fillStyle = ctx.strokeStyle;
      const text = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(scaledX1, scaledY1 - 25, textWidth + 10, 25);

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
      {/* Status indicator */}
      <div style={{
        padding: '8px 16px',
        borderRadius: '4px',
        backgroundColor: isDetecting ? '#4caf50' : webcamReady ? '#757575' : '#ff9800',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        {!webcamReady && '🟠 Loading Camera...'}
        {webcamReady && !isDetecting && '⚫ Stopped'}
        {webcamReady && isDetecting && `🟢 Live Detection (${fps} FPS)`}
      </div>

      <div style={{ 
        position: 'relative',
        width: '640px',
        maxWidth: '100%',
        aspectRatio: '4/3',
        backgroundColor: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '2px solid #ff5722'
      }}>
        {/* Webcam component */}
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
          onUserMedia={() => {
            console.log("Webcam stream started");
            setWebcamReady(true);
            setError(null);
          }}
          onUserMediaError={(err) => {
            console.error("Webcam error:", err);
            setError("Camera access denied or unavailable");
            setWebcamReady(false);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1
          }}
        />
        
        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 2
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
            fontWeight: 'bold',
            zIndex: 3
          }}>
            🔄 Processing...
          </div>
        )}
      </div>
      
      <button 
        onClick={toggleDetection}
        disabled={!webcamReady}
        style={{
          padding: '12px 24px',
          backgroundColor: !webcamReady ? '#9e9e9e' : (isDetecting ? '#dc3545' : '#28a745'),
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: webcamReady ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.3s',
          minWidth: '160px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          opacity: webcamReady ? 1 : 0.6
        }}
        onMouseEnter={(e) => {
          if (webcamReady) e.target.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          if (webcamReady) e.target.style.opacity = '1';
        }}
      >
        {!webcamReady && '⏳ Loading Camera...'}
        {webcamReady && (isDetecting ? '⏸ Stop Detection' : '▶ Start Detection')}
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

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
  const [captureSize, setCaptureSize] = useState({ width: 480, height: 360 }); // Track capture dimensions
  const intervalRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  const API_URL = process.env.REACT_APP_API_URL || 'https://shamilpziyad-fire-detection-backend.hf.space';

  const detectFrame = useCallback(async () => {
    if (isProcessing || !webcamReady) return;
    
    if (!webcamRef.current || !webcamRef.current.video) return;

    const video = webcamRef.current.video;
    if (video.readyState !== 4 || !video.videoWidth || !video.videoHeight) return;

    setIsProcessing(true);

    try {
      // ✅ FIX 1: Capture at reduced resolution
      const captureWidth = 480;
      const captureHeight = 360;
      
      const imageSrc = webcamRef.current.getScreenshot({
        width: captureWidth,
        height: captureHeight,
        quality: 0.7
      });

      if (!imageSrc) {
        setIsProcessing(false);
        return;
      }

      // Store capture size for coordinate scaling
      setCaptureSize({ width: captureWidth, height: captureHeight });

      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced timeout

      const response = await fetch(`${API_URL}/detect/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      console.log('Detection response:', data); // Debug log
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
      console.error("Detection error:", error);
      setError(error.message);
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
      setFps(0);
      frameCountRef.current = 0;
      setDetections([]); // Clear detections
    } else {
      if (!webcamReady) {
        setError("Webcam not ready");
        return;
      }
      setIsDetecting(true);
      setError(null);
      // ✅ FIX 2: Trigger detection immediately, then every 500ms
      detectFrame();
      intervalRef.current = setInterval(detectFrame, 500);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ✅ FIX 3: Correct coordinate scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    const ctx = canvas.getContext('2d');
    
    // Display dimensions (what user sees)
    const displayWidth = video.offsetWidth;
    const displayHeight = video.offsetHeight;
    
    // Capture dimensions (what was sent to API)
    const { width: captureWidth, height: captureHeight } = captureSize;
    
    // ✅ CRITICAL: Scale from capture size to display size
    const scaleX = displayWidth / captureWidth;
    const scaleY = displayHeight / captureHeight;
    
    console.log('Scaling:', { 
      displayWidth, 
      displayHeight, 
      captureWidth, 
      captureHeight, 
      scaleX, 
      scaleY 
    });

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(det => {
      if (det.confidence < 0.5) return;

      const [x1, y1, x2, y2] = det.bbox;
      
      console.log('Original bbox:', det.bbox);
      
      // Scale coordinates from capture size to display size
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledX2 = x2 * scaleX;
      const scaledY2 = y2 * scaleY;
      const boxWidth = scaledX2 - scaledX1;
      const boxHeight = scaledY2 - scaledY1;
      
      console.log('Scaled bbox:', { scaledX1, scaledY1, scaledX2, scaledY2 });

      // Draw bounding box
      ctx.strokeStyle = det.label === 'fire' ? '#ff0000' : '#ff6600';
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX1, scaledY1, boxWidth, boxHeight);
      
      // Draw label
      ctx.fillStyle = ctx.strokeStyle;
      const text = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(scaledX1, scaledY1 - 25, textWidth + 10, 25);
      ctx.fillStyle = 'white';
      ctx.fillText(text, scaledX1 + 5, scaledY1 - 7);
    });
  }, [detections, captureSize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
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

      <div style={{ position: 'relative', width: '640px', maxWidth: '100%', aspectRatio: '4/3', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', border: '2px solid #ff5722' }}>
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
            console.log("✅ Webcam ready");
            setWebcamReady(true);
          }}
          onUserMediaError={(err) => {
            console.error("❌ Webcam error:", err);
            setError("Camera access denied");
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
          minWidth: '160px',
          opacity: webcamReady ? 1 : 0.6
        }}
      >
        {!webcamReady && '⏳ Loading...'}
        {webcamReady && (isDetecting ? '⏸ Stop' : '▶ Start')}
      </button>

      {error && (
        <div style={{ 
          color: 'white', 
          backgroundColor: '#d32f2f', 
          padding: '12px 20px', 
          borderRadius: '6px', 
          fontSize: '14px' 
        }}>
          ⚠️ {error}
        </div>
      )}

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
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#bf360c' }}>
            {detections.map((det, i) => (
              <li key={i}>
                <strong>{det.label}</strong> - {(det.confidence * 100).toFixed(1)}% confidence
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && detections.length > 0 && (
        <div style={{ 
          fontSize: '12px', 
          color: '#666', 
          fontFamily: 'monospace',
          backgroundColor: '#f5f5f5',
          padding: '8px',
          borderRadius: '4px',
          maxWidth: '600px',
          width: '100%'
        }}>
          Debug: Capture {captureSize.width}x{captureSize.height} 
          | Display {webcamRef.current?.video?.offsetWidth}x{webcamRef.current?.video?.offsetHeight}
        </div>
      )}
    </div>
  );
};

export default FireDetector;

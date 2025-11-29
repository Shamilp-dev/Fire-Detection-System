import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from "react-webcam";
import { Box, Button, Chip, Card, CardContent, Typography, Alert } from '@mui/material';
import { PlayArrow, Stop, Videocam, Warning } from '@mui/icons-material';

const FireDetector = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const [webcamReady, setWebcamReady] = useState(false);
  const [captureSize, setCaptureSize] = useState({ width: 480, height: 360 });
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

      setCaptureSize({ width: captureWidth, height: captureHeight });

      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${API_URL}/detect/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
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
      setDetections([]);
    } else {
      if (!webcamReady) {
        setError("Webcam not ready");
        return;
      }
      setIsDetecting(true);
      setError(null);
      detectFrame();
      intervalRef.current = setInterval(detectFrame, 500);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    const ctx = canvas.getContext('2d');
    
    const displayWidth = video.offsetWidth;
    const displayHeight = video.offsetHeight;
    const { width: captureWidth, height: captureHeight } = captureSize;
    
    const scaleX = displayWidth / captureWidth;
    const scaleY = displayHeight / captureHeight;

    canvas.width = displayWidth;
    canvas.height = displayHeight;
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

      // Animated glow effect
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = det.label === 'fire' ? '#ff0000' : '#ff6600';
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX1, scaledY1, boxWidth, boxHeight);
      
      // Reset shadow for text
      ctx.shadowBlur = 0;
      
      // Label background with gradient
      const gradient = ctx.createLinearGradient(scaledX1, scaledY1 - 30, scaledX1, scaledY1);
      gradient.addColorStop(0, '#ff0000');
      gradient.addColorStop(1, '#ff6600');
      ctx.fillStyle = gradient;
      
      const text = `${det.label.toUpperCase()} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(scaledX1, scaledY1 - 30, textWidth + 16, 30);
      
      ctx.fillStyle = 'white';
      ctx.fillText(text, scaledX1 + 8, scaledY1 - 8);
    });
  }, [detections, captureSize]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 3
    }}>
      {/* Status Chip */}
      <Chip
        icon={<Videocam />}
        label={
          !webcamReady ? 'Initializing Camera...' :
          isDetecting ? `Live • ${fps} FPS` :
          'Ready'
        }
        color={
          !webcamReady ? 'warning' :
          isDetecting ? 'success' :
          'default'
        }
        sx={{ 
          fontSize: '1rem',
          fontWeight: 600,
          px: 2,
          py: 2.5,
          height: 'auto'
        }}
      />

      {/* Video Container */}
      <Card sx={{ 
        width: '100%',
        maxWidth: '800px',
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        border: isDetecting ? '3px solid #4caf50' : '3px solid #ddd'
      }}>
        <Box sx={{ 
          position: 'relative',
          aspectRatio: '4/3',
          backgroundColor: '#000'
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
              objectFit: 'cover'
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
          
          {/* Processing Badge */}
          {isProcessing && (
            <Chip
              label="Analyzing..."
              size="small"
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 3,
                backgroundColor: 'rgba(255, 87, 34, 0.95)',
                color: 'white',
                fontWeight: 600,
                animation: 'pulse 1.5s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 }
                }
              }}
            />
          )}
        </Box>
      </Card>
      
      {/* Control Button */}
      <Button
        onClick={toggleDetection}
        disabled={!webcamReady}
        variant="contained"
        size="large"
        startIcon={isDetecting ? <Stop /> : <PlayArrow />}
        sx={{
          px: 5,
          py: 1.5,
          fontSize: '1.1rem',
          fontWeight: 600,
          borderRadius: 3,
          textTransform: 'none',
          minWidth: 200,
          background: !webcamReady 
            ? '#bdbdbd'
            : isDetecting 
              ? 'linear-gradient(90deg, #f44336 0%, #e91e63 100%)'
              : 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          '&:hover': {
            transform: webcamReady ? 'translateY(-2px)' : 'none',
            boxShadow: webcamReady ? '0 6px 20px rgba(0,0,0,0.3)' : '0 4px 15px rgba(0,0,0,0.2)'
          },
          '&:disabled': {
            background: '#bdbdbd',
            color: 'white'
          },
          transition: 'all 0.3s ease'
        }}
      >
        {!webcamReady && 'Loading...'}
        {webcamReady && (isDetecting ? 'Stop Detection' : 'Start Detection')}
      </Button>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            width: '100%',
            maxWidth: '800px',
            borderRadius: 2
          }}
        >
          {error}
        </Alert>
      )}

      {/* Detection Results */}
      {detections.length > 0 && (
        <Card sx={{ 
          width: '100%',
          maxWidth: '800px',
          borderRadius: 3,
          border: '2px solid #ff6b35',
          backgroundColor: '#fff3e0'
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Warning sx={{ color: '#ff6b35', fontSize: 28 }} />
              <Typography 
                variant="h6"
                sx={{ 
                  color: '#e65100',
                  fontWeight: 700
                }}
              >
                {detections.length} Fire Detection{detections.length > 1 ? 's' : ''} Found!
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {detections.map((det, i) => (
                <Alert 
                  key={i}
                  severity="warning"
                  sx={{ 
                    borderRadius: 2,
                    fontWeight: 500
                  }}
                >
                  <strong>{det.label.toUpperCase()}</strong> - {(det.confidence * 100).toFixed(1)}% confidence
                </Alert>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default FireDetector;

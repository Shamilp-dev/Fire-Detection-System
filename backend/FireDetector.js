import React, { useRef, useCallback, useState } from 'react';
import Webcam from "react-webcam";

const FireDetector = () => {
  const webcamRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const intervalRef = useRef(null);

  // Function to send a frame to the backend
  const detectFrame = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      // Convert base64 image to a blob for sending
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      try {
        const response = await fetch('http://localhost:8000/detect/', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        setDetections(data.detections || []);
      } catch (error) {
        console.error("Error calling detection API:", error);
      }
    }
  }, []);

  // Start/Stop detection
  const toggleDetection = () => {
    if (isDetecting) {
      setIsDetecting(false);
      clearInterval(intervalRef.current);
    } else {
      setIsDetecting(true);
      // Send a frame for detection every 500ms (adjust as needed)
      intervalRef.current = setInterval(detectFrame, 500);
    }
  };

  // Function to draw bounding boxes on the video feed
  const drawBoxes = (canvas) => {
    if (!canvas || !webcamRef.current?.video) return;

    const video = webcamRef.current.video;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      
      // Draw rectangle
      ctx.strokeStyle = det.label === 'fire' ? 'red' : 'yellow';
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      
      // Draw label background
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '16px Arial';
      const text = `${det.label} (${(det.confidence * 100).toFixed(1)}%)`;
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(x1, y1 - 20, textWidth + 5, 20);
      
      // Draw label text
      ctx.fillStyle = 'white';
      ctx.fillText(text, x1, y1 - 5);
    });
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Web-Based Fire Detection</h1>
      <button onClick={toggleDetection} style={{ padding: '10px 20px', margin: '10px' }}>
        {isDetecting ? 'Stop Detection' : 'Start Detection'}
      </button>
      <div style={{ position: 'relative' }}>
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
        <canvas
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
          ref={drawBoxes} // This is a simplification. For a real implementation, use a useRef for the canvas and a useEffect hook that calls drawBoxes whenever `detections` changes.
        />
      </div>
      <ul>
        {detections.map((det, i) => (
          <li key={i}>
            {det.label} detected with {Math.round(det.confidence * 100)}% confidence.
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FireDetector;
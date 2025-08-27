import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress
} from '@mui/material';
import { CameraAlt, CloudUpload } from '@mui/icons-material';
import FireDetector from './FireDetector';

const HomePage = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadDetections, setUploadDetections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setSelectedImage(null);
    setUploadDetections(null);
    setError(null);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setUploadDetections(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const detectUploadedImage = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);

    try {
      // Convert base64 to blob
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('file', blob, 'uploaded-image.jpg');

      const detectionResponse = await fetch('http://localhost:8000/detect/', {
        method: 'POST',
        body: formData,
      });

      if (!detectionResponse.ok) {
        throw new Error('Detection failed');
      }

      const data = await detectionResponse.json();
      setUploadDetections(data.detections);
    } catch (error) {
      setError('Failed to detect fire in the image. Please try again.');
      console.error('Detection error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4, minHeight: '80vh' }}>
      <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', mb: 4 }}>
        Fire Detection System
      </Typography>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} centered sx={{ mb: 3 }}>
          <Tab icon={<CameraAlt />} label="Webcam Detection" />
          <Tab icon={<CloudUpload />} label="Upload Image" />
        </Tabs>

        {tabValue === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom align="center">
              Real-time Fire Detection using Webcam
            </Typography>
            <FireDetector />
          </Box>
        )}

        {tabValue === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom align="center">
              Upload an Image for Fire Detection
              <h6>Disclaimer : confidence greater than 50 - Desired Fire Output</h6>
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUpload />}
                sx={{ mb: 2 }}
              >
                Upload Image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </Button>

              {error && (
                <Alert severity="error" sx={{ width: '100%', maxWidth: '400px' }}>
                  {error}
                </Alert>
              )}

              {selectedImage && (
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={selectedImage}
                    alt="Uploaded"
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '400px', 
                      border: '2px solid #ff5722', 
                      borderRadius: '8px',
                      marginBottom: '20px'
                    }}
                  />
                  <Button
                    variant="contained"
                    sx={{ mt: 5 }}
                    style={{
                      alignItems: 'center',
                      display: 'flex', 
                      flexDirection: 'column'
                    }}
                    onClick={detectUploadedImage}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                  >
                    {loading ? 'Detecting...' : 'Detect Fire'}
                  </Button>
                </Box>
              )}

              {uploadDetections && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Detection Results:
                  </Typography>
                  {uploadDetections.length === 0 ? (
                    <Alert severity="info">No fire detected in this image.</Alert>
                  ) : (
                    uploadDetections.map((det, index) => (
                      <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                        {det.label} detected with {(det.confidence * 100).toFixed(1)}% confidence
                      </Alert>
                    ))
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default HomePage;
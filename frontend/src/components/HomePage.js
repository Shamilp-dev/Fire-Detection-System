import React, { useState, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material';
import { CameraAlt, CloudUpload, Whatshot } from '@mui/icons-material';
import FireDetector from './FireDetector';

const HomePage = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadDetections, setUploadDetections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'https://shamilpziyad-fire-detection-backend.hf.space';

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setSelectedImage(null);
    setUploadDetections(null);
    setError(null);
  };

  const handleImageUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Image too large. Maximum size: 10MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file (JPG, PNG, JPEG)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setUploadDetections(null);
        setError(null);
      };
      reader.onerror = () => {
        setError('Failed to read image file');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const detectUploadedImage = useCallback(async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('file', blob, 'uploaded-image.jpg');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const detectionResponse = await fetch(`${API_URL}/detect/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!detectionResponse.ok) {
        throw new Error(`Detection failed: ${detectionResponse.status} ${detectionResponse.statusText}`);
      }

      const data = await detectionResponse.json();
      setUploadDetections(data.detections || []);
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('Request timeout. Backend is taking too long. Please try again.');
      } else {
        setError(`Failed to detect fire: ${error.message}`);
      }
      console.error('Detection error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedImage, API_URL]);

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      py: 6
    }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Whatshot sx={{ fontSize: 80, color: '#ff6b35', mb: 2 }} />
          <Typography 
            variant="h2" 
            component="h1"
            sx={{ 
              fontWeight: 800,
              color: 'white',
              mb: 1,
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              fontSize: { xs: '2.5rem', md: '3.5rem' }
            }}
          >
            Fire Detection System
          </Typography>
          <Typography 
            variant="h6"
            sx={{ 
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 400,
              mb: 1
            }}
          >
            AI-Powered Real-Time Fire Detection
          </Typography>
        </Box>

        {/* Main Content Card */}
        <Card sx={{ 
          borderRadius: 4,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            background: 'linear-gradient(90deg, #ff6b35 0%, #f7931e 100%)',
            p: 0.5
          }} />
          
          <CardContent sx={{ p: 4 }}>
            {/* Tabs */}
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              centered
              sx={{ 
                mb: 4,
                '& .MuiTab-root': {
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  minHeight: 60
                },
                '& .Mui-selected': {
                  color: '#ff6b35'
                }
              }}
            >
              <Tab 
                icon={<CameraAlt sx={{ fontSize: 28 }} />} 
                label="Live Webcam" 
                iconPosition="start"
              />
              <Tab 
                icon={<CloudUpload sx={{ fontSize: 28 }} />} 
                label="Upload Image" 
                iconPosition="start"
              />
            </Tabs>

            {/* Webcam Tab */}
            {tabValue === 0 && (
              <Box>
                <Typography 
                  variant="h5" 
                  gutterBottom 
                  align="center"
                  sx={{ fontWeight: 600, mb: 3, color: '#333' }}
                >
                  Real-time Detection
                </Typography>
                <FireDetector />
              </Box>
            )}

            {/* Upload Tab */}
            {tabValue === 1 && (
              <Box>
                <Typography 
                  variant="h5" 
                  gutterBottom 
                  align="center"
                  sx={{ fontWeight: 600, mb: 2, color: '#333' }}
                >
                  Upload & Detect
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  align="center" 
                  sx={{ mb: 4 }}
                >
                  Support JPG, PNG, JPEG • Max 10MB
                </Typography>
                
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: 3 
                }}>
                  {/* Upload Button */}
                  <Button
                    variant="contained"
                    component="label"
                    startIcon={<CloudUpload />}
                    sx={{ 
                      py: 1.5,
                      px: 4,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 3,
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                      textTransform: 'none',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Choose Image
                    <input
                      type="file"
                      hidden
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleImageUpload}
                    />
                  </Button>

                  {/* Error Alert */}
                  {error && (
                    <Alert 
                      severity="error" 
                      sx={{ 
                        width: '100%', 
                        maxWidth: '600px',
                        borderRadius: 2,
                        fontSize: '0.95rem'
                      }}
                    >
                      {error}
                    </Alert>
                  )}

                  {/* Image Preview & Detection */}
                  {selectedImage && (
                    <Paper 
                      elevation={3}
                      sx={{ 
                        p: 3, 
                        width: '100%', 
                        maxWidth: '700px',
                        borderRadius: 3
                      }}
                    >
                      <img
                        src={selectedImage}
                        alt="Uploaded"
                        style={{ 
                          width: '100%',
                          maxHeight: '500px',
                          borderRadius: '12px',
                          border: '3px solid #ff6b35',
                          objectFit: 'contain',
                          marginBottom: '20px',
                          display: 'block'
                        }}
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={detectUploadedImage}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Whatshot />}
                        sx={{
                          py: 2,
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          borderRadius: 2,
                          background: loading 
                            ? '#ccc' 
                            : 'linear-gradient(90deg, #ff6b35 0%, #f7931e 100%)',
                          textTransform: 'none',
                          boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)',
                          '&:hover': {
                            background: 'linear-gradient(90deg, #f7931e 0%, #ff6b35 100%)',
                            boxShadow: '0 6px 20px rgba(255, 107, 53, 0.6)'
                          }
                        }}
                      >
                        {loading ? 'Analyzing...' : 'Detect Fire'}
                      </Button>
                    </Paper>
                  )}

                  {/* Detection Results */}
                  {uploadDetections && (
                    <Paper 
                      elevation={3}
                      sx={{ 
                        p: 3, 
                        width: '100%', 
                        maxWidth: '700px',
                        borderRadius: 3
                      }}
                    >
                      <Typography 
                        variant="h6" 
                        gutterBottom
                        sx={{ fontWeight: 600, mb: 2 }}
                      >
                        Detection Results
                      </Typography>
                      {uploadDetections.length === 0 ? (
                        <Alert 
                          severity="success"
                          sx={{ 
                            borderRadius: 2,
                            fontSize: '1rem',
                            fontWeight: 500
                          }}
                        >
                          ✅ No fire detected - Image is safe!
                        </Alert>
                      ) : (
                        <Box>
                          <Alert 
                            severity="warning" 
                            sx={{ 
                              mb: 2,
                              borderRadius: 2,
                              fontSize: '1rem',
                              fontWeight: 600
                            }}
                          >
                            🔥 {uploadDetections.length} fire detection(s) found!
                          </Alert>
                          {uploadDetections.map((det, index) => (
                            <Alert 
                              key={index} 
                              severity="error" 
                              sx={{ 
                                mb: 1.5,
                                borderRadius: 2,
                                fontSize: '0.95rem'
                              }}
                            >
                              <strong>{det.label.toUpperCase()}</strong> detected with{' '}
                              <strong>{(det.confidence * 100).toFixed(1)}%</strong> confidence
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </Paper>
                  )}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <Typography 
          align="center" 
          sx={{ 
            mt: 4, 
            color: 'rgba(255,255,255,0.8)',
            fontSize: '0.9rem'
          }}
        >
          Powered by YOLOv8 • Built with React & FastAPI
        </Typography>
      </Container>
    </Box>
  );
};

export default HomePage;

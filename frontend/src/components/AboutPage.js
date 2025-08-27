import React from 'react';
import { Container, Paper, Typography, Box, Chip } from '@mui/material';

const AboutPage = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', mb: 4 }}>
          About FireWatch AI
        </Typography>
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom color="primary">
          Our Mission
          </Typography>
          <Typography variant="body1" paragraph>
            FireWatch AI is an innovative web application designed to detect fire and smoke in real-time 
            using advanced artificial intelligence. Our goal is to provide an accessible early warning 
            system that can help prevent fire-related accidents.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom color="primary">
          How It Works
          </Typography>
          <Typography variant="body1" paragraph>
            The system uses a YOLOv8 machine learning model trained on thousands of fire and smoke images. 
            The web application captures video feed from your webcam or analyzes uploaded images, 
            and the AI model processes the frames to detect potential fire hazards with high accuracy.
          </Typography>
        </Box>

        <Box>
          <Typography variant="h5" gutterBottom color="primary">
          Technology Stack
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip label="React.js" color="primary" />
            <Chip label="FastAPI" color="primary" />
            <Chip label="PyTorch" color="primary" />
            <Chip label="YOLOv8" color="primary" />
            <Chip label="Material-UI" color="primary" />
            <Chip label="OpenCV" color="primary" />
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default AboutPage;
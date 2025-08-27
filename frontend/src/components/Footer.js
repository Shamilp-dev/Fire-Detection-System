import React from 'react';
import { Box, Container, Typography, IconButton } from '@mui/material';
import { GitHub, LinkedIn, Email } from '@mui/icons-material';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: '#1e1e1e',
        color: 'white',
        py: 3,
        mt: 'auto'
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          {/* Social Links */}
          <Box>
            <IconButton
              color="inherit"
              href="https://github.com/yourusername"
              target="_blank"
              sx={{ mx: 1 }}
            >
              <GitHub />
            </IconButton>
            <IconButton
              color="inherit"
              href="https://linkedin.com/in/yourusername"
              target="_blank"
              sx={{ mx: 1 }}
            >
              <LinkedIn />
            </IconButton>
            <IconButton
              color="inherit"
              href="mailto:shamilziyad@email.com"
              sx={{ mx: 1 }}
            >
              <Email />
            </IconButton>
          </Box>

          {/* Copyright */}
          <Typography variant="body2" align="center">
            © {new Date().getFullYear()} Shamil Ziyad. All rights reserved.
          </Typography>

          {/* Additional Info */}
          <Typography variant="body2" align="center" color="gray">
            Built with React, FastAPI, and YOLOv8
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
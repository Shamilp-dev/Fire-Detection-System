import React from 'react';
import { Container, Paper, Typography, Box, Link } from '@mui/material';

const ContactPage = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', mb: 4 }}>
        Contact Us
        </Typography>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" paragraph>
          Have questions or want to learn more about our fire detection technology?
          </Typography>
          
          <Typography variant="body1" paragraph>
           Email: <Link href="mailto:shamilpofficial@gmail.com">shamilpofficial@gmail.com</Link>
          </Typography>
          
          <Typography variant="body1" paragraph>
          Website: <Link href="https://shamilpdev.netlify.app" target="_blank">https://shamilpdev.netlify.app</Link>
          </Typography>
          
          <Typography variant="body1" paragraph>
          LinkedIn: <Link href="https://linkedin.com/in/shamilpziyad" target="_blank">Shamil p Ziyad</Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default ContactPage;
import React from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import Game from './components/Game';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  font-family: 'Inter', sans-serif;
`;

const Header = styled(motion.header)`
  padding: 2rem;
  text-align: center;
`;

const Title = styled(motion.h1)`
  font-size: 3rem;
  margin: 0;
  background: linear-gradient(45deg, #87CEEB, #4CAF50);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Subtitle = styled(motion.p)`
  font-size: 1.2rem;
  color: #a0a0a0;
  margin-top: 1rem;
`;

const Footer = styled(motion.footer)`
  padding: 1rem;
  text-align: center;
  color: #a0a0a0;
  font-size: 0.9rem;
`;

const App = () => {
  return (
    <AppContainer>
      <Header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Title
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Shape Escape
        </Title>
        <Subtitle
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Navigate through the shapes and reach the exit
        </Subtitle>
      </Header>

      <Game />

      <Footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        Use arrow keys or WASD to move. Touch controls available on mobile.
      </Footer>
    </AppContainer>
  );
};

export default App; 
import React, { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEngine } from '../game/GameEngine';

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  font-family: 'Inter', sans-serif;
  position: fixed;
  top: 0;
  left: 0;
`;

const GameTitle = styled(motion.h1)`
  font-size: 3.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(45deg, #87CEEB, #B0E0E6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 20px rgba(135, 206, 235, 0.3);
  letter-spacing: 2px;
`;

const GameSubtitle = styled(motion.p)`
  font-size: 1.2rem;
  color: #B0E0E6;
  margin: 10px 0 30px;
  opacity: 0.8;
`;

const GameCanvas = styled.canvas`
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  background: white;
  margin: 20px;
  width: 800px;
  height: 600px;
`;

const GameInfo = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
`;

const InfoCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 15px 30px;
  border-radius: 15px;
  font-size: 1.2rem;
  font-weight: 500;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
`;

const GameOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
`;

const GameMessage = styled(motion.div)`
  background: rgba(255, 255, 255, 0.9);
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  color: #1a1a2e;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
`;

const LevelTransition = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 46, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2rem;
  font-weight: bold;
  z-index: 1000;
`;

const Button = styled(motion.button)`
  background: linear-gradient(45deg, #4CAF50, #45a049);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  
  &:hover {
    background: linear-gradient(45deg, #45a049, #4CAF50);
  }
`;

const RestartButton = styled(motion.button)`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.2);
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
  }
`;

const Game = () => {
  const canvasRef = useRef(null);
  const gameEngineRef = useRef(null);
  const [gameState, setGameState] = useState({
    level: 1,
    gameOver: false,
    isTransitioning: false
  });

  const initializeGame = (level) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const callbacks = {
      onLevelChange: (newLevel) => {
        setGameState(prev => ({ ...prev, level: newLevel, isTransitioning: true }));
        // Hide transition after 1.5 seconds
        setTimeout(() => {
          setGameState(prev => ({ ...prev, isTransitioning: false }));
        }, 1500);
      },
      onGameOver: () => setGameState(prev => ({ ...prev, gameOver: true })),
      onSuccess: () => {
        // Automatically progress to next level
        const nextLevel = gameState.level + 1;
        setGameState(prev => ({ 
          ...prev, 
          level: nextLevel, 
          isTransitioning: true 
        }));
        if (gameEngineRef.current) {
          gameEngineRef.current.nextLevel();
        }
        // Hide transition after 1.5 seconds
        setTimeout(() => {
          setGameState(prev => ({ ...prev, isTransitioning: false }));
        }, 1500);
      }
    };

    if (gameEngineRef.current) {
      gameEngineRef.current.cleanup();
    }
    gameEngineRef.current = new GameEngine(canvas, callbacks);
    gameEngineRef.current.level = level;
  };

  useEffect(() => {
    initializeGame(1);
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.cleanup();
      }
    };
  }, []);

  const handleRestart = () => {
    // Only handle game over restart
    setGameState(prev => ({ ...prev, gameOver: false }));
    if (gameEngineRef.current) {
      gameEngineRef.current.resetLevel();
    }
  };

  const handleFullRestart = () => {
    // Reset game to level 1
    setGameState({
      level: 1,
      gameOver: false,
      isTransitioning: true
    });
    initializeGame(1);
    // Hide transition after 1.5 seconds
    setTimeout(() => {
      setGameState(prev => ({ ...prev, isTransitioning: false }));
    }, 1500);
  };

  return (
    <GameContainer>
      <RestartButton
        onClick={handleFullRestart}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Restart Game
      </RestartButton>

      <GameTitle
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        Life Escape
      </GameTitle>
      <GameSubtitle
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        Navigate through the shapes to reach the exit
      </GameSubtitle>

      <GameInfo>
        <InfoCard
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Level: {gameState.level}
        </InfoCard>
      </GameInfo>
      
      <GameCanvas ref={canvasRef} width={800} height={600} />

      <AnimatePresence>
        {gameState.gameOver && (
          <GameOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GameMessage
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2>Game Over</h2>
              <p>Try again!</p>
              <Button
                onClick={handleRestart}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Restart
              </Button>
            </GameMessage>
          </GameOverlay>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState.isTransitioning && (
          <LevelTransition
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              Level {gameState.level}
            </motion.div>
          </LevelTransition>
        )}
      </AnimatePresence>
    </GameContainer>
  );
};

export default Game; 
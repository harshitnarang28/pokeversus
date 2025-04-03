import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Button, Flex, Image, Text, Stack, Heading, Progress, Badge, useToast } from '@chakra-ui/react';
import { Pokemon } from '../types/pokemon';
import { motion, AnimatePresence } from 'framer-motion';

const MotionBox = motion(Box);

// Cache for Pokemon data
const pokemonCache = new Map<number, Pokemon>();

const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first battle!', requirement: 1 },
  { id: 'beginner', name: 'Beginner Trainer', description: 'Win 5 battles in a row!', requirement: 5 },
  { id: 'intermediate', name: 'Intermediate Trainer', description: 'Win 10 battles in a row!', requirement: 10 },
  { id: 'advanced', name: 'Advanced Trainer', description: 'Win 20 battles in a row!', requirement: 20 },
  { id: 'master', name: 'Pokemon Master', description: 'Win 50 battles in a row!', requirement: 50 },
];

interface GameState {
  pokemon1: Pokemon | null;
  pokemon2: Pokemon | null;
  userChoice: number | null;
  streak: number;
  highScore: number;
  isLoading: boolean;
  result: 'correct' | 'wrong' | null;
  achievements: string[];
  gameStatus: 'start' | 'playing' | 'gameOver';
  difficulty: 'easy' | 'hard';
  cooldown: number;
}

const PokemonBattle = () => {
  const toast = useToast();
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedHighScore = localStorage.getItem('pokemonHighScore');
    return {
      pokemon1: null,
      pokemon2: null,
      userChoice: null,
      streak: 0,
      highScore: savedHighScore ? parseInt(savedHighScore) : 0,
      isLoading: false,
      result: null,
      achievements: [],
      gameStatus: 'start',
      difficulty: 'easy',
      cooldown: 0
    };
  });

  // Pre-fetch and cache Pokemon data
  useEffect(() => {
    const preFetchPokemon = async () => {
      const ids = Array.from({ length: 20 }, () => Math.floor(Math.random() * 898) + 1);
      for (const id of ids) {
        if (!pokemonCache.has(id)) {
          try {
            const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
            pokemonCache.set(id, response.data);
          } catch (error) {
            console.error('Error pre-fetching Pokemon:', error);
          }
        }
      }
    };

    if (gameState.gameStatus === 'start') {
      preFetchPokemon();
    }
  }, [gameState.gameStatus]);

  // Update high score when streak changes
  useEffect(() => {
    if (gameState.streak > gameState.highScore) {
      setGameState(prev => ({ ...prev, highScore: prev.streak }));
      localStorage.setItem('pokemonHighScore', gameState.streak.toString());
    }
  }, [gameState.streak]);

  // Cooldown timer effect
  useEffect(() => {
    if (gameState.cooldown > 0) {
      const timer = setInterval(() => {
        setGameState(prev => ({ ...prev, cooldown: prev.cooldown - 1 }));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState.cooldown]);

  const calculateTotalStats = (pokemon: Pokemon): number => {
    return pokemon.stats.reduce((sum, stat) => sum + stat.base_stat, 0);
  };

  const isSimilarStats = (p1: Pokemon, p2: Pokemon): boolean => {
    const p1Total = calculateTotalStats(p1);
    const p2Total = calculateTotalStats(p2);
    const difference = Math.abs(p1Total - p2Total);
    // Allow a difference of up to 50 points (about 10% of average total stats)
    return difference <= 50;
  };

  const fetchRandomPokemon = useCallback(async (excludePokemon?: Pokemon) => {
    try {
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        const id = Math.floor(Math.random() * 898) + 1;
        
        // Check cache first
        if (pokemonCache.has(id)) {
          const pokemon = pokemonCache.get(id)!;
          if (!excludePokemon || (gameState.difficulty === 'hard' && isSimilarStats(pokemon, excludePokemon))) {
            return pokemon;
          }
        }

        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const pokemon = response.data;
        
        // Cache the Pokemon data
        pokemonCache.set(id, pokemon);
        
        if (!excludePokemon || (gameState.difficulty === 'hard' && isSimilarStats(pokemon, excludePokemon))) {
          return pokemon;
        }
        
        attempts++;
      }
      
      // If we couldn't find a similar Pokemon after max attempts, return the last one we found
      const lastId = Math.floor(Math.random() * 898) + 1;
      const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${lastId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching Pokemon:', error);
      return null;
    }
  }, [gameState.difficulty]);

  const loadNewBattle = useCallback(async () => {
    // Set loading state first
    setGameState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Fetch both Pokemon
      const pokemon1 = await fetchRandomPokemon();
      const pokemon2 = await fetchRandomPokemon(pokemon1);
      
      if (pokemon1 && pokemon2) {
        // Update state only once with new Pokemon
        setGameState(prev => ({
          ...prev,
          pokemon1,
          pokemon2,
          isLoading: false,
          result: null,
          userChoice: null,
          cooldown: 0
        }));
      }
    } catch (error) {
      console.error('Error loading battle:', error);
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  }, [fetchRandomPokemon]);

  const calculateWinner = (p1: Pokemon, p2: Pokemon): number => {
    const p1Power = calculateTotalStats(p1);
    const p2Power = calculateTotalStats(p2);
    return p1Power >= p2Power ? 1 : 2;
  };

  const startGame = (difficulty: 'easy' | 'hard') => {
    setGameState(prev => ({ ...prev, gameStatus: 'playing', streak: 0, difficulty }));
    loadNewBattle();
  };

  const handleChoice = (choice: number) => {
    if (!gameState.pokemon1 || !gameState.pokemon2 || gameState.cooldown > 0) return;

    const winner = calculateWinner(gameState.pokemon1, gameState.pokemon2);
    const isCorrect = choice === winner;
    const winningPokemon = isCorrect ? 
      (choice === 1 ? gameState.pokemon1 : gameState.pokemon2) : 
      (choice === 1 ? gameState.pokemon2 : gameState.pokemon1);

    const newStreak = isCorrect ? gameState.streak + 1 : 0;

    // Single state update for the choice result
    setGameState(prev => ({
      ...prev,
      userChoice: choice,
      result: isCorrect ? 'correct' : 'wrong',
      streak: newStreak,
      gameStatus: !isCorrect ? 'gameOver' : 'playing',
      cooldown: isCorrect ? 3 : 0
    }));

    if (isCorrect) {
      // Wait for cooldown before loading new battle
      setTimeout(loadNewBattle, 3000);
    }
  };

  const PokemonCard = ({ pokemon, onChoose, isDisabled }: { 
    pokemon: Pokemon; 
    onChoose: () => void;
    isDisabled: boolean;
  }) => (
    <MotionBox
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      p={4}
      borderRadius="xl"
      bg="gray.800"
      boxShadow="xl"
      border="2px solid"
      borderColor="gray.700"
      _hover={{ borderColor: "orange.400" }}
      position="relative"
      overflow="hidden"
      maxW="280px"
    >
      <Stack spacing={3} align="center">
        <Box
          position="relative"
          w="200px"
          h="200px"
          bg="gray.700"
          borderRadius="full"
          p={4}
          boxShadow="inner"
        >
          <Image
            src={pokemon.sprites.front_default}
            alt={pokemon.name}
            w="100%"
            h="100%"
            objectFit="contain"
          />
        </Box>
        <Heading size="lg" textTransform="capitalize" color="yellow.300">
          {pokemon.name}
        </Heading>
        <Button
          colorScheme="red"
          onClick={onChoose}
          disabled={isDisabled}
          size="lg"
          w="100%"
          bgGradient="linear(to-r, red.500, pink.500)"
          _hover={{
            bgGradient: "linear(to-r, red.600, pink.600)",
            transform: 'scale(1.05)'
          }}
        >
          Choose
        </Button>
      </Stack>
    </MotionBox>
  );

  // Update Pokeball sprite URL to use the regular Pokeball
  const pokeballSprite = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";

  const RotatingPokeball = ({ size = "100px" }: { size?: string }) => (
    <motion.div
      animate={{ 
        rotate: [0, 360]
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        ease: "linear"
      }}
    >
      <Image
        src={pokeballSprite}
        alt="Pokeball"
        w={size}
        h={size}
        style={{
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))'
        }}
      />
    </motion.div>
  );

  const BouncingPokeball = ({ size = "100px" }: { size?: string }) => (
    <motion.div
      animate={{ 
        y: [0, -20, 0],
        rotate: [0, 360]
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <Image
        src={pokeballSprite}
        alt="Pokeball"
        w={size}
        h={size}
        style={{
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))'
        }}
      />
    </motion.div>
  );

  if (gameState.isLoading) {
    return (
      <Flex 
        justify="center" 
        align="center" 
        h="100vh" 
        w="100vw"
        bgGradient="linear(to-b, gray.900, gray.800)"
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
      >
        <Stack spacing={4} align="center">
          <BouncingPokeball size="100px" />
          <Text fontSize="xl" color="gray.300" fontFamily="monospace" letterSpacing="wider">
            LOADING BATTLE...
          </Text>
        </Stack>
      </Flex>
    );
  }

  if (gameState.gameStatus === 'start') {
    return (
      <Flex 
        direction="column"
        justify="center" 
        align="center" 
        h="100vh" 
        w="100vw"
        bgGradient="linear(to-b, gray.900, gray.800)"
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
      >
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={0.05}
          backgroundImage={`url(${pokeballSprite})`}
          backgroundSize="100px"
          backgroundRepeat="repeat"
          pointerEvents="none"
          zIndex={0}
        />
        <Stack spacing={8} align="center" position="relative" zIndex={1}>
          <BouncingPokeball size="150px" />
          <Heading 
            size="4xl" 
            bgGradient="linear(to-r, yellow.400, orange.400)" 
            bgClip="text"
            textShadow="2px 2px 4px rgba(0,0,0,0.3)"
          >
            Pokémon Battle Predictor
          </Heading>
          <Text fontSize="xl" color="gray.300" textAlign="center" maxW="600px">
            Test your Pokémon knowledge! Choose which Pokémon you think will win based on their stats.
          </Text>
          <Stack spacing={4} w="100%" maxW="400px">
            <Button
              size="lg"
              bgGradient="linear(to-r, green.400, teal.400)"
              _hover={{
                bgGradient: "linear(to-r, green.500, teal.500)",
                transform: 'scale(1.05)'
              }}
              onClick={() => startGame('easy')}
              px={8}
              py={6}
              fontSize="xl"
            >
              Easy Mode
            </Button>
            <Button
              size="lg"
              bgGradient="linear(to-r, red.500, pink.500)"
              _hover={{
                bgGradient: "linear(to-r, red.600, pink.600)",
                transform: 'scale(1.05)'
              }}
              onClick={() => startGame('hard')}
              px={8}
              py={6}
              fontSize="xl"
            >
              Hard Mode
            </Button>
          </Stack>
        </Stack>
      </Flex>
    );
  }

  if (gameState.gameStatus === 'gameOver') {
    return (
      <Flex 
        direction="column"
        justify="center" 
        align="center" 
        h="100vh" 
        w="100vw"
        bgGradient="linear(to-b, gray.900, gray.800)"
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
      >
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={0.05}
          backgroundImage={`url(${pokeballSprite})`}
          backgroundSize="100px"
          backgroundRepeat="repeat"
          pointerEvents="none"
          zIndex={0}
        />
        <Stack spacing={8} align="center" position="relative" zIndex={1}>
          <BouncingPokeball size="150px" />
          <Heading 
            size="4xl" 
            bgGradient="linear(to-r, red.400, pink.400)" 
            bgClip="text"
            textShadow="2px 2px 4px rgba(0,0,0,0.3)"
          >
            Game Over!
          </Heading>
          <Stack spacing={4} align="center">
            <Text fontSize="2xl" color="yellow.300">
              Final Streak: {gameState.streak}
            </Text>
            <Text fontSize="2xl" color="orange.300">
              High Score: {gameState.highScore}
            </Text>
            <Text fontSize="xl" color="gray.300">
              Difficulty: {gameState.difficulty === 'easy' ? 'Easy' : 'Hard'}
            </Text>
          </Stack>
          <Stack spacing={4} w="100%" maxW="400px">
            <Button
              size="lg"
              bgGradient="linear(to-r, green.400, teal.400)"
              _hover={{
                bgGradient: "linear(to-r, green.500, teal.500)",
                transform: 'scale(1.05)'
              }}
              onClick={() => startGame('easy')}
              px={8}
              py={6}
              fontSize="xl"
            >
              Play Again (Easy)
            </Button>
            <Button
              size="lg"
              bgGradient="linear(to-r, red.500, pink.500)"
              _hover={{
                bgGradient: "linear(to-r, red.600, pink.600)",
                transform: 'scale(1.05)'
              }}
              onClick={() => startGame('hard')}
              px={8}
              py={6}
              fontSize="xl"
            >
              Play Again (Hard)
            </Button>
          </Stack>
        </Stack>
      </Flex>
    );
  }

  return (
    <Stack 
      direction="column" 
      spacing={4}
      p={4} 
      alignItems="center" 
      h="100vh"
      w="100vw"
      bgGradient="linear(to-b, gray.900, gray.800)"
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      overflow="hidden"
    >
      {/* Background */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        opacity={0.05}
        backgroundImage={`url(${pokeballSprite})`}
        backgroundSize="100px"
        backgroundRepeat="repeat"
        pointerEvents="none"
        zIndex={0}
      />
      
      {/* Header */}
      <Stack direction="row" align="center" spacing={4} position="relative" zIndex={1}>
        <RotatingPokeball size="40px" />
        <Heading 
          size="2xl" 
          bgGradient="linear(to-r, cyan.400, blue.400)" 
          bgClip="text"
          textShadow="2px 2px 4px rgba(0,0,0,0.3)"
        >
          Pokémon Battle Predictor
        </Heading>
        <RotatingPokeball size="40px" />
      </Stack>
      
      {/* Score Section */}
      <Flex
        direction="row"
        align="center"
        gap={8}
        position="relative"
        zIndex={1}
      >
        <Flex
          direction="column"
          align="center"
          bg="gray.800"
          p={4}
          borderRadius="xl"
          boxShadow="xl"
          border="2px solid"
          borderColor="cyan.400"
          minW="200px"
        >
          <Text fontSize="lg" color="cyan.300" mb={2}>
            Current Streak
          </Text>
          <Text fontSize="4xl" fontWeight="bold" color="cyan.400">
            {gameState.streak}
          </Text>
        </Flex>

        <Flex
          direction="column"
          align="center"
          bg="gray.800"
          p={4}
          borderRadius="xl"
          boxShadow="xl"
          border="2px solid"
          borderColor="blue.400"
          minW="200px"
        >
          <Text fontSize="lg" color="blue.300" mb={2}>
            High Score
          </Text>
          <Text fontSize="4xl" fontWeight="bold" color="blue.400">
            {gameState.highScore}
          </Text>
        </Flex>
      </Flex>
      
      {/* Battle Section */}
      <Flex 
        direction="column" 
        align="center" 
        justify="space-between" 
        w="100%" 
        maxW="1200px" 
        position="relative" 
        zIndex={1}
        flex={1}
        py={4}
      >
        {/* Pokemon Cards */}
        <Flex justify="space-around" w="100%" align="center">
          {gameState.pokemon1 && gameState.pokemon2 && (
            <>
              <PokemonCard
                pokemon={gameState.pokemon1}
                onChoose={() => handleChoice(1)}
                isDisabled={gameState.userChoice !== null}
              />

              <Flex direction="column" justify="center" align="center">
                <Text 
                  fontSize="5xl" 
                  fontWeight="bold" 
                  color="red.400"
                  textShadow="2px 2px 4px rgba(0,0,0,0.3)"
                >
                  VS
                </Text>
              </Flex>

              <PokemonCard
                pokemon={gameState.pokemon2}
                onChoose={() => handleChoice(2)}
                isDisabled={gameState.userChoice !== null}
              />
            </>
          )}
        </Flex>

        {/* Result Message */}
        <AnimatePresence>
          {gameState.result && (
            <MotionBox
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              p={6}
              borderRadius="md"
              bg={gameState.result === 'correct' ? 'green.900' : 'red.900'}
              border="4px solid"
              borderColor={gameState.result === 'correct' ? 'green.400' : 'red.400'}
              boxShadow="xl"
              position="relative"
              zIndex={2}
              fontFamily="monospace"
              style={{ imageRendering: 'pixelated' }}
              minW="300px"
              mt={4}
            >
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bgImage="url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVQIW2NkYGD4z8DAwMgABXAGNgGwSgwVAFbmAgXQeISDAAAAAElFTkSuQmCC')"
                opacity={0.1}
                pointerEvents="none"
              />
              <Stack spacing={2} align="center">
                <Text
                  fontSize="3xl"
                  color={gameState.result === 'correct' ? 'green.400' : 'red.400'}
                  fontWeight="bold"
                  textShadow="2px 2px 0px rgba(0,0,0,0.5)"
                  letterSpacing="wider"
                  fontFamily="monospace"
                >
                  {gameState.result === 'correct' ? 'SUCCESS!' : 'GAME OVER!'}
                </Text>
                {gameState.cooldown > 0 && (
                  <Text 
                    fontSize="xl" 
                    color="yellow.300"
                    fontFamily="monospace"
                    letterSpacing="wider"
                  >
                    NEXT BATTLE IN {gameState.cooldown}S...
                  </Text>
                )}
              </Stack>
            </MotionBox>
          )}
        </AnimatePresence>
      </Flex>
    </Stack>
  );
};

export default PokemonBattle; 
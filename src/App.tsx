import { ChakraProvider, Container } from '@chakra-ui/react'
import PokemonBattle from './components/PokemonBattle'

function App() {
  return (
    <ChakraProvider>
      <Container maxW="container.xl" centerContent py={8}>
        <PokemonBattle />
      </Container>
    </ChakraProvider>
  )
}

export default App

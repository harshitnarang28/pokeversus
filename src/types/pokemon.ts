export interface Pokemon {
  id: number;
  name: string;
  sprites: {
    front_default: string;
  };
  stats: {
    base_stat: number;
    stat: {
      name: string;
    };
  }[];
  types: {
    type: {
      name: string;
    };
  }[];
}

export interface GameState {
  pokemon1: Pokemon | null;
  pokemon2: Pokemon | null;
  userChoice: number | null;
  streak: number;
  highScore: number;
  isLoading: boolean;
  result: 'correct' | 'wrong' | null;
} 
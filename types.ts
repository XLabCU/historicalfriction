
export enum SonificationMode {
  CACOPHONY = 'CACOPHONY',
  AMBIENT = 'AMBIENT',
  MELODY = 'MELODY'
}

export interface WikipediaArticle {
  pageid: number;
  title: string;
  dist: number;
  lat: number;
  lon: number;
  extract?: string;
  wordcount?: number;
  bearing?: number; // Calculated angle from user
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AppState {
  location: Coordinates;
  radius: number;
  articles: WikipediaArticle[];
  mode: SonificationMode;
  isAudioEnabled: boolean;
  isLoading: boolean;
}

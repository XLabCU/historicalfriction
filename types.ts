
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
  editCount?: number; // Total number of edits to the article
  bearing?: number; // Calculated angle from user (0 = North)
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
  heading: number; // Device heading in degrees (0 = North)
}

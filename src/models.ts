export interface Album {
  albumName: string;
  artistName: string;
  coverArtUrl: string; // Will be empty string if not found, triggering fallback
  releaseYear?: number;
  genre?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  albums?: Album[];
}

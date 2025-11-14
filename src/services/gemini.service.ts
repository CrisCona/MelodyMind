import { Injectable } from '@angular/core';
import { GoogleGenAI, Chat, GenerateContentResponse } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private chat: Chat;

  constructor() {
    // IMPORTANT: The API key is sourced from environment variables.
    // Ensure `process.env.API_KEY` is set in your deployment environment.
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    this.chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are a friendly and knowledgeable music expert named 'MelodyMind'. Your goal is to learn the user's music taste and provide personalized recommendations for bands and albums. When a user tells you what they like, remember it for future conversations. Use your knowledge of music history, genres, and artist connections to give insightful and relevant suggestions. Format your responses clearly, using lists or bold text to highlight bands and albums. When you recommend specific albums, please format them as a JSON array within your response, clearly marked between `[ALBUMS_START]` and `[ALBUMS_END]` tags. Each object in the array should have only `albumName` and `artistName` properties. The application will fetch other details automatically. For example:\n[ALBUMS_START]\n[\n  {\n    \"albumName\": \"OK Computer\",\n    \"artistName\": \"Radiohead\"\n  }\n]\n[ALBUMS_END]\nThis allows the app to display the album art visually.",
      },
    });
  }

  async sendMessageStream(message: string): Promise<AsyncGenerator<GenerateContentResponse>> {
    try {
      return await this.chat.sendMessageStream({ message });
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw new Error('Failed to communicate with the AI model.');
    }
  }
}
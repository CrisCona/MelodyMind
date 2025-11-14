import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from './services/gemini.service';
import { MusicBrainzService } from './services/music-brainz.service';
import { Album, ChatMessage } from './models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class AppComponent {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  
  private readonly geminiService = inject(GeminiService);
  private readonly musicBrainzService = inject(MusicBrainzService);
  private readonly imagePlaceholder = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMzc0MTUxIi8+PHBhdGggc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIiBkPSJNOSA5bDEwLjUtM20wIDYuNTUzdi43NWEyLjI1IDIuMjUgMCAwMS0xLjYzMiAyLjE2M2wtMS4zMi4zNzdhMS44MDMgMS44MDMgMCAxMS0uOTktMy40NjdsMi4zMS0uNjZhMi4yNSAyLjI1IDAgMDAxLjYzMi0yLjE2M3ptMCAwVjIuMjVMOSA1LjI1djEwLjMwM20wIDB2My43NWEyLjI1IDIuMjUgMCAwMS0xLjYzMiAyLjE2M2wtMS4zMi4zNzdhMS44MDMgMS44MDMgMCAwMS0uOTktMy40NjdsMi4zMS0uNjZBMi4yNSAyLjI1MDIuMjUgMCAwMS0xLjYzMiAyLjE2M2wtMS4zMi4zNzdhMS44MDMgMS44MDMgMCAwMS0uOTktMy40NjdsMi4zMS0uNjZBMi4yNSAyLjI1IDAgMDA5IDE1LjU1M3oiIC8+PC9zdmc+';

  initialMessages: ChatMessage[] = [{ 
    role: 'model', 
    text: "Hi! I'm MelodyMind. To get started, tell me about some bands you like, for example: 'I like Radiohead, The Cure, and Deftones.'"
  }];

  messages = signal<ChatMessage[]>(this.initialMessages);
  userInput = signal('');
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      this.scrollToBottom();
    });
  }

  async sendMessage(): Promise<void> {
    const message = this.userInput().trim();
    if (!message || this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.messages.update(current => [...current, { role: 'user', text: message }]);
    this.userInput.set('');
    this.scrollToBottom();

    try {
      const stream = await this.geminiService.sendMessageStream(message);
      
      this.messages.update(current => [...current, { role: 'model', text: '' }]);
      this.scrollToBottom();

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        this.messages.update(current => {
          const lastMessage = current[current.length - 1];
          if (lastMessage && lastMessage.role === 'model') {
            lastMessage.text += chunkText;
          }
          return [...current];
        });
        this.scrollToBottom();
      }

    } catch (e) {
      console.error(e);
      this.error.set('Sorry, something went wrong. Please try again.');
      this.messages.update(current => [...current, { role: 'model', text: 'I seem to be having trouble connecting. Please check your setup and try again.' }]);
    } finally {
      this.isLoading.set(false);
      await this.parseAndFetchAlbumDetails();
      this.scrollToBottom();
    }
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.imagePlaceholder;
  }

  private async parseAndFetchAlbumDetails(): Promise<void> {
    const messages = this.messages();
    const lastMessageIndex = messages.length - 1;
    const lastMessage = messages[lastMessageIndex];

    if (!lastMessage || lastMessage.role !== 'model' || !lastMessage.text.includes('[ALBUMS_START]')) {
      return;
    }

    const albumRegex = /\[ALBUMS_START\]([\s\S]*?)\[ALBUMS_END\]/;
    const match = lastMessage.text.match(albumRegex);

    if (match && match[1]) {
      try {
        const jsonString = match[1].trim();
        const partialAlbums: { albumName: string; artistName: string }[] = JSON.parse(jsonString);
        
        const cleanedText = lastMessage.text.replace(albumRegex, '').trim();

        // Fetch full album details from MusicBrainz in parallel
        const albumDetailPromises = partialAlbums.map(album => 
          this.musicBrainzService.getAlbumDetails(album)
        );
        const fullAlbums: Album[] = await Promise.all(albumDetailPromises);

        const updatedMessage: ChatMessage = {
          ...lastMessage,
          text: cleanedText,
          albums: fullAlbums,
        };
        
        // Update the signal with the final message containing all details
        this.messages.update(current => {
            const newMessages = [...current];
            newMessages[lastMessageIndex] = updatedMessage;
            return newMessages;
        });

      } catch (e) {
        console.error('Failed to parse album JSON or fetch details:', e);
        // If parsing/fetching fails, just clean the text and don't show albums
         this.messages.update(current => {
            const lastMsg = current[current.length - 1];
            if (lastMsg) {
                lastMsg.text = lastMsg.text.replace(albumRegex, '').trim();
            }
            return [...current];
        });
      }
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
        try {
            if (this.chatContainer) {
                this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
            }
        } catch (err) { 
            console.error(err);
        }
    }, 0);
  }
}
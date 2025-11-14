import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Album } from '../models';

// MusicBrainz API response types (simplified)
interface MusicBrainzTag {
  count: number;
  name: string;
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  'release-events'?: { date: string }[];
  'artist-credit'?: { artist: { name: string } }[];
  tags?: MusicBrainzTag[];
}

interface MusicBrainzSearchResponse {
  releases: MusicBrainzRelease[];
}

// Cover Art Archive API response types
interface CoverArtArchiveResponse {
  images: {
    front: boolean;
    image: string;
  }[];
}


@Injectable({
  providedIn: 'root'
})
export class MusicBrainzService {
  private readonly httpClient = inject(HttpClient);
  private readonly musicBrainzApi = 'https://musicbrainz.org/ws/2/release/';
  private readonly coverArtApi = 'https://coverartarchive.org/release/';

  async getAlbumDetails(album: { albumName: string, artistName: string }): Promise<Album> {
    try {
      // 1. Search for the release on MusicBrainz to get its ID
      const searchUrl = `${this.musicBrainzApi}?query=release:${encodeURIComponent(album.albumName)} AND artist:${encodeURIComponent(album.artistName)}&fmt=json`;
      const searchResponse = await firstValueFrom(this.httpClient.get<MusicBrainzSearchResponse>(searchUrl));

      if (!searchResponse.releases || searchResponse.releases.length === 0) {
        throw new Error('Album not found on MusicBrainz via search.');
      }
      
      const mbid = searchResponse.releases[0].id;

      // 2. Perform a direct lookup for more reliable details
      const lookupUrl = `${this.musicBrainzApi}${mbid}?inc=artist-credits+tags&fmt=json`;
      const release = await firstValueFrom(this.httpClient.get<MusicBrainzRelease>(lookupUrl));

      // 3. Fetch cover art from Cover Art Archive (uses mbid)
      let fetchedCoverArtUrl: string | undefined;
      try {
        const coverArtUrl = `${this.coverArtApi}${mbid}`;
        const coverArtResponse = await firstValueFrom(this.httpClient.get<CoverArtArchiveResponse>(coverArtUrl));
        
        if (coverArtResponse.images && coverArtResponse.images.length > 0) {
          const frontImage = coverArtResponse.images.find(img => img.front);
          fetchedCoverArtUrl = frontImage?.image;
        }
      } catch (coverArtError) {
        console.warn(`Could not fetch cover art for ${album.albumName}:`, coverArtError);
        // Do not re-throw, just proceed without a cover image.
      }
      
      // 4. Extract details from the more reliable lookup response
      const releaseYearStr = release['release-events']?.[0]?.date;
      const releaseYear = releaseYearStr ? parseInt(releaseYearStr.substring(0, 4), 10) : undefined;
      
      // Find the most popular tag for genre and capitalize it
      const genreTag = release.tags?.sort((a, b) => b.count - a.count)[0]?.name;
      const genre = genreTag ? genreTag.charAt(0).toUpperCase() + genreTag.slice(1) : undefined;

      return {
        albumName: release.title, // Use title from lookup for accuracy
        artistName: release['artist-credit']?.[0]?.artist.name || album.artistName, // Use artist from lookup
        releaseYear,
        genre,
        coverArtUrl: fetchedCoverArtUrl || '', // Provide empty string if not found to trigger fallback
      };

    } catch (error) {
      console.error(`Failed to get details for ${album.albumName}:`, error);
      // Return the basic album info if API calls fail, so UI doesn't break
      return {
        albumName: album.albumName,
        artistName: album.artistName,
        coverArtUrl: ''
      };
    }
  }
}
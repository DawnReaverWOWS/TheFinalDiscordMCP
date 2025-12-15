/**
 * Music Service - YouTube/Spotify/SoundCloud playback for Discord
 * Uses play-dl for audio streaming
 */

import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus
} from '@discordjs/voice';
import play, { YouTubeVideo, SpotifyTrack, SoundCloudTrack } from 'play-dl';
import { Guild, GuildMember, VoiceChannel, StageChannel, EmbedBuilder } from 'discord.js';

export interface Track {
  title: string;
  url: string;
  duration: number; // seconds
  thumbnail?: string;
  requestedBy: string;
  source: 'youtube' | 'spotify' | 'soundcloud' | 'url';
}

interface GuildQueue {
  tracks: Track[];
  currentTrack: Track | null;
  player: AudioPlayer;
  volume: number;
  loop: boolean;
  textChannelId?: string;
}

class MusicService {
  private queues: Map<string, GuildQueue> = new Map();

  constructor() {
    // Initialize play-dl (no auth needed for basic YouTube)
  }

  /**
   * Get or create a queue for a guild
   */
  private getQueue(guildId: string): GuildQueue | undefined {
    return this.queues.get(guildId);
  }

  /**
   * Create a new queue for a guild
   */
  private createQueue(guildId: string): GuildQueue {
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    const queue: GuildQueue = {
      tracks: [],
      currentTrack: null,
      player,
      volume: 100,
      loop: false
    };

    // Handle player state changes
    player.on(AudioPlayerStatus.Idle, () => {
      this.playNext(guildId);
    });

    player.on('error', (error) => {
      console.error(`Music player error in guild ${guildId}:`, error);
      this.playNext(guildId);
    });

    this.queues.set(guildId, queue);
    return queue;
  }

  /**
   * Search and get track info from a query or URL
   */
  async searchTrack(query: string, requestedBy: string): Promise<Track | null> {
    try {
      // Check if it's a URL
      const urlType = await play.validate(query);

      if (urlType === 'yt_video') {
        const info = await play.video_info(query);
        return {
          title: info.video_details.title || 'Unknown',
          url: info.video_details.url,
          duration: info.video_details.durationInSec,
          thumbnail: info.video_details.thumbnails[0]?.url,
          requestedBy,
          source: 'youtube'
        };
      }

      if (urlType === 'yt_playlist') {
        // For playlists, just get the first video for now
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        if (videos.length > 0) {
          const video = videos[0];
          return {
            title: video.title || 'Unknown',
            url: video.url,
            duration: video.durationInSec,
            thumbnail: video.thumbnails[0]?.url,
            requestedBy,
            source: 'youtube'
          };
        }
      }

      if (urlType === 'sp_track') {
        // Spotify track - search on YouTube
        const sp = await play.spotify(query);
        if (sp.type === 'track') {
          const track = sp as SpotifyTrack;
          const searchQuery = `${track.name} ${track.artists[0]?.name || ''}`;
          const searched = await play.search(searchQuery, { limit: 1 });
          if (searched.length > 0) {
            return {
              title: `${track.name} - ${track.artists[0]?.name || 'Unknown'}`,
              url: searched[0].url,
              duration: searched[0].durationInSec,
              thumbnail: track.thumbnail?.url || searched[0].thumbnails[0]?.url,
              requestedBy,
              source: 'spotify'
            };
          }
        }
      }

      if (urlType === 'so_track') {
        const sc = await play.soundcloud(query);
        if (sc.type === 'track') {
          const scTrack = sc as SoundCloudTrack;
          return {
            title: scTrack.name,
            url: scTrack.url,
            duration: Math.floor(scTrack.durationInMs / 1000),
            thumbnail: scTrack.thumbnail,
            requestedBy,
            source: 'soundcloud'
          };
        }
      }

      // Not a URL - search YouTube
      const searched = await play.search(query, { limit: 1 });
      if (searched.length > 0) {
        const video = searched[0];
        return {
          title: video.title || 'Unknown',
          url: video.url,
          duration: video.durationInSec,
          thumbnail: video.thumbnails[0]?.url,
          requestedBy,
          source: 'youtube'
        };
      }

      return null;
    } catch (error) {
      console.error('Error searching track:', error);
      return null;
    }
  }

  /**
   * Add a track to the queue and start playing if not already
   */
  async play(
    guild: Guild,
    member: GuildMember,
    query: string,
    textChannelId: string
  ): Promise<{ success: boolean; message: string; embed?: EmbedBuilder }> {
    // Check if user is in a voice channel
    const voiceChannel = member.voice.channel as VoiceChannel | StageChannel | null;
    if (!voiceChannel) {
      return { success: false, message: '❌ You need to be in a voice channel to play music!' };
    }

    // Search for the track
    const track = await this.searchTrack(query, member.user.username);
    if (!track) {
      return { success: false, message: '❌ Could not find that song. Try a different search or URL.' };
    }

    // Get or create queue
    let queue = this.getQueue(guild.id);
    if (!queue) {
      queue = this.createQueue(guild.id);
    }
    queue.textChannelId = textChannelId;

    // Join voice channel if not already connected
    let connection = getVoiceConnection(guild.id);
    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
      });

      // Subscribe the connection to the player
      connection.subscribe(queue.player);

      // Handle disconnection
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection!, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection!, VoiceConnectionStatus.Connecting, 5_000)
          ]);
        } catch {
          this.destroy(guild.id);
        }
      });
    }

    // Add to queue
    queue.tracks.push(track);

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setAuthor({ name: queue.currentTrack ? '🎵 Added to Queue' : '🎵 Now Playing' })
      .setTitle(track.title)
      .setURL(track.url)
      .addFields(
        { name: 'Duration', value: this.formatDuration(track.duration), inline: true },
        { name: 'Requested by', value: track.requestedBy, inline: true }
      );

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    if (queue.tracks.length > 1) {
      embed.addFields({ name: 'Position in queue', value: `#${queue.tracks.length}`, inline: true });
    }

    // Start playing if not already
    if (!queue.currentTrack) {
      this.playNext(guild.id);
    }

    return { success: true, message: '', embed };
  }

  /**
   * Play the next track in the queue
   */
  private async playNext(guildId: string): Promise<void> {
    const queue = this.getQueue(guildId);
    if (!queue) return;

    // If loop is on and there's a current track, re-add it
    if (queue.loop && queue.currentTrack) {
      queue.tracks.push(queue.currentTrack);
    }

    // Get next track
    const track = queue.tracks.shift();
    if (!track) {
      queue.currentTrack = null;
      // Don't disconnect immediately - wait a bit
      setTimeout(() => {
        const q = this.getQueue(guildId);
        if (q && !q.currentTrack && q.tracks.length === 0) {
          this.destroy(guildId);
        }
      }, 60000); // Disconnect after 1 minute of inactivity
      return;
    }

    queue.currentTrack = track;

    try {
      // Get audio stream
      const stream = await play.stream(track.url);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
      });

      if (resource.volume) {
        resource.volume.setVolume(queue.volume / 100);
      }

      queue.player.play(resource);
    } catch (error) {
      console.error('Error playing track:', error);
      // Try next track
      this.playNext(guildId);
    }
  }

  /**
   * Skip the current track
   */
  skip(guildId: string): { success: boolean; message: string } {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.currentTrack) {
      return { success: false, message: '❌ Nothing is playing!' };
    }

    const skipped = queue.currentTrack.title;
    queue.player.stop();
    return { success: true, message: `⏭️ Skipped **${skipped}**` };
  }

  /**
   * Stop playback and clear queue
   */
  stop(guildId: string): { success: boolean; message: string } {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return { success: false, message: '❌ Nothing is playing!' };
    }

    queue.tracks = [];
    queue.currentTrack = null;
    queue.player.stop();
    this.destroy(guildId);

    return { success: true, message: '⏹️ Stopped playback and cleared the queue.' };
  }

  /**
   * Pause playback
   */
  pause(guildId: string): { success: boolean; message: string } {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.currentTrack) {
      return { success: false, message: '❌ Nothing is playing!' };
    }

    if (queue.player.state.status === AudioPlayerStatus.Paused) {
      return { success: false, message: '⏸️ Already paused!' };
    }

    queue.player.pause();
    return { success: true, message: '⏸️ Paused.' };
  }

  /**
   * Resume playback
   */
  resume(guildId: string): { success: boolean; message: string } {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.currentTrack) {
      return { success: false, message: '❌ Nothing is playing!' };
    }

    if (queue.player.state.status !== AudioPlayerStatus.Paused) {
      return { success: false, message: '▶️ Not paused!' };
    }

    queue.player.unpause();
    return { success: true, message: '▶️ Resumed.' };
  }

  /**
   * Set volume
   */
  setVolume(guildId: string, volume: number): { success: boolean; message: string } {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return { success: false, message: '❌ Nothing is playing!' };
    }

    queue.volume = Math.max(0, Math.min(150, volume));

    // Update current resource volume if playing
    const state = queue.player.state;
    if (state.status === AudioPlayerStatus.Playing && 'resource' in state) {
      const resource = state.resource;
      if (resource.volume) {
        resource.volume.setVolume(queue.volume / 100);
      }
    }

    return { success: true, message: `🔊 Volume set to **${queue.volume}%**` };
  }

  /**
   * Toggle loop
   */
  toggleLoop(guildId: string): { success: boolean; message: string } {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return { success: false, message: '❌ Nothing is playing!' };
    }

    queue.loop = !queue.loop;
    return {
      success: true,
      message: queue.loop ? '🔁 Loop **enabled**' : '➡️ Loop **disabled**'
    };
  }

  /**
   * Get current queue
   */
  getQueueEmbed(guildId: string): EmbedBuilder | null {
    const queue = this.getQueue(guildId);
    if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) {
      return null;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🎵 Music Queue');

    if (queue.currentTrack) {
      embed.addFields({
        name: '▶️ Now Playing',
        value: `[${queue.currentTrack.title}](${queue.currentTrack.url}) - ${this.formatDuration(queue.currentTrack.duration)}`
      });
    }

    if (queue.tracks.length > 0) {
      const upcoming = queue.tracks
        .slice(0, 10)
        .map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) - ${this.formatDuration(t.duration)}`)
        .join('\n');

      embed.addFields({ name: `📋 Up Next (${queue.tracks.length} tracks)`, value: upcoming });

      if (queue.tracks.length > 10) {
        embed.setFooter({ text: `And ${queue.tracks.length - 10} more...` });
      }
    }

    const totalDuration = queue.tracks.reduce((acc, t) => acc + t.duration, 0) +
                         (queue.currentTrack?.duration || 0);
    embed.addFields({
      name: 'Total Duration',
      value: this.formatDuration(totalDuration),
      inline: true
    });

    if (queue.loop) {
      embed.addFields({ name: 'Loop', value: '🔁 Enabled', inline: true });
    }

    return embed;
  }

  /**
   * Get now playing info
   */
  getNowPlaying(guildId: string): EmbedBuilder | null {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.currentTrack) {
      return null;
    }

    const track = queue.currentTrack;
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setAuthor({ name: '🎵 Now Playing' })
      .setTitle(track.title)
      .setURL(track.url)
      .addFields(
        { name: 'Duration', value: this.formatDuration(track.duration), inline: true },
        { name: 'Requested by', value: track.requestedBy, inline: true },
        { name: 'Volume', value: `${queue.volume}%`, inline: true }
      );

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    if (queue.tracks.length > 0) {
      embed.setFooter({ text: `${queue.tracks.length} songs in queue` });
    }

    return embed;
  }

  /**
   * Destroy the queue and disconnect
   */
  destroy(guildId: string): void {
    const queue = this.getQueue(guildId);
    if (queue) {
      queue.player.stop();
      this.queues.delete(guildId);
    }

    const connection = getVoiceConnection(guildId);
    if (connection) {
      connection.destroy();
    }
  }

  /**
   * Format duration in seconds to mm:ss or hh:mm:ss
   */
  private formatDuration(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Singleton instance
export const musicService = new MusicService();

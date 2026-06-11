import type { Artist, AudioTrack } from "@/types";

export function groupTracksByArtist(tracks: AudioTrack[]) {
  const order: string[] = [];
  const byArtist = new Map<string, { artist: Artist; tracks: AudioTrack[] }>();
  const ungrouped: AudioTrack[] = [];

  for (const track of tracks) {
    const artist = track.artists;
    if (!artist) {
      ungrouped.push(track);
      continue;
    }
    if (!byArtist.has(artist.id)) {
      byArtist.set(artist.id, { artist, tracks: [] });
      order.push(artist.id);
    }
    byArtist.get(artist.id)!.tracks.push(track);
  }

  order.sort((a, b) => byArtist.get(a)!.artist.name.localeCompare(byArtist.get(b)!.artist.name, "es"));
  return {
    artistGroups: order.map((id) => byArtist.get(id)!),
    ungrouped,
  };
}

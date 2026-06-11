import type { AudioTrack } from "@/types";

export function groupTracksByArtist(tracks: AudioTrack[]) {
  const order: string[] = [];
  const byArtist = new Map<string, AudioTrack[]>();
  const ungrouped: AudioTrack[] = [];

  for (const track of tracks) {
    const artist = track.artist?.trim();
    if (!artist) {
      ungrouped.push(track);
      continue;
    }
    if (!byArtist.has(artist)) {
      byArtist.set(artist, []);
      order.push(artist);
    }
    byArtist.get(artist)!.push(track);
  }

  order.sort((a, b) => a.localeCompare(b, "es"));
  return {
    artistGroups: order.map((name) => ({ name, tracks: byArtist.get(name)! })),
    ungrouped,
  };
}

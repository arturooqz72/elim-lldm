const AZURACAST_API = "https://radio.elimlldm.net/api";
const STATION_ID = "elim_lldm";

export interface NowPlayingData {
  station: {
    name: string;
    listen_url: string;
  };
  now_playing: {
    song: {
      title: string;
      artist: string;
      art: string;
    };
    duration: number;
    elapsed: number;
  };
  listeners: {
    current: number;
    total: number;
  };
  live: {
    is_live: boolean;
    streamer_name: string;
  };
}

export async function getNowPlaying(): Promise<NowPlayingData | null> {
  try {
    const res = await fetch(`${AZURACAST_API}/nowplaying/${STATION_ID}`, {
      next: { revalidate: 30 },
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export const RADIO_STREAM_URL =
  "https://radio.elimlldm.net/listen/elim_lldm/radio.mp3";

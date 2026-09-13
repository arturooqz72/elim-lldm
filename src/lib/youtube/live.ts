// Creación y manejo de transmisiones en vivo de YouTube vía la Data
// API v3 — la ingestión sigue siendo RTMP normal (LiveKit egress no
// cambia), esto solo automatiza: crear una ingestion reusable
// ("liveStream" persistente) y, por cada sesión, un "liveBroadcast"
// nuevo vinculado a ella, para que aparezca correctamente en el canal
// (título, "en vivo ahora", y transición a terminado).

interface LiveStreamResource {
  id: string;
  cdn: {
    ingestionInfo: {
      ingestionAddress: string;
      streamName: string;
    };
  };
}

export async function createPersistentLiveStream(
  accessToken: string,
  title: string
): Promise<{ streamId: string; rtmpUrl: string; streamKey: string }> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: { title },
        cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`No se pudo crear la ingestión de YouTube (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as LiveStreamResource;
  return {
    streamId: data.id,
    rtmpUrl: data.cdn.ingestionInfo.ingestionAddress,
    streamKey: data.cdn.ingestionInfo.streamName,
  };
}

export async function createAndBindBroadcast(
  accessToken: string,
  streamId: string,
  title: string
): Promise<string> {
  const createRes = await fetch(
    "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: { title, scheduledStartTime: new Date().toISOString() },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
        // Con esto YouTube pasa el broadcast a "live" solo al detectar
        // la señal RTMP entrante, y lo termina solo al perderla — no
        // hace falta llamar a "transition" a mano en ningún momento.
        contentDetails: { enableAutoStart: true, enableAutoStop: true },
      }),
    }
  );

  if (!createRes.ok) {
    throw new Error(
      `No se pudo crear la transmisión de YouTube (${createRes.status}): ${await createRes.text()}`
    );
  }

  const broadcast = await createRes.json();
  const broadcastId = broadcast.id as string;

  const bindRes = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&streamId=${streamId}&part=id,contentDetails`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!bindRes.ok) {
    throw new Error(
      `No se pudo vincular la transmisión de YouTube (${bindRes.status}): ${await bindRes.text()}`
    );
  }

  return broadcastId;
}

// Mejor esfuerzo — con enableAutoStop ya definido, YouTube termina el
// broadcast solo (~1 min) al perder la señal; esto solo lo adelanta.
export async function completeBroadcast(accessToken: string, broadcastId: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${broadcastId}&part=id,status`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(() => {});
}

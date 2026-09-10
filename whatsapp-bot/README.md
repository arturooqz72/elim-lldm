# Bot de WhatsApp — Elim LLDM

Asistente de WhatsApp que responde preguntas de la comunidad usando la
misma base de conocimiento de Elim IA (modo LLDM: solo contesta con
lo que hay en los documentos que subiste en /admin/elim-ia).

No usa la API oficial de WhatsApp Business de Meta — se conecta como
un WhatsApp normal (whatsapp-web.js), vinculando el número que tú
elijas escaneando un código QR, igual que cuando vinculas WhatsApp Web
o WhatsApp Desktop.

## Cómo funciona

1. Alguien te escribe por WhatsApp.
2. El bot (corriendo en el servidor Hetzner) recibe el mensaje y se lo
   manda a `https://elimlldm.net/api/whatsapp/chat`.
3. Ese endpoint de elimlldm.net busca en `elim_ia_documents`, arma el
   mismo prompt de modo LLDM que usa Elim IA, y le pregunta a Claude.
4. El bot recibe la respuesta y se la contesta a la persona por
   WhatsApp.
5. El historial de esa conversación se guarda en la tabla
   `whatsapp_ia_messages` (por número de teléfono), para que el
   asistente recuerde el contexto de los últimos mensajes.

Comandos que entiende el bot: `!ayuda` y `!limpiar` (borra el
historial de esa persona).

## Antes de desplegar

1. **Corre la migración SQL** en el proyecto de Supabase (SQL Editor):
   `supabase/migrations/0036_whatsapp_ia.sql`.

2. **Agrega la variable de entorno en Vercel** (Project Settings →
   Environment Variables) para el proyecto `elim-lldm`:
   - `WHATSAPP_BOT_SECRET` = el mismo valor que ya quedó en
     `whatsapp-bot/.env` y en `elim-lldm/.env.local` (no lo cambies,
     ya está generado y sincronizado en ambos lados).
   - Vuelve a desplegar en Vercel (o espera al próximo deploy) para
     que la variable quede activa — sin esto, el endpoint
     `/api/whatsapp/chat` rechaza todo con 401.

## Desplegar en el servidor Hetzner (junto a AzuraCast)

1. Sube esta carpeta `whatsapp-bot/` al servidor, por ejemplo con
   `scp` o `rsync`:
   ```bash
   rsync -avz --exclude node_modules --exclude dist --exclude session \
     whatsapp-bot/ usuario@46.224.234.223:/opt/elim-whatsapp-bot/
   ```

2. Entra al servidor y levanta el contenedor:
   ```bash
   ssh usuario@46.224.234.223
   cd /opt/elim-whatsapp-bot
   docker compose up -d --build
   ```

3. Mira los logs para escanear el código QR (solo la primera vez —
   después la sesión queda guardada en el volumen `./session`):
   ```bash
   docker compose logs -f
   ```
   Abre WhatsApp en el celular del número que vas a usar → **Ajustes
   → Dispositivos vinculados → Vincular un dispositivo** → escanea el
   QR que aparece en la terminal.

4. Cuando el log diga "Bot de WhatsApp de Elim LLDM listo.", ya puedes
   escribirle un mensaje de prueba a ese número.

## Actualizar el bot después de un cambio de código

```bash
cd /opt/elim-whatsapp-bot
docker compose up -d --build
```
La sesión de WhatsApp (volumen `./session`) no se borra al
reconstruir, así que no hace falta volver a escanear el QR.

## Probar el endpoint de elimlldm.net sin el bot

Útil para confirmar que la parte de Next.js/Supabase quedó bien antes
de meterte con Docker/QR:

```bash
curl -X POST https://elimlldm.net/api/whatsapp/chat \
  -H "content-type: application/json" \
  -H "x-whatsapp-secret: TU_WHATSAPP_BOT_SECRET" \
  -d '{"from": "5217000000000@c.us", "message": "¿Qué es Elim LLDM?"}'
```

## Notas

- El modo aquí es siempre LLDM (solo documentos oficiales) — no
  expone el modo "general" con búsqueda web de Elim IA, porque este
  número es público y cualquiera puede escribirle; abrir ese modo
  aquí dispara el costo y la superficie de abuso.
- Hay un límite de mensajes por número (`RATE_LIMIT_MAX` /
  `RATE_LIMIT_WINDOW_MS` en `.env`) para que nadie pueda saturar la
  cuenta de Anthropic mandando mensajes en bucle.
- Si `whatsapp-web.js` se desconecta (p. ej. desvinculaste el
  dispositivo desde el celular), el contenedor se reinicia solo
  (`restart: unless-stopped`) pero vas a tener que volver a escanear
  el QR — revisa los logs de vez en cuando.
- whatsapp-web.js NO es la API oficial de Meta: funciona muy bien
  para el volumen de una comunidad, pero técnicamente corre por fuera
  de los términos de servicio de WhatsApp. El número que uses debería
  ser uno dedicado a esto (no tu WhatsApp personal), por si algún día
  hay que migrar a la API oficial de WhatsApp Business sin perder tu
  número de siempre.

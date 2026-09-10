# Bot de WhatsApp — Elim LLDM

Respaldo automático para el WhatsApp de contacto que ya está publicado
en elimlldm.net (**725-277-9358**, el mismo del botón "Contáctanos").
Si alguien te escribe ahí y no puedes contestar tú, la IA responde
usando la misma base de conocimiento de Elim IA (modo LLDM: solo
contesta con lo que hay en los documentos que subiste en
/admin/elim-ia). No es un número nuevo ni un bot aparte — se vincula
al MISMO número que ya usas.

No usa la API oficial de WhatsApp Business de Meta — se conecta como
un WhatsApp normal (whatsapp-web.js), vinculando ese número
escaneando un código QR desde el teléfono donde ya lo tienes
instalado, igual que cuando vinculas WhatsApp Web o WhatsApp Desktop.
Sigues usando WhatsApp en ese teléfono con toda normalidad — el bot
solo se suma como "dispositivo vinculado" adicional.

## Cómo funciona

1. Alguien te escribe por WhatsApp al 725-277-9358.
2. El bot **no contesta de inmediato** — espera `AUTO_REPLY_DELAY_MS`
   (5 minutos por defecto) dándote la oportunidad de responder tú
   mismo, normal, desde tu propio teléfono.
3. **Si tú contestas antes** de que se cumpla ese plazo, el bot lo
   detecta (ve que escribiste desde la misma cuenta en ese chat) y
   cancela la respuesta automática — no interviene.
4. **Si nadie contesta a tiempo**, el bot manda todo lo que la persona
   escribió mientras esperaba a `https://elimlldm.net/api/whatsapp/chat`.
5. Ese endpoint busca en `elim_ia_documents`, arma el mismo prompt de
   modo LLDM que usa Elim IA, y le pregunta a Claude.
6. El bot recibe la respuesta y se la contesta a la persona por
   WhatsApp.
7. El historial de esa conversación se guarda en la tabla
   `whatsapp_ia_messages` (por número de teléfono), para que el
   asistente recuerde el contexto de los últimos mensajes.

Comandos que entiende el bot: `!ayuda` (respuesta instantánea) y
`!limpiar` (borra el historial de esa persona, también instantáneo —
ambos se atienden al momento, sin esperar el plazo de respaldo).

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
   Abre WhatsApp en el celular donde ya tienes activo el **725-277-9358**
   → **Ajustes → Dispositivos vinculados → Vincular un dispositivo** →
   escanea el QR que aparece en la terminal. Es el mismo procedimiento
   que vincular WhatsApp Web — tu teléfono sigue funcionando normal.

4. Cuando el log diga "Bot de WhatsApp de Elim LLDM listo.", ya está
   vinculado. Mándale un mensaje de prueba desde OTRO número (no el
   tuyo) y espera sin contestar tú — a los `AUTO_REPLY_DELAY_MS`
   configurados (5 min por defecto) debe llegar la respuesta
   automática.

**Si ya habías vinculado el bot a un número distinto antes** (sesión
vieja guardada en `./session`), hay que borrar esa sesión para
volver a escanear con el número correcto:
```bash
docker compose down
rm -rf session/*
docker compose up -d --build
docker compose logs -f
```

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
  de los términos de servicio de WhatsApp. Si algún día quieres migrar
  el 725-277-9358 a la API oficial de WhatsApp Business, ese trámite
  es independiente de este bot (que simplemente dejarías de correr).
- El plazo de espera (`AUTO_REPLY_DELAY_MS`) es por chat: si la misma
  persona escribe varios mensajes seguidos mientras espera, todos se
  juntan en uno solo antes de mandarlos a la IA, para que no pierda
  contexto.

# Inselbet

Sportweddenschappen platform met real-time odds via The Odds API.

## Deploy via Cloudflare Pages

1. Upload deze folder naar een GitHub repository
2. Ga naar [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages**
3. Klik **Connect to Git** en kies je repository
4. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Klik **Save and Deploy**

Je site komt online op `https://inselbet.pages.dev`

## API configuratie

De Worker URL staat in `src/App.jsx` op regel 8:

```javascript
const API_BASE = "https://mute-paper-7180-inselbetapi.vincentsteevensz.workers.dev";
```

## Lokaal draaien (optioneel)

```bash
npm install
npm run dev
```

export interface GeoPoint {
  lat: number;
  lng: number;
  place: string;
  /** de onde veio: gps (preciso), ip (aproximado por cidade) ou none */
  source: 'gps' | 'ip' | 'none';
}

const CACHE_KEY = 'livedc-geo-cache-v1';
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6h

function readCache(): GeoPoint | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, point } = JSON.parse(raw);
    if (!at || !point || Date.now() - at > CACHE_TTL) return null;
    return point as GeoPoint;
  } catch {
    return null;
  }
}

function writeCache(point: GeoPoint) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), point }));
  } catch {
    // ignora
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** Localização por IP (cidade aproximada). Tenta 3 serviços gratuitos, o que responder primeiro vale. */
async function locateByIp(): Promise<GeoPoint | null> {
  const attempts: Array<() => Promise<GeoPoint | null>> = [
    async () => {
      const r = await withTimeout(fetch('https://ipapi.co/json/', { cache: 'no-store' }), 4500);
      if (!r.ok) return null;
      const j = await r.json();
      if (typeof j.latitude !== 'number' || typeof j.longitude !== 'number') return null;
      const place = [j.city, j.region_code || j.region, j.country_name].filter(Boolean).join(', ');
      return { lat: j.latitude, lng: j.longitude, place: place || 'Local desconhecido', source: 'ip' };
    },
    async () => {
      const r = await withTimeout(fetch('https://ipwho.is/', { cache: 'no-store' }), 4500);
      if (!r.ok) return null;
      const j = await r.json();
      if (!j.success || typeof j.latitude !== 'number') return null;
      const place = [j.city, j.region_code || j.region, j.country].filter(Boolean).join(', ');
      return { lat: j.latitude, lng: j.longitude, place: place || 'Local desconhecido', source: 'ip' };
    },
    async () => {
      const r = await withTimeout(fetch('https://get.geojs.io/v1/ip/geo.json', { cache: 'no-store' }), 4500);
      if (!r.ok) return null;
      const j = await r.json();
      const lat = parseFloat(j.latitude);
      const lng = parseFloat(j.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      const place = [j.city, j.region, j.country].filter(Boolean).join(', ');
      return { lat, lng, place: place || 'Local desconhecido', source: 'ip' };
    },
  ];
  for (const fn of attempts) {
    try {
      const p = await fn();
      if (p) return p;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

/** Nome do lugar a partir de coordenadas (reverse geocoding gratuito). */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await withTimeout(
      fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`,
        { cache: 'no-store' }
      ),
      4500
    );
    if (!r.ok) return '';
    const j = await r.json();
    return [j.city || j.locality, j.principalSubdivisionCode?.split('-')[1] || j.principalSubdivision, j.countryName]
      .filter(Boolean)
      .join(', ');
  } catch {
    return '';
  }
}

/** GPS do navegador (pede permissão). Mais preciso que IP. */
function locateByGps(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    const done = (p: GeoPoint | null) => resolve(p);
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const place = (await reverseGeocode(lat, lng)) || 'Minha localização';
          done({ lat, lng, place, source: 'gps' });
        },
        () => done(null),
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 1000 * 60 * 30 }
      );
    } catch {
      done(null);
    }
  });
}

/**
 * Localização de quem está criando a sala.
 * Ordem: cache → IP (rápido, sem permissão) → GPS em paralelo pra refinar.
 * Nunca trava: se tudo falhar, devolve null.
 */
export async function locateMe(opts?: { preferGps?: boolean }): Promise<GeoPoint | null> {
  const cached = readCache();
  if (cached && !(opts?.preferGps && cached.source !== 'gps')) return cached;

  const ipP = locateByIp();
  const gpsP = opts?.preferGps ? locateByGps() : Promise.resolve<GeoPoint | null>(null);

  const [ip, gps] = await Promise.all([ipP.catch(() => null), gpsP.catch(() => null)]);
  const best = gps || ip || cached || null;
  if (best) writeCache(best);
  return best;
}

/** Só IP (nunca pede permissão) — usado no fundo pra já deixar em cache. */
export function prefetchLocation() {
  if (readCache()) return;
  locateByIp()
    .then((p) => p && writeCache(p))
    .catch(() => {});
}

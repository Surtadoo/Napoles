import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { Globe as GlobeIcon, Lock, Users, X } from 'lucide-react';
import type { RecentRoom } from '../utils/lobby';

interface RoomsGlobeProps {
  rooms: RecentRoom[];
  onPick: (room: RecentRoom) => void;
  onClose: () => void;
}

type Pt = RecentRoom & { lat: number; lng: number; size: number; color: string };

export const RoomsGlobe: React.FC<RoomsGlobeProps> = ({ rooms, onPick, onClose }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 600, h: 420 });
  const [hover, setHover] = useState<Pt | null>(null);
  const [ready, setReady] = useState(false);

  // pontos = salas com coordenadas
  const points: Pt[] = useMemo(
    () =>
      rooms
        .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number')
        .map((r) => ({
          ...(r as RecentRoom & { lat: number; lng: number }),
          size: r.type === 'public' ? 0.55 : 0.5,
          color: r.type === 'public' ? '#38bdf8' : '#facc15',
        })),
    [rooms]
  );

  // anéis pulsando nas salas (efeito "ao vivo")
  const rings = useMemo(
    () =>
      points.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        color: p.color,
        maxR: 3.5,
        speed: 1.8,
        period: 1400,
      })),
    [points]
  );

  // arcos entre salas (dá vida ao globo)
  const arcs = useMemo(() => {
    if (points.length < 2) return [];
    const out: { startLat: number; startLng: number; endLat: number; endLng: number; color: string[] }[] = [];
    for (let i = 0; i < points.length && out.length < 24; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a === b) continue;
      out.push({
        startLat: a.lat,
        startLng: a.lng,
        endLat: b.lat,
        endLng: b.lng,
        color: [a.color, b.color],
      });
    }
    return out;
  }, [points]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(280, Math.floor(r.width)), h: Math.max(320, Math.floor(r.height)) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.max(280, Math.floor(r.width)), h: Math.max(320, Math.floor(r.height)) });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    try {
      const controls = g.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.55;
      controls.enableZoom = true;
      controls.minDistance = 140;
      controls.maxDistance = 520;
      // começa olhando pra sala mais recente (localização real); sem salas, mostra o Brasil
      const first = points[0];
      if (first) g.pointOfView({ lat: first.lat, lng: first.lng, altitude: 1.9 }, 0);
      else g.pointOfView({ lat: -14, lng: -52, altitude: 2.1 }, 0);
      setReady(true);
    } catch {
      // ignora
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w]);

  const flyTo = (p: Pt) => {
    try {
      const g = globeRef.current;
      if (!g) return;
      g.controls().autoRotate = false;
      g.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.2 }, 900);
    } catch {
      // ignora
    }
  };

  const pubCount = points.filter((p) => p.type === 'public').length;
  const privCount = points.length - pubCount;
  // salas ainda sem localização (criador não deu permissão / sem internet na hora)
  const unlocated = rooms.filter((r) => !(typeof r.lat === 'number' && typeof r.lng === 'number'));

  return (
    <div className="relative rounded-3xl overflow-hidden border border-[#1f2533] bg-[#05070c] shadow-2xl">
      {/* topo */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <GlobeIcon className="w-4 h-4 text-emerald-300" />
          </span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Mapa de salas</p>
            <p className="text-[11px] text-gray-400">
              <span className="text-sky-300 font-semibold">{pubCount} públicas</span> ·{' '}
              <span className="text-yellow-300 font-semibold">{privCount} privadas</span>
              {unlocated.length > 0 && (
                <span className="text-gray-500"> · {unlocated.length} localizando…</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto p-2 rounded-xl bg-black/50 hover:bg-black/70 text-gray-300 hover:text-white border border-white/10 touch-manipulation"
          aria-label="Fechar mapa"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* globo */}
      <div ref={wrapRef} className="w-full h-[62vh] min-h-[340px] max-h-[640px]">
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          atmosphereColor="#38bdf8"
          atmosphereAltitude={0.22}
          showAtmosphere
          // pontos (salas)
          pointsData={points}
          pointLat={(d: any) => d.lat}
          pointLng={(d: any) => d.lng}
          pointColor={(d: any) => d.color}
          pointAltitude={(d: any) => (hover && hover.code === d.code ? 0.12 : 0.05)}
          pointRadius={(d: any) => d.size}
          pointResolution={18}
          pointsMerge={false}
          onPointHover={(p: any) => setHover(p || null)}
          onPointClick={(p: any) => {
            flyTo(p);
            onPick(p as RecentRoom);
          }}
          pointLabel={(d: any) =>
            `<div style="background:rgba(8,12,20,.92);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 10px;font-family:system-ui;font-size:12px;color:#e5e7eb;box-shadow:0 8px 30px rgba(0,0,0,.5)">
               <div style="font-weight:700;color:${d.color};margin-bottom:2px">${d.type === 'public' ? '🌐 Pública' : '🔒 Privada'}</div>
               <div style="font-weight:700">${escapeHtml(d.name)}</div>
               <div style="font-family:monospace;color:#9ca3af">${d.code}</div>
               ${d.place ? `<div style="color:#9ca3af;font-size:11px">${escapeHtml(d.place)}</div>` : ''}
               <div style="margin-top:4px;color:#34d399;font-size:11px">toque para entrar</div>
             </div>`
          }
          // anéis pulsando
          ringsData={rings}
          ringLat={(d: any) => d.lat}
          ringLng={(d: any) => d.lng}
          ringColor={(d: any) => (t: number) => `${hexToRgba(d.color, 1 - t)}`}
          ringMaxRadius={(d: any) => d.maxR}
          ringPropagationSpeed={(d: any) => d.speed}
          ringRepeatPeriod={(d: any) => d.period}
          // arcos
          arcsData={arcs}
          arcColor={(d: any) => d.color}
          arcAltitude={0.25}
          arcStroke={0.45}
          arcDashLength={0.5}
          arcDashGap={0.6}
          arcDashAnimateTime={2600}
          // etiquetas com nome
          labelsData={points}
          labelLat={(d: any) => d.lat}
          labelLng={(d: any) => d.lng}
          labelText={(d: any) => d.name}
          labelSize={0.9}
          labelDotRadius={0.25}
          labelColor={(d: any) => d.color}
          labelResolution={2}
          labelAltitude={0.06}
        />
      </div>

      {/* rodapé: legenda + lista rápida */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
        <div className="flex items-center gap-3 text-[11px] text-gray-300 mb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" /> Pública — entra direto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]" /> Privada — pede senha
          </span>
        </div>
        {points.length === 0 ? (
          <p className="text-xs text-gray-500">
            {unlocated.length > 0
              ? `${unlocated.length} sala(s) sem localização ainda — o ponto aparece quando o criador é localizado.`
              : 'Nenhuma sala no mapa ainda. Crie uma sala e ela aparece aqui, na sua cidade.'}
          </p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {points.slice(0, 20).map((p) => (
              <button
                key={p.code}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  flyTo(p);
                  onPick(p);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold touch-manipulation ${
                  p.type === 'public'
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-100'
                    : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-100'
                }`}
                title={`${p.name} • ${p.code}${p.place ? ` • ${p.place}` : ''}`}
              >
                {p.type === 'public' ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span className="max-w-[120px] truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-xs text-gray-400 bg-[#05070c]">
          Carregando globo 3D…
        </div>
      )}
    </div>
  );
};

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

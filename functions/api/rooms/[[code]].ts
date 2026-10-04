/**
 * BANCO DE SALAS — Cloudflare Pages Function + KV
 * ------------------------------------------------
 * GET    /api/rooms          → lista todas as salas (JSON)
 * PUT    /api/rooms/:code    → cria/atualiza uma sala
 * DELETE /api/rooms/:code    → apaga (só quem tem o ownerId certo)
 *
 * Precisa de um KV namespace ligado como "LIVEDC_ROOMS" (ver CLOUDFLARE.md).
 * Sem o KV ligado, responde 503 e o site cai no modo P2P (só quem está online).
 */

interface Env {
  LIVEDC_ROOMS?: KVNamespace;
}

const KEY_INDEX = 'rooms:index'; // lista de códigos
const roomKey = (code: string) => `room:${code}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });

const isCode = (c: string) => /^\d{4,10}$/.test(c);

async function readIndex(kv: KVNamespace): Promise<string[]> {
  try {
    const raw = await kv.get(KEY_INDEX);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && isCode(x)) : [];
  } catch {
    return [];
  }
}

async function writeIndex(kv: KVNamespace, codes: string[]) {
  await kv.put(KEY_INDEX, JSON.stringify([...new Set(codes)].slice(0, 2000)));
}

function sanitize(input: any, code: string) {
  const type = input?.type === 'public' ? 'public' : 'private';
  return {
    name: String(input?.name || `Sala ${code}`).slice(0, 48),
    code,
    type,
    pwHash: input?.pwHash ? String(input.pwHash).slice(0, 32) : undefined,
    lat: typeof input?.lat === 'number' ? input.lat : undefined,
    lng: typeof input?.lng === 'number' ? input.lng : undefined,
    place: input?.place ? String(input.place).slice(0, 60) : undefined,
    createdAt: Number(input?.createdAt || Date.now()),
    createdBy: input?.createdBy ? String(input.createdBy).slice(0, 24) : undefined,
    updatedAt: Date.now(),
    visible: input?.visible !== false,
    ownerId: input?.ownerId ? String(input.ownerId).slice(0, 64) : undefined,
  };
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const kv = env.LIVEDC_ROOMS;
  if (!kv) {
    return json({ error: 'KV não configurado. Ligue um namespace como LIVEDC_ROOMS (veja CLOUDFLARE.md).' }, 503);
  }

  const url = new URL(request.url);
  // /api/rooms  ou  /api/rooms/123456  (rota [[code]] → ctx.params.code = ['123456'])
  const p: any = (ctx as any).params?.code;
  const code = Array.isArray(p) ? decodeURIComponent(String(p[0] || '')) : p ? decodeURIComponent(String(p)) : '';

  // ---------- LISTAR ----------
  if (method === 'GET' && !code) {
    const codes = await readIndex(kv);
    const rooms = await Promise.all(
      codes.map(async (c) => {
        try {
          const raw = await kv.get(roomKey(c));
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })
    );
    const list = rooms.filter(Boolean).map((r: any) => ({ ...r, ownerId: undefined })); // nunca expõe ownerId
    return json({ rooms: list, count: list.length, at: Date.now() });
  }

  if (!isCode(code)) return json({ error: 'código inválido' }, 400);

  // ---------- CRIAR / ATUALIZAR ----------
  if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: 'JSON inválido' }, 400);
    }
    const existingRaw = await kv.get(roomKey(code));
    const existing = existingRaw ? JSON.parse(existingRaw) : null;

    // se já existe e tem dono, só o dono altera
    if (existing?.ownerId && body?.ownerId && existing.ownerId !== body.ownerId) {
      return json({ error: 'só quem criou pode alterar esta sala' }, 403);
    }
    const merged = sanitize({ ...(existing || {}), ...body, ownerId: existing?.ownerId || body?.ownerId }, code);
    if (existing?.createdAt) merged.createdAt = existing.createdAt;

    await kv.put(roomKey(code), JSON.stringify(merged));
    const idx = await readIndex(kv);
    if (!idx.includes(code)) await writeIndex(kv, [code, ...idx]);
    return json({ ok: true, room: { ...merged, ownerId: undefined } });
  }

  // ---------- APAGAR ----------
  if (method === 'DELETE') {
    const ownerId = url.searchParams.get('ownerId') || '';
    const existingRaw = await kv.get(roomKey(code));
    if (!existingRaw) return json({ ok: true, deleted: false });
    const existing = JSON.parse(existingRaw);
    if (existing?.ownerId && existing.ownerId !== ownerId) {
      return json({ error: 'só quem criou pode apagar esta sala' }, 403);
    }
    await kv.delete(roomKey(code));
    const idx = await readIndex(kv);
    await writeIndex(kv, idx.filter((c) => c !== code));
    return json({ ok: true, deleted: true });
  }

  return json({ error: 'método não suportado' }, 405);
};

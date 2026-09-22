import React, { useMemo, useState } from 'react';
import {
  Users,
  Globe,
  Lock,
  Map as MapIcon,
  Monitor,
  ArrowRight,
  X,
  Clock,
  ChevronRight,
  Plus,
  LogOut,
  Trash2,
  Link2,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { RecentRoom, LobbyGroup } from '../utils/lobby';
import { parseRoomInput, codeFromRoomName } from '../utils/lobby';

export interface CreateRoomInput {
  name: string;
  code: string;
  type: 'public' | 'private';
  password: string;
  visible: boolean;
}

interface LobbyScreenProps {
  isOpen: boolean;
  userName: string;
  recentRooms: RecentRoom[];
  groups: LobbyGroup[];
  publicRooms: RecentRoom[];
  onCreateRoom: (input: CreateRoomInput) => void;
  onJoinRoom: (code: string, name?: string) => void;
  onRemoveRecent: (code: string) => void;
  onChangeName: () => void;
}

type View = 'home' | 'public' | 'map' | 'groups';

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  isOpen,
  userName,
  recentRooms,
  groups,
  publicRooms,
  onCreateRoom,
  onJoinRoom,
  onRemoveRecent,
  onChangeName,
}) => {
  const [roomType, setRoomType] = useState<'public' | 'private'>('public');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('home');

  const parsed = useMemo(() => parseRoomInput(roomNameInput), [roomNameInput]);
  const totalOnline = useMemo(() => groups.reduce((a, g) => a + g.online, 0), [groups]);

  if (!isOpen) return null;

  const isLinkOrCode = /^https?:\/\//i.test(roomNameInput.trim()) || /^\d{4,10}$/.test(roomNameInput.trim());

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const raw = roomNameInput.trim();

    // colou link/código → entra (não cria)
    if (raw && isLinkOrCode) {
      const p = parseRoomInput(raw);
      if (!p) {
        setError('Link ou código inválido.');
        return;
      }
      onJoinRoom(p.code, p.name);
      return;
    }

    if (!raw) {
      setError('Digite o nome da sala.');
      return;
    }
    const p = parseRoomInput(raw);
    if (!p) {
      setError('Nome inválido. Use letras, números, "-" ou "_".');
      return;
    }
    if (roomType === 'private') {
      const pw = password.trim();
      if (!pw) {
        setError('Sala privada precisa de senha.');
        return;
      }
      if (pw.length < 3) {
        setError('A senha precisa ter pelo menos 3 caracteres.');
        return;
      }
    }
    onCreateRoom({
      name: p.name,
      code: p.code,
      type: roomType,
      password: roomType === 'private' ? password.trim() : '',
      visible,
    });
  };

  const Header = () => (
    <div className="flex items-center justify-between gap-2 px-4 sm:px-6 pt-4 sm:pt-5">
      <div className="flex items-center gap-2">
        <span className="bg-teal-500 text-[10px] font-black px-1.5 py-0.5 rounded uppercase text-white">
          Beta
        </span>
        <span className="text-white font-black text-lg tracking-tight">LiveDC</span>
      </div>
      <button
        onClick={onChangeName}
        className="flex items-center gap-2 text-xs text-gray-300 hover:text-white bg-[#1b1f28] hover:bg-[#232838] border border-[#2a3145] rounded-xl px-3 py-1.5 touch-manipulation"
        title="Trocar nome"
      >
        <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-[11px] font-bold text-white">
          {userName.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-[120px] truncate">{userName}</span>
        <LogOut className="w-3.5 h-3.5 text-gray-500" />
      </button>
    </div>
  );

  const GroupCard = ({ g }: { g: LobbyGroup }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#161a22] border border-[#232c3f]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">
          {g.emoji}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-100 truncate">{g.name}</p>
          <p className="text-[11px] text-gray-400 truncate">
            {g.role} · {g.members} membros ·{' '}
            <span className="text-emerald-400 font-semibold">{g.online} online</span>
          </p>
        </div>
      </div>
      <button
        onClick={() => onJoinRoom(g.code, g.name)}
        className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold touch-manipulation"
      >
        Abrir
      </button>
    </div>
  );

  const RecentItem = ({ r }: { r: RecentRoom }) => (
    <div className="group flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#161a22] hover:bg-[#1a2030] border border-[#232c3f] transition-colors">
      <button
        onClick={() => onJoinRoom(r.code, r.name)}
        className="flex-1 min-w-0 text-left touch-manipulation"
      >
        <p className="text-sm font-semibold text-gray-100 truncate flex items-center gap-1.5">
          {r.type === 'public' ? (
            <Globe className="w-3 h-3 text-sky-400 shrink-0" />
          ) : (
            <Lock className="w-3 h-3 text-yellow-400 shrink-0" />
          )}
          {r.name}
        </p>
        <p className="text-[11px] font-mono text-gray-400">{r.code}</p>
      </button>
      <button
        onClick={() => onRemoveRecent(r.code)}
        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 sm:opacity-100 touch-manipulation"
        title="Remover das recentes"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[95] bg-[#0d0f12] overflow-y-auto">
      <div className="min-h-full flex flex-col">
        <Header />

        <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
          {/* ---------------- HOME ---------------- */}
          {view === 'home' && (
            <>
              {/* Grupos */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-300" />
                    <h2 className="text-base font-bold text-white">Grupos</h2>
                    <span className="bg-[#1f2533] text-gray-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#2b3548]">
                      {groups.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setView('groups')}
                    className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold touch-manipulation"
                  >
                    Ver todos
                  </button>
                </div>
                {groups.slice(0, 1).map((g) => (
                  <GroupCard key={g.id} g={g} />
                ))}
              </section>

              {/* Hero */}
              <section className="rounded-3xl bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-transparent border border-emerald-500/30 p-5 sm:p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-600/30 shrink-0">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      Transmitir tela online em grupo, grátis
                    </h1>
                    <p className="text-sm text-gray-300 mt-1">
                      Compartilhe sua tela com quem estiver na mesma sala, sem cadastro.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setView('public')}
                    className="py-2.5 px-3 rounded-xl bg-[#1b1f28] hover:bg-[#232838] border border-[#2a3145] text-gray-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <Globe className="w-4 h-4 text-sky-400" />
                    Ver salas públicas
                  </button>
                  <button
                    onClick={() => setView('map')}
                    className="py-2.5 px-3 rounded-xl bg-[#1b1f28] hover:bg-[#232838] border border-[#2a3145] text-gray-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <MapIcon className="w-4 h-4 text-amber-400" />
                    Ver mapa de salas
                  </button>
                </div>
              </section>

              {/* Salas recentes */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <h2 className="text-base font-bold text-white">Salas recentes</h2>
                </div>
                {recentRooms.length === 0 ? (
                  <p className="text-xs text-gray-500 bg-[#12151b] border border-[#1f2533] rounded-xl p-4 text-center">
                    Nenhuma sala ainda. Crie uma abaixo ou entre por um link.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recentRooms.map((r) => (
                      <RecentItem key={r.code} r={r} />
                    ))}
                  </div>
                )}
              </section>

              {/* Criar sala */}
              <section className="space-y-3 rounded-3xl bg-[#12151b] border border-[#1f2533] p-4 sm:p-5">
                <div>
                  <p className="text-sm font-bold text-white mb-2">Que tipo de sala?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRoomType('public')}
                      className={`py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 touch-manipulation ${
                        roomType === 'public'
                          ? 'bg-sky-500/15 border-sky-500 text-sky-200'
                          : 'bg-[#161a22] border-[#232c3f] text-gray-300'
                      }`}
                    >
                      <Globe className="w-4 h-4" /> Pública
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoomType('private')}
                      className={`py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 touch-manipulation ${
                        roomType === 'private'
                          ? 'bg-yellow-500/15 border-yellow-500 text-yellow-200'
                          : 'bg-[#161a22] border-[#232c3f] text-gray-300'
                      }`}
                    >
                      <Lock className="w-4 h-4" /> Privada
                    </button>
                  </div>
                </div>

                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-white block">Nome da sala</label>
                    <input
                      type="text"
                      value={roomNameInput}
                      onChange={(e) => {
                        setRoomNameInput(e.target.value);
                        setError('');
                      }}
                      placeholder="Ex: reuniao-time (ou link)"
                      autoComplete="off"
                      className="w-full bg-[#0d1017] border border-[#2c364d] focus:border-emerald-500 text-sm rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none"
                    />
                    <p className="text-[11px] text-gray-500">
                      {isLinkOrCode && parsed ? (
                        <span className="text-sky-300 inline-flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> vai entrar na sala {parsed.code}
                        </span>
                      ) : (
                        <>
                          {roomType === 'public'
                            ? 'Aparece na lista de salas públicas.'
                            : 'Só entra quem tiver o link e a senha.'}
                          {parsed && roomNameInput.trim() && (
                            <span className="ml-1 font-mono text-emerald-400">
                              código {codeFromRoomName(parsed.name)}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Senha — só na PRIVADA */}
                  {roomType === 'private' && !isLinkOrCode && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-white flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-yellow-400" /> Senha da sala
                      </label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setError('');
                          }}
                          placeholder="Crie uma senha (mín. 3 caracteres)"
                          autoComplete="new-password"
                          className="w-full bg-[#0d1017] border border-yellow-500/40 focus:border-yellow-400 text-sm rounded-xl px-4 py-3 pr-11 text-yellow-100 placeholder-gray-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-white touch-manipulation"
                          aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Quem entrar pelo link vai precisar digitar essa senha.
                      </p>
                    </div>
                  )}

                  {/* Visibilidade — pública e privada */}
                  {!isLinkOrCode && (
                    <label className="flex items-start gap-3 p-3 rounded-xl bg-[#161a22] border border-[#232c3f] cursor-pointer touch-manipulation">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => setVisible(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="text-sm font-semibold text-gray-100 flex items-center gap-1.5">
                          {visible ? (
                            <Eye className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                          {visible ? 'Mostrar nas salas recentes' : 'Deixar invisível'}
                        </span>
                        <span className="block text-[11px] text-gray-500 mt-0.5">
                          {visible
                            ? 'A sala aparece na sua lista de salas recentes.'
                            : 'A sala fica escondida — só quem tiver o link entra.'}
                        </span>
                      </span>
                    </label>
                  )}

                  {error && (
                    <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 touch-manipulation"
                  >
                    {isLinkOrCode && parsed ? (
                      <>
                        Entrar na sala <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Criar sala
                      </>
                    )}
                  </button>
                </form>
              </section>
            </>
          )}

          {/* ---------------- GRUPOS ---------------- */}
          {view === 'groups' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-300" /> Seus grupos
                  <span className="text-xs text-gray-400 font-normal">
                    ({totalOnline} online agora)
                  </span>
                </h2>
                <button onClick={() => setView('home')} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 touch-manipulation">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {groups.map((g) => (
                <GroupCard key={g.id} g={g} />
              ))}
              <p className="text-[11px] text-gray-500 text-center pt-2">
                Cada grupo tem uma sala fixa — todo mundo do grupo cai na mesma call.
              </p>
            </section>
          )}

          {/* ---------------- SALAS PÚBLICAS ---------------- */}
          {view === 'public' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400" /> Salas públicas
                </h2>
                <button onClick={() => setView('home')} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 touch-manipulation">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {publicRooms.length === 0 ? (
                <div className="text-center bg-[#12151b] border border-[#1f2533] rounded-2xl p-6 space-y-2">
                  <Globe className="w-8 h-8 text-sky-400/60 mx-auto" />
                  <p className="text-sm text-gray-300 font-semibold">Nenhuma sala pública ainda</p>
                  <p className="text-xs text-gray-500">
                    Crie uma sala marcando <b>Pública</b> — ela aparece aqui pra quem usar este
                    navegador.
                  </p>
                  <button
                    onClick={() => {
                      setRoomType('public');
                      setView('home');
                    }}
                    className="mt-1 px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-200 text-xs font-bold touch-manipulation"
                  >
                    Criar sala pública
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {publicRooms.map((r) => (
                    <RecentItem key={r.code} r={r} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ---------------- MAPA ---------------- */}
          {view === 'map' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-amber-400" /> Mapa de salas
                </h2>
                <button onClick={() => setView('home')} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 touch-manipulation">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-2xl overflow-hidden border border-[#1f2533] bg-[#0f131a] aspect-[16/10]">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'linear-gradient(#1f2a3d 1px, transparent 1px), linear-gradient(90deg, #1f2a3d 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}
                />
                {/* pins: salas recentes + grupos */}
                {[...recentRooms.slice(0, 5), ...groups.map((g) => ({ name: g.name, code: g.code, type: 'public' as const, lastJoined: 0 }))]
                  .slice(0, 8)
                  .map((r, i) => {
                    const seed = parseInt(r.code, 10) || i * 7919;
                    const left = 10 + ((seed * 37) % 80);
                    const top = 12 + ((seed * 53) % 70);
                    return (
                      <button
                        key={`${r.code}-${i}`}
                        onClick={() => onJoinRoom(r.code, r.name)}
                        style={{ left: `${left}%`, top: `${top}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group touch-manipulation"
                        title={`${r.name} • ${r.code}`}
                      >
                        <span className="block w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 group-hover:scale-125 transition-transform" />
                        <span className="absolute left-1/2 -translate-x-1/2 top-4 whitespace-nowrap text-[10px] font-semibold text-gray-200 bg-black/70 px-1.5 py-0.5 rounded border border-white/10">
                          {r.name}
                        </span>
                      </button>
                    );
                  })}
                {recentRooms.length === 0 && groups.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    Nenhuma sala no mapa ainda.
                  </div>
                )}
              </div>
              <p className="text-[11px] text-gray-500 text-center">
                Toque num ponto para entrar na sala. Posições são ilustrativas (P2P não expõe
                localização real).
              </p>
            </section>
          )}
        </div>

        <p className="text-[10px] text-center text-gray-600 pb-4">
          🔒 Conexão P2P criptografada · funciona no celular e no PC
        </p>
      </div>
    </div>
  );
};

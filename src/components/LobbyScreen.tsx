import React, { useMemo, useState, Suspense, lazy } from 'react';
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
  Search,
  MapPin,
} from 'lucide-react';
import type { RecentRoom, LobbyGroup } from '../utils/lobby';
import { parseRoomInput, codeFromRoomName, searchRooms } from '../utils/lobby';
import { hashPassword as hashPw } from '../utils/room';

// globo 3D só carrega quando o usuário abre o mapa (mantém o site leve)
const RoomsGlobe = lazy(() => import('./RoomsGlobe').then((m) => ({ default: m.RoomsGlobe })));

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
  privateRooms: RecentRoom[];
  onCreateRoom: (input: CreateRoomInput) => void;
  /** entra numa sala (senha só é passada quando a privada foi validada) */
  onJoinRoom: (code: string, name?: string, password?: string) => void;
  onRemoveRecent: (code: string) => void;
  onChangeName: () => void;
}

type View = 'home' | 'public' | 'private' | 'map' | 'groups';


/* ------------------------------------------------------------------ */
/* Componentes FORA do LobbyScreen: assim o input de busca não é       */
/* recriado a cada tecla (isso fazia perder o foco e "não pesquisar"). */
/* ------------------------------------------------------------------ */

const SearchBox: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    <input
      type="text"
      inputMode="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      autoFocus
      className="w-full bg-[#0d1017] border border-[#2c364d] focus:border-emerald-500 text-sm rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-gray-500 outline-none"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-white touch-manipulation"
        aria-label="Limpar busca"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

const RoomRow: React.FC<{
  r: RecentRoom;
  removable?: boolean;
  onOpen: (r: RecentRoom) => void;
  onRemove?: (code: string) => void;
}> = ({ r, removable, onOpen, onRemove }) => (
  <div className="group flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#161a22] hover:bg-[#1a2030] border border-[#232c3f] transition-colors">
    <button onClick={() => onOpen(r)} className="flex-1 min-w-0 text-left touch-manipulation">
      <p className="text-sm font-semibold text-gray-100 truncate flex items-center gap-1.5">
        {r.type === 'public' ? (
          <Globe className="w-3 h-3 text-sky-400 shrink-0" />
        ) : (
          <Lock className="w-3 h-3 text-yellow-400 shrink-0" />
        )}
        {r.name}
        {r.createdByMe && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.5 rounded">
            sua
          </span>
        )}
      </p>
      <p className="text-[11px] text-gray-400 flex items-center gap-2 min-w-0">
        <span className="font-mono shrink-0">{r.code}</span>
        {r.place && (
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{r.place}</span>
          </span>
        )}
        {r.createdBy && <span className="truncate text-gray-500">· por {r.createdBy}</span>}
      </p>
    </button>
    {removable && onRemove && (
      <button
        onClick={() => onRemove(r.code)}
        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 sm:opacity-100 touch-manipulation"
        title="Remover"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )}
    <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
  </div>
);

const RoomListView: React.FC<{
  title: string;
  icon: React.ReactNode;
  rooms: RecentRoom[];
  query: string;
  onQuery: (v: string) => void;
  empty: string;
  emptyAction?: React.ReactNode;
  onOpen: (r: RecentRoom) => void;
  onRemove: (code: string) => void;
  onClose: () => void;
}> = ({ title, icon, rooms, query, onQuery, empty, emptyAction, onOpen, onRemove, onClose }) => {
  const filtered = useMemo(() => searchRooms(rooms, query), [rooms, query]);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          {icon} {title}
          <span className="text-xs text-gray-400 font-normal">
            ({query ? `${filtered.length} de ${rooms.length}` : rooms.length})
          </span>
        </h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 touch-manipulation">
          <X className="w-4 h-4" />
        </button>
      </div>
      <SearchBox value={query} onChange={onQuery} placeholder="Pesquisar por nome, código, cidade ou criador…" />
      {rooms.length === 0 ? (
        <div className="text-center bg-[#12151b] border border-[#1f2533] rounded-2xl p-6 space-y-2">
          {icon}
          <p className="text-sm text-gray-300 font-semibold">{empty}</p>
          {emptyAction}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-6">Nada encontrado para “{query}”.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => (
            <RoomRow key={r.code} r={r} removable={r.createdByMe} onOpen={onOpen} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  );
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  isOpen,
  userName,
  recentRooms,
  groups,
  publicRooms,
  privateRooms,
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
  const [query, setQuery] = useState('');
  const [pwPrompt, setPwPrompt] = useState<RecentRoom | null>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const parsed = useMemo(() => parseRoomInput(roomNameInput), [roomNameInput]);
  const totalOnline = useMemo(() => groups.reduce((a, g) => a + g.online, 0), [groups]);
  const allMapRooms = useMemo(() => {
    const byCode = new Map<string, RecentRoom>();
    [...publicRooms, ...privateRooms, ...recentRooms].forEach((r) => byCode.set(r.code, r));
    return [...byCode.values()];
  }, [publicRooms, privateRooms, recentRooms]);

  if (!isOpen) return null;

  const isLinkOrCode = /^https?:\/\//i.test(roomNameInput.trim()) || /^\d{4,10}$/.test(roomNameInput.trim());

  /** Clique numa sala: pública entra direto; privada pede senha (a menos que seja minha). */
  const tryOpenRoom = (r: RecentRoom) => {
    if (r.type === 'private') {
      if (r.createdByMe && r.password) {
        onJoinRoom(r.code, r.name, r.password);
        return;
      }
      setPwPrompt(r);
      setPwInput('');
      setPwError('');
      return;
    }
    onJoinRoom(r.code, r.name);
  };

  const confirmPassword = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pwPrompt) return;
    const typed = pwInput.trim();
    if (!typed) {
      setPwError('Digite a senha da sala.');
      return;
    }
    // valida: pela senha (se é minha) ou pelo hash (sala de outra pessoa vinda do diretório)
    if (pwPrompt.password && typed !== pwPrompt.password) {
      setPwError('Senha incorreta.');
      return;
    }
    if (!pwPrompt.password && pwPrompt.pwHash && hashPw(typed) !== pwPrompt.pwHash) {
      setPwError('Senha incorreta. Peça a senha pra quem criou a sala.');
      return;
    }
    const r = pwPrompt;
    setPwPrompt(null);
    onJoinRoom(r.code, r.name, typed);
  };

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const raw = roomNameInput.trim();
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

  const goHome = () => {
    setView('home');
    setQuery('');
  };

  // ------------------------------------------------------------------ UI bits
  const Header = () => (
    <div className="flex items-center justify-between gap-2 px-4 sm:px-6 pt-4 sm:pt-5">
      <button onClick={goHome} className="flex items-center gap-2 touch-manipulation">
        <span className="bg-teal-500 text-[10px] font-black px-1.5 py-0.5 rounded uppercase text-white">
          Beta
        </span>
        <span className="text-white font-black text-lg tracking-tight">LiveDC</span>
      </button>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onChangeName}
          className="flex items-center gap-2 text-xs text-gray-300 hover:text-white bg-[#1b1f28] hover:bg-[#232838] border border-[#2a3145] rounded-xl px-3 py-1.5 touch-manipulation"
          title="Trocar nome"
        >
          <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-[11px] font-bold text-white">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span className="max-w-[100px] truncate hidden sm:inline">{userName}</span>
          <LogOut className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>
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

  const RoomItem = ({ r, removable }: { r: RecentRoom; removable?: boolean }) => (
    <RoomRow r={r} removable={removable} onOpen={tryOpenRoom} onRemove={onRemoveRecent} />
  );

  return (
    <div className="fixed inset-0 z-[95] bg-[#0d0f12] overflow-y-auto">
      <div className="min-h-full flex flex-col">
        <Header />

        <div className={`flex-1 w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6 ${view === 'map' ? 'max-w-5xl' : 'max-w-2xl'}`}>
          {/* ---------------- HOME ---------------- */}
          {view === 'home' && (
            <>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setQuery('');
                      setView('public');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#1b1f28] hover:bg-[#232838] border border-[#2a3145] text-gray-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <Globe className="w-4 h-4 text-sky-400" />
                    Ver salas públicas
                    <span className="text-[10px] text-gray-500">({publicRooms.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuery('');
                      setView('private');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#1b1f28] hover:bg-[#232838] border border-[#2a3145] text-gray-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <Lock className="w-4 h-4 text-yellow-400" />
                    Ver salas privadas
                    <span className="text-[10px] text-gray-500">({privateRooms.length})</span>
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

              <section className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <h2 className="text-base font-bold text-white">Salas recentes</h2>
                  <span className="text-[11px] text-gray-500">(criadas por você)</span>
                </div>
                {recentRooms.length === 0 ? (
                  <p className="text-xs text-gray-500 bg-[#12151b] border border-[#1f2533] rounded-xl p-4 text-center">
                    Nenhuma sala ainda. Crie uma abaixo — ela fica salva no arquivo de salas.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recentRooms.map((r) => (
                      <RoomItem key={r.code} r={r} removable />
                    ))}
                  </div>
                )}
              </section>

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
                            : 'Aparece na lista de salas privadas (pede senha pra entrar).'}
                          {parsed && roomNameInput.trim() && (
                            <span className="ml-1 font-mono text-emerald-400">
                              código {codeFromRoomName(parsed.name)}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>

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
                    </div>
                  )}

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
                          {visible ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                          {visible ? 'Mostrar nas listas e no mapa' : 'Deixar invisível'}
                        </span>
                        <span className="block text-[11px] text-gray-500 mt-0.5">
                          {visible
                            ? 'Aparece em Salas recentes, na lista pública/privada e no mapa.'
                            : 'Fica escondida — só quem tiver o link entra.'}
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
                  <span className="text-xs text-gray-400 font-normal">({totalOnline} online agora)</span>
                </h2>
                <button onClick={goHome} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 touch-manipulation">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {groups.map((g) => (
                <GroupCard key={g.id} g={g} />
              ))}
            </section>
          )}

          {/* ---------------- PÚBLICAS ---------------- */}
          {view === 'public' && (
            <RoomListView
              title="Salas públicas"
              icon={<Globe className="w-4 h-4 text-sky-400 mx-auto" />}
              rooms={publicRooms}
              query={query}
              onQuery={setQuery}
              onOpen={tryOpenRoom}
              onRemove={onRemoveRecent}
              onClose={goHome}
              empty="Nenhuma sala pública ainda"
              emptyAction={
                <button
                  onClick={() => {
                    setRoomType('public');
                    goHome();
                  }}
                  className="mt-1 px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-200 text-xs font-bold touch-manipulation"
                >
                  Criar sala pública
                </button>
              }
            />
          )}

          {/* ---------------- PRIVADAS ---------------- */}
          {view === 'private' && (
            <RoomListView
              title="Salas privadas"
              icon={<Lock className="w-4 h-4 text-yellow-400 mx-auto" />}
              rooms={privateRooms}
              query={query}
              onQuery={setQuery}
              onOpen={tryOpenRoom}
              onRemove={onRemoveRecent}
              onClose={goHome}
              empty="Nenhuma sala privada ainda"
              emptyAction={
                <button
                  onClick={() => {
                    setRoomType('private');
                    goHome();
                  }}
                  className="mt-1 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 text-xs font-bold touch-manipulation"
                >
                  Criar sala privada
                </button>
              }
            />
          )}

          {/* ---------------- MAPA 3D ---------------- */}
          {view === 'map' && (
            <section className="space-y-3">
              <Suspense
                fallback={
                  <div className="rounded-3xl border border-[#1f2533] bg-[#05070c] h-[62vh] min-h-[340px] flex flex-col items-center justify-center gap-3 text-gray-400">
                    <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                    <p className="text-xs">Carregando mapa 3D…</p>
                  </div>
                }
              >
                <RoomsGlobe rooms={allMapRooms} onPick={tryOpenRoom} onClose={goHome} />
              </Suspense>
              <p className="text-[11px] text-gray-500 text-center">
                Gire o globo com o dedo/mouse, dê zoom com pinça/scroll e toque num ponto para entrar.
                Salas privadas pedem a senha. Posições são ilustrativas.
              </p>
            </section>
          )}
        </div>

        <p className="text-[10px] text-center text-gray-600 pb-4">
          🔒 Conexão P2P criptografada · funciona no celular e no PC
        </p>
      </div>

      {/* ---------------- MODAL: SENHA DA PRIVADA ---------------- */}
      {pwPrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={confirmPassword}
            className="bg-[#141822] border border-yellow-500/40 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/40 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-yellow-300" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{pwPrompt.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {pwPrompt.code}
                    {pwPrompt.place ? ` · ${pwPrompt.place}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPwPrompt(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-yellow-400" /> Senha da sala
              </label>
              <input
                autoFocus
                type="password"
                value={pwInput}
                onChange={(e) => {
                  setPwInput(e.target.value);
                  setPwError('');
                }}
                placeholder="Digite a senha"
                className="w-full bg-[#0d1017] border border-yellow-500/40 focus:border-yellow-400 text-sm rounded-xl px-4 py-3 text-yellow-100 placeholder-gray-500 outline-none"
              />
              {pwError && <p className="text-[11px] text-red-300 mt-1.5">{pwError}</p>}
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm flex items-center justify-center gap-2 touch-manipulation"
            >
              Entrar <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

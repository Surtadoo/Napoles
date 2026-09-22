import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Crown,
  Users,
  Ban,
  ChevronRight,
  ArrowLeft,
  Mic,
  Monitor,
  Video,
  PlaySquare,
  MessageSquare,
  Image as ImageIcon,
  Palette,
  Check,
  UserX,
  Shield,
} from 'lucide-react';
import type { Participant, RoomSettings, RoomPermissions, AdminCaps, AdminLevel } from '../types';

type Screen = 'menu' | 'admins' | 'limit' | 'bans' | 'permissions' | 'kick' | 'participants';

interface ManageRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettings;
  participants: Participant[];
  /** sessionId de cada participante remoto, por id */
  sessionIdOf: (participantId: string) => string | undefined;
  onSetPermission: (key: keyof RoomPermissions, value: boolean) => void;
  onSetMaxParticipants: (max: number) => void;
  onToggleAdmin: (sessionId: string) => void;
  onBan: (participantId: string, name: string) => void;
  onUnban: (sessionId: string) => void;
  onKick?: (participantId: string, name: string) => void;
  /** true = dono (vê tudo). false = admin (vê só o que tem permissão) */
  isOwner: boolean;
  canBan: boolean;
  canKick: boolean;
  /** capacidades calculadas pelo nível (admin) */
  caps: AdminCaps;
  /** meu nível (dono = 3) */
  myLevel: AdminLevel;
  onSetAdminLevel: (sessionId: string, level: AdminLevel) => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors touch-manipulation ${
        on ? 'bg-emerald-500' : 'bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

const PERMISSION_ROWS: {
  key: keyof RoomPermissions;
  label: string;
  icon: React.ReactNode;
  section?: string;
}[] = [
  { key: 'mic', label: 'Permitir que todos liguem o microfone', icon: <Mic className="w-4 h-4" /> },
  { key: 'screen', label: 'Permitir que todos compartilhem sua tela', icon: <Monitor className="w-4 h-4" /> },
  { key: 'camera', label: 'Permitir que todos liguem sua câmera', icon: <Video className="w-4 h-4" /> },
  { key: 'videoSource', label: 'Permitir que todos adicionem uma fonte de vídeo', icon: <PlaySquare className="w-4 h-4" /> },
  { key: 'chat', label: 'Permitir que todos enviem mensagens no chat', icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'gifs', label: 'Permitir que todos enviem GIFS', icon: <span className="text-[9px] font-black tracking-tight">GIF</span> },
  { key: 'images', label: 'Permitir que todos enviem imagens', icon: <ImageIcon className="w-4 h-4" /> },
  { key: 'theme', label: 'Permitir que Pro Max troquem o tema da sala', icon: <Palette className="w-4 h-4" /> },
  // ---- poderes dos administradores ----
  { key: 'adminCanBan', label: 'Permitir que administradores banam pessoas', icon: <Ban className="w-4 h-4 text-red-400" />, section: 'Poderes dos administradores' },
  { key: 'adminCanKick', label: 'Permitir que administradores desconectem pessoas da call', icon: <UserX className="w-4 h-4 text-orange-400" /> },
  // ---- níveis de admin ----
  {
    key: 'adminLv1',
    label: 'Permitir que ADM LV1 mexa em: Limite de participantes e Desconectar da call',
    icon: <span className="text-[10px] font-black text-sky-300">LV1</span>,
    section: 'Níveis de administrador',
  },
  {
    key: 'adminLv2',
    label: 'Permitir que ADM LV2 mexa em: Participantes, Banimentos, Gerenciar administradores e Desconectar da call',
    icon: <span className="text-[10px] font-black text-violet-300">LV2</span>,
  },
  {
    key: 'adminLv3',
    label: 'Permitir que ADM LV3 mexa em: Participantes, Banimentos, Gerenciar administradores, Desconectar da call e Gerenciar permissões',
    icon: <span className="text-[10px] font-black text-amber-300">LV3</span>,
  },
  // ---- coroas ----
  { key: 'showOwnerCrown', label: 'Mostrar a coroa do administrador principal (dono)', icon: <Crown className="w-4 h-4 text-yellow-400" />, section: 'Coroas' },
  { key: 'showAdminCrown', label: 'Mostrar a coroa de quem virou administrador', icon: <Crown className="w-4 h-4 text-amber-300" /> },
];

const LIMIT_OPTIONS = [0, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 50];

export const ManageRoomModal: React.FC<ManageRoomModalProps> = ({
  isOpen,
  onClose,
  settings,
  participants,
  sessionIdOf,
  onSetPermission,
  onSetMaxParticipants,
  onToggleAdmin,
  onBan,
  onUnban,
  onKick,
  isOwner,
  canBan,
  canKick,
  caps,
  myLevel,
  onSetAdminLevel,
}) => {
  const [screen, setScreen] = useState<Screen>('menu');

  useEffect(() => {
    if (isOpen) setScreen('menu');
  }, [isOpen]);

  if (!isOpen) return null;

  // admin não pode mexer no dono; dono não aparece como alvo pra ninguém
  const others = participants.filter((p) => p.id !== 'current-user' && !p.isOwner);
  const limitLabel = settings.maxParticipants > 0 ? `${settings.maxParticipants} pessoas` : 'sem limite';
  // abas visíveis = dono tudo; admin conforme nível/toggles
  const showAdmins = isOwner || caps.admins;
  const showLimit = isOwner || caps.limit;
  const showBans = isOwner || canBan || caps.ban;
  const showKick = isOwner || canKick || caps.kick;
  const showPerms = isOwner || caps.permissions;
  const showParticipants = isOwner || caps.participants;
  const levelOf = (sid?: string): AdminLevel =>
    (sid && (settings.adminLevels?.[sid] as AdminLevel)) || 1;
  const LEVEL_STYLE: Record<AdminLevel, string> = {
    1: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
    2: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
    3: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  };

  const Header = ({ title, back }: { title: string; back?: boolean }) => (
    <div className="p-4 border-b border-[#212a3d] flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {back && (
          <button
            onClick={() => setScreen('menu')}
            className="p-1 -ml-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 touch-manipulation"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <Settings className="w-4 h-4 text-gray-300 shrink-0" />
        <h3 className="font-bold text-gray-100 text-sm truncate">{title}</h3>
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 touch-manipulation"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const MenuRow = ({
    icon,
    label,
    right,
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    right?: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-[#1b1f28] hover:bg-[#232838] border border-[#2a3145] text-left transition-colors touch-manipulation"
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0">{icon}</span>
        <span className="text-sm font-semibold text-gray-100 truncate">{label}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0 text-gray-400">
        {right}
        <ChevronRight className="w-4 h-4" />
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* ---------- MENU ---------- */}
        {screen === 'menu' && (
          <>
            <Header
              title={
                isOwner
                  ? 'Gerenciar sala'
                  : `Gerenciar sala (ADM LV${myLevel})`
              }
            />
            <div className="p-3 space-y-2">
              {showParticipants && (
                <MenuRow
                  icon={<Users className="w-4 h-4 text-emerald-400" />}
                  label="Participantes"
                  right={<span className="text-xs text-gray-400">{participants.length} na sala</span>}
                  onClick={() => setScreen('participants')}
                />
              )}
              {showAdmins && (
                <MenuRow
                  icon={<Crown className="w-4 h-4 text-yellow-400" />}
                  label="Gerenciar administradores"
                  right={
                    settings.admins.length > 0 ? (
                      <span className="text-xs text-gray-400">{settings.admins.length}</span>
                    ) : undefined
                  }
                  onClick={() => setScreen('admins')}
                />
              )}
              {showLimit && (
                <MenuRow
                  icon={<Users className="w-4 h-4 text-sky-400" />}
                  label="Limite de participantes"
                  right={<span className="text-xs text-gray-400">{limitLabel}</span>}
                  onClick={() => setScreen('limit')}
                />
              )}
              {showBans && (
                <MenuRow
                  icon={<Ban className="w-4 h-4 text-red-400" />}
                  label="Banimentos"
                  right={
                    settings.banned.length > 0 ? (
                      <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">
                        {settings.banned.length}
                      </span>
                    ) : undefined
                  }
                  onClick={() => setScreen('bans')}
                />
              )}
              {showKick && (
                <MenuRow
                  icon={<UserX className="w-4 h-4 text-orange-400" />}
                  label="Desconectar da call"
                  right={<span className="text-xs text-gray-400">{others.length} na sala</span>}
                  onClick={() => setScreen('kick')}
                />
              )}
              {showPerms && (
                <MenuRow
                  icon={<Settings className="w-4 h-4 text-gray-300" />}
                  label="Gerenciar permissões"
                  onClick={() => setScreen('permissions')}
                />
              )}
              {!isOwner && !showBans && !showKick && !showLimit && !showAdmins && !showPerms && !showParticipants && (
                <p className="text-xs text-gray-500 text-center py-6 px-3">
                  Você é ADM LV{myLevel}, mas o dono desligou os poderes do seu nível.
                  Você ainda ignora as permissões desativadas (mic, tela, chat…).
                </p>
              )}
              {!isOwner && (
                <p className="text-[10px] text-gray-500 text-center pt-2 px-3">
                  Seu nível: <b className="text-gray-300">ADM LV{myLevel}</b> · o dono define o nível
                  e o que cada nível pode fazer.
                </p>
              )}
            </div>
          </>
        )}

        {/* ---------- PARTICIPANTES ---------- */}
        {screen === 'participants' && (
          <>
            <Header title="Participantes" back />
            <div className="p-4 space-y-2 overflow-y-auto">
              <p className="text-xs text-gray-400 leading-relaxed">
                Todo mundo na sala agora ({participants.length}).
              </p>
              {participants.map((p) => {
                const sid = p.id === 'current-user' ? undefined : sessionIdOf(p.id);
                const isAdm = p.isAdmin || (!!sid && settings.admins.includes(sid));
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#161a22] border border-[#232c3f]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-100 truncate flex items-center gap-1">
                          {p.name}
                          {p.isOwner && <Crown className="w-3 h-3 text-yellow-400" />}
                          {!p.isOwner && isAdm && <Shield className="w-3 h-3 text-amber-300" />}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {p.isOwner
                            ? 'Dono da sala'
                            : isAdm
                              ? `ADM LV${levelOf(sid)}`
                              : p.id === 'current-user'
                                ? 'Você'
                                : 'Participante'}
                          {p.isScreenSharing ? ' · transmitindo' : p.isCameraOn ? ' · câmera' : ''}
                          {p.isMuted ? ' · mudo' : ''}
                        </p>
                      </div>
                    </div>
                    {p.id !== 'current-user' && !p.isOwner && (
                      <div className="flex items-center gap-1 shrink-0">
                        {showKick && (
                          <button
                            onClick={() => {
                              if (confirm(`Desconectar ${p.name} da call?`)) onKick?.(p.id, p.name);
                            }}
                            className="p-1.5 rounded-lg bg-orange-600/15 text-orange-300 border border-orange-500/30 touch-manipulation"
                            title="Desconectar"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {showBans && (
                          <button
                            onClick={() => {
                              if (confirm(`Banir ${p.name}?`)) onBan(p.id, p.name);
                            }}
                            className="p-1.5 rounded-lg bg-red-600/15 text-red-300 border border-red-500/30 touch-manipulation"
                            title="Banir"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ---------- DESCONECTAR ---------- */}
        {screen === 'kick' && (
          <>
            <Header title="Desconectar da call" back />
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-400 leading-relaxed">
                A pessoa sai da call na hora, mas pode entrar de novo pelo link (não é banimento).
              </p>
              {others.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">Ninguém mais na sala.</p>
              ) : (
                <div className="space-y-1.5">
                  {others.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#161a22] border border-[#232c3f]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                        <p className="text-xs font-semibold text-gray-100 truncate flex items-center gap-1">
                          {p.name}
                          {p.isAdmin && <Shield className="w-3 h-3 text-amber-300" />}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Desconectar ${p.name} da call?`)) onKick?.(p.id, p.name);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-600/20 text-orange-300 border border-orange-500/40 text-[11px] font-bold flex items-center gap-1 hover:bg-orange-600/30 touch-manipulation"
                      >
                        <UserX className="w-3 h-3" /> Desconectar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- ADMINS ---------- */}
        {screen === 'admins' && (
          <>
            <Header title="Gerenciar administradores" back />
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-400 leading-relaxed">
                Administradores ignoram as permissões desligadas. O <b>nível</b> define o que cada um
                pode gerenciar:
              </p>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] leading-snug">
                <div className={`p-2 rounded-lg border ${LEVEL_STYLE[1]}`}>
                  <b>LV1</b>
                  <br />
                  Limite · Desconectar
                </div>
                <div className={`p-2 rounded-lg border ${LEVEL_STYLE[2]}`}>
                  <b>LV2</b>
                  <br />
                  Participantes · Bans · Admins · Desconectar
                </div>
                <div className={`p-2 rounded-lg border ${LEVEL_STYLE[3]}`}>
                  <b>LV3</b>
                  <br />
                  Tudo do LV2 + Permissões
                </div>
              </div>
              {others.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">
                  Ninguém mais na sala ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {others.map((p) => {
                    const sid = sessionIdOf(p.id);
                    const isAdmin = !!sid && settings.admins.includes(sid);
                    const lv = levelOf(sid);
                    // admin não gerencia alguém de nível maior que o dele
                    const locked = !isOwner && isAdmin && lv > myLevel;
                    return (
                      <div
                        key={p.id}
                        className="p-2 rounded-xl bg-[#161a22] border border-[#232c3f] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-100 truncate flex items-center gap-1">
                                {p.name}
                                {isAdmin && <Shield className="w-3 h-3 text-yellow-400" />}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {isAdmin ? (
                                  <span className={`px-1.5 py-0.5 rounded border font-bold ${LEVEL_STYLE[lv]}`}>
                                    ADM LV{lv}
                                  </span>
                                ) : (
                                  'Participante'
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            disabled={!sid || locked}
                            onClick={() => sid && onToggleAdmin(sid)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold touch-manipulation disabled:opacity-40 ${
                              isAdmin
                                ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                : 'bg-[#232838] text-gray-200 border border-[#2f3850] hover:bg-[#2a3045]'
                            }`}
                          >
                            {isAdmin ? 'Tirar admin' : 'Tornar admin'}
                          </button>
                        </div>
                        {isAdmin && sid && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500 shrink-0">Nível:</span>
                            {([1, 2, 3] as AdminLevel[]).map((n) => {
                              const active = lv === n;
                              const canSet = isOwner || (!locked && n <= myLevel);
                              return (
                                <button
                                  key={n}
                                  disabled={!canSet}
                                  onClick={() => onSetAdminLevel(sid, n)}
                                  className={`flex-1 py-1 rounded-md text-[11px] font-bold border touch-manipulation disabled:opacity-30 ${
                                    active
                                      ? LEVEL_STYLE[n]
                                      : 'bg-[#10141d] text-gray-400 border-[#232c3f] hover:text-gray-200'
                                  }`}
                                >
                                  {active && <Check className="w-3 h-3 inline mr-0.5" />}
                                  LV{n}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- LIMITE ---------- */}
        {screen === 'limit' && (
          <>
            <Header title="Limite de participantes" back />
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-400 leading-relaxed">
                Quando a sala atingir o limite, quem tentar entrar recebe aviso de sala cheia.
                Agora: <b className="text-gray-200">{participants.length}</b> na sala.
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {LIMIT_OPTIONS.map((n) => {
                  const active = settings.maxParticipants === n;
                  return (
                    <button
                      key={n}
                      onClick={() => onSetMaxParticipants(n)}
                      className={`py-2 rounded-lg text-xs font-bold border touch-manipulation ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                          : 'bg-[#161a22] border-[#232c3f] text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {n === 0 ? 'Sem limite' : n}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ---------- BANIMENTOS ---------- */}
        {screen === 'bans' && (
          <>
            <Header title="Banimentos" back />
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Banir alguém da sala
                </p>
                {others.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-3">Ninguém mais na sala.</p>
                ) : (
                  <div className="space-y-1.5">
                    {others.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#161a22] border border-[#232c3f]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                          <p className="text-xs font-semibold text-gray-100 truncate">{p.name}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Banir ${p.name}? Ele não vai conseguir entrar de novo nesta sala.`)) {
                              onBan(p.id, p.name);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600/20 text-red-300 border border-red-500/40 text-[11px] font-bold flex items-center gap-1 hover:bg-red-600/30 touch-manipulation"
                        >
                          <UserX className="w-3 h-3" /> Banir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Banidos ({settings.banned.length})
                </p>
                {settings.banned.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-3">Ninguém banido.</p>
                ) : (
                  <div className="space-y-1.5">
                    {settings.banned.map((b) => (
                      <div
                        key={b.sessionId}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-red-500/5 border border-red-500/20"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-200 truncate">{b.name}</p>
                          <p className="text-[10px] text-gray-500">
                            banido por {b.by} •{' '}
                            {new Date(b.bannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => onUnban(b.sessionId)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#232838] text-gray-200 border border-[#2f3850] text-[11px] font-bold hover:bg-[#2a3045] touch-manipulation"
                        >
                          Desbanir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ---------- PERMISSÕES ---------- */}
        {screen === 'permissions' && (
          <>
            <Header title="Gerenciar permissões" back />
            <div className="p-4 space-y-1 overflow-y-auto">
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Ao desativar uma opção, só o dono e os administradores da sala continuam podendo
                fazer aquilo.
              </p>
              {PERMISSION_ROWS.map((row) => {
                // só o DONO mexe nos níveis de admin e na própria coroa
                const ownerOnly = ['adminLv1', 'adminLv2', 'adminLv3', 'showOwnerCrown'].includes(row.key);
                const disabled = !isOwner && ownerOnly;
                return (
                  <React.Fragment key={row.key}>
                    {row.section && (
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pt-4 pb-1">
                        {row.section}
                      </p>
                    )}
                    <div
                      className={`flex items-center justify-between gap-3 py-3 border-b border-[#1f2636] last:border-0 ${
                        disabled ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-[#1b1f28] border border-[#2a3145] flex items-center justify-center text-gray-300 shrink-0">
                          {row.icon}
                        </span>
                        <span className="text-[13px] text-gray-100 leading-snug">
                          {row.label}
                          {disabled && (
                            <span className="block text-[10px] text-gray-500">só o dono altera</span>
                          )}
                        </span>
                      </div>
                      <div className={disabled ? 'pointer-events-none' : ''}>
                        <Toggle
                          on={!!settings.permissions[row.key]}
                          onChange={(v) => !disabled && onSetPermission(row.key, v)}
                        />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

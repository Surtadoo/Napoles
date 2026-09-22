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
import type { Participant, RoomSettings, RoomPermissions } from '../types';

type Screen = 'menu' | 'admins' | 'limit' | 'bans' | 'permissions' | 'kick';

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
}) => {
  const [screen, setScreen] = useState<Screen>('menu');

  useEffect(() => {
    if (isOpen) setScreen('menu');
  }, [isOpen]);

  if (!isOpen) return null;

  // admin não pode mexer no dono; dono não aparece como alvo pra ninguém
  const others = participants.filter((p) => p.id !== 'current-user' && !p.isOwner);
  const limitLabel = settings.maxParticipants > 0 ? `${settings.maxParticipants} pessoas` : 'sem limite';
  const showBans = isOwner || canBan;
  const showKick = isOwner || canKick;

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
            <Header title={isOwner ? 'Gerenciar sala' : 'Gerenciar sala (admin)'} />
            <div className="p-3 space-y-2">
              {isOwner && (
                <MenuRow
                  icon={<Crown className="w-4 h-4 text-yellow-400" />}
                  label="Gerenciar administradores"
                  onClick={() => setScreen('admins')}
                />
              )}
              {isOwner && (
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
              {isOwner && (
                <MenuRow
                  icon={<Settings className="w-4 h-4 text-gray-300" />}
                  label="Gerenciar permissões"
                  onClick={() => setScreen('permissions')}
                />
              )}
              {!isOwner && !showBans && !showKick && (
                <p className="text-xs text-gray-500 text-center py-6 px-3">
                  Você é administrador, mas o dono ainda não liberou nenhum poder de gerência
                  (banir / desconectar). Você já ignora as permissões desligadas.
                </p>
              )}
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
                Administradores podem fazer tudo mesmo com as permissões desligadas (menos gerenciar a
                sala).
              </p>
              {others.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">
                  Ninguém mais na sala ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {others.map((p) => {
                    const sid = sessionIdOf(p.id);
                    const isAdmin = !!sid && settings.admins.includes(sid);
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
                              {isAdmin && <Shield className="w-3 h-3 text-yellow-400" />}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {isAdmin ? 'Administrador' : 'Participante'}
                            </p>
                          </div>
                        </div>
                        <button
                          disabled={!sid}
                          onClick={() => sid && onToggleAdmin(sid)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold touch-manipulation disabled:opacity-40 ${
                            isAdmin
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                              : 'bg-[#232838] text-gray-200 border border-[#2f3850] hover:bg-[#2a3045]'
                          }`}
                        >
                          {isAdmin ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3 h-3" /> Admin
                            </span>
                          ) : (
                            'Tornar admin'
                          )}
                        </button>
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
              {PERMISSION_ROWS.map((row) => (
                <React.Fragment key={row.key}>
                  {row.section && (
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pt-4 pb-1">
                      {row.section}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3 py-3 border-b border-[#1f2636] last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-[#1b1f28] border border-[#2a3145] flex items-center justify-center text-gray-300 shrink-0">
                        {row.icon}
                      </span>
                      <span className="text-[13px] text-gray-100 leading-snug">{row.label}</span>
                    </div>
                    <Toggle
                      on={!!settings.permissions[row.key]}
                      onChange={(v) => onSetPermission(row.key, v)}
                    />
                  </div>
                </React.Fragment>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

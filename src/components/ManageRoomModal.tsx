import React, { useState } from 'react';
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
  Tv,
  MessageSquare,
  Gift,
  Image as ImageIcon,
  Sparkles,
  Check,
  UserX,
} from 'lucide-react';
import type { RoomSettings, RoomPermissions } from '../types';
import type { Participant } from '../types';

interface ManageRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettings;
  participants: Participant[];
  myName: string;
  onUpdateSettings: (next: RoomSettings) => void;
  onBan: (peerId: string, name: string) => void;
}

type View = 'menu' | 'admins' | 'limit' | 'bans' | 'permissions';

const PERMISSION_ROWS: {
  key: keyof RoomPermissions;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: 'mic', label: 'Permitir que todos liguem o microfone', icon: <Mic className="w-4 h-4 text-emerald-400" /> },
  { key: 'screen', label: 'Permitir que todos compartilhem sua tela', icon: <Monitor className="w-4 h-4 text-emerald-400" /> },
  { key: 'camera', label: 'Permitir que todos liguem sua câmera', icon: <Video className="w-4 h-4 text-emerald-400" /> },
  { key: 'videoSource', label: 'Permitir que todos adicionem uma fonte de vídeo', icon: <Tv className="w-4 h-4 text-emerald-400" /> },
  { key: 'chat', label: 'Permitir que todos enviem mensagens no chat', icon: <MessageSquare className="w-4 h-4 text-emerald-400" /> },
  { key: 'gifs', label: 'Permitir que todos enviem GIFS', icon: <Gift className="w-4 h-4 text-emerald-400" /> },
  { key: 'images', label: 'Permitir que todos enviem imagens', icon: <ImageIcon className="w-4 h-4 text-emerald-400" /> },
  { key: 'proTheme', label: 'Permitir que Pro Max troquem o tema da sala', icon: <Sparkles className="w-4 h-4 text-emerald-400" /> },
];

const rowBtn =
  'w-full flex items-center gap-3 p-3 rounded-xl bg-[#10141d] hover:bg-[#182030] border border-[#242e42] transition-all touch-manipulation text-left';

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`w-11 h-6 rounded-full shrink-0 relative transition-colors touch-manipulation ${
        on ? 'bg-emerald-500' : 'bg-[#2b3548]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export const ManageRoomModal: React.FC<ManageRoomModalProps> = ({
  isOpen,
  onClose,
  settings,
  participants,
  myName,
  onUpdateSettings,
  onBan,
}) => {
  const [view, setView] = useState<View>('menu');

  if (!isOpen) return null;

  const guests = participants.filter((p) => p.id !== 'current-user');
  const isAdminOf = (name: string) =>
    settings.admins.some((a) => a.trim().toLowerCase() === name.trim().toLowerCase());

  const toggleAdmin = (name: string) => {
    const ja = isAdminOf(name);
    const admins = ja
      ? settings.admins.filter((a) => a.trim().toLowerCase() !== name.trim().toLowerCase())
      : [...settings.admins, name];
    onUpdateSettings({ ...settings, admins });
  };

  const setPermission = (key: keyof RoomPermissions, value: boolean) => {
    onUpdateSettings({
      ...settings,
      permissions: { ...settings.permissions, [key]: value },
    });
  };

  const title =
    view === 'menu'
      ? 'Gerenciar sala'
      : view === 'admins'
        ? 'Gerenciar administradores'
        : view === 'limit'
          ? 'Limite de participantes'
          : view === 'bans'
            ? 'Banimentos'
            : 'Gerenciar permissões';

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* header */}
        <div className="p-4 border-b border-[#212a3d] flex items-center gap-2 shrink-0">
          {view !== 'menu' ? (
            <button
              onClick={() => setView('menu')}
              className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 touch-manipulation"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Settings className="w-5 h-5 text-gray-300" />
          )}
          <h3 className="font-bold text-gray-100 text-sm flex-1 truncate">{title}</h3>
          <button
            onClick={() => {
              setView('menu');
              onClose();
            }}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2">
          {view === 'menu' && (
            <>
              <button onClick={() => setView('admins')} className={rowBtn}>
                <Crown className="w-5 h-5 text-yellow-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-100 flex-1">
                  Gerenciar administradores
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>

              <button onClick={() => setView('limit')} className={rowBtn}>
                <Users className="w-5 h-5 text-sky-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-100 flex-1">
                  Limite de participantes
                </span>
                <span className="text-xs text-gray-400 mr-1">
                  {settings.limit > 0 ? settings.limit : 'sem limite'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>

              <button onClick={() => setView('bans')} className={rowBtn}>
                <Ban className="w-5 h-5 text-red-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-100 flex-1">Banimentos</span>
                {settings.bans.length > 0 && (
                  <span className="text-[11px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded mr-1">
                    {settings.bans.length}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>

              <button onClick={() => setView('permissions')} className={rowBtn}>
                <Settings className="w-5 h-5 text-gray-300 shrink-0" />
                <span className="text-sm font-semibold text-gray-100 flex-1">
                  Gerenciar permissões
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>

              <p className="text-[11px] text-gray-500 pt-1 leading-relaxed">
                Você é o dono da sala (⭐). Só você e os administradores podem mexer aqui.
              </p>
            </>
          )}

          {view === 'admins' && (
            <>
              <p className="text-[11px] text-gray-400 pb-1">
                Administradores podem ligar mic/tela/câmera mesmo com permissões desativadas.
              </p>
              {guests.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">Ninguém mais na sala ainda.</p>
              )}
              {guests.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[#10141d] border border-[#242e42]"
                >
                  <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-xs font-semibold text-gray-100 flex-1 truncate">{p.name}</span>
                  <button
                    onClick={() => toggleAdmin(p.name)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 touch-manipulation ${
                      isAdminOf(p.name)
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                        : 'bg-[#1c2333] text-gray-300 border border-[#2b354e]'
                    }`}
                  >
                    <Crown className="w-3 h-3" />
                    {isAdminOf(p.name) ? 'Admin' : 'Tornar admin'}
                  </button>
                </div>
              ))}
            </>
          )}

          {view === 'limit' && (
            <>
              <p className="text-[11px] text-gray-400 pb-1">
                Quando a sala lota, quem tentar entrar depois é recusado automaticamente
                (administradores sempre entram).
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[0, 2, 3, 5, 10, 25].map((n) => (
                  <button
                    key={n}
                    onClick={() => onUpdateSettings({ ...settings, limit: n })}
                    className={`py-2.5 rounded-xl border text-xs font-bold touch-manipulation ${
                      settings.limit === n
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200'
                        : 'bg-[#10141d] border-[#242e42] text-gray-300'
                    }`}
                  >
                    {n === 0 ? 'sem limite' : `${n} pessoas`}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500">
                Agora: <b className="text-gray-300">{settings.limit > 0 ? settings.limit : 'sem limite'}</b>
              </p>
            </>
          )}

          {view === 'bans' && (
            <>
              {settings.bans.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">
                  Ninguém banido. Use o ícone 🚫 na lista de participantes para banir.
                </p>
              )}
              {settings.bans.map((nome) => (
                <div
                  key={nome}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[#10141d] border border-red-500/30"
                >
                  <UserX className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-xs font-semibold text-gray-100 flex-1 truncate">{nome}</span>
                  <button
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        bans: settings.bans.filter((b) => b !== nome),
                      })
                    }
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#1c2333] text-gray-200 border border-[#2b354e] touch-manipulation"
                  >
                    Remover ban
                  </button>
                </div>
              ))}
              {guests.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] text-gray-400">Banir alguém da sala agora:</p>
                  {guests.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[#10141d] border border-[#242e42]"
                    >
                      <img src={p.avatar} alt={p.name} className="w-7 h-7 rounded-full object-cover" />
                      <span className="text-xs text-gray-100 flex-1 truncate">{p.name}</span>
                      <button
                        onClick={() => onBan(p.id, p.name)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-600 text-white touch-manipulation"
                      >
                        Banir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'permissions' && (
            <>
              <p className="text-[11px] text-gray-400 pb-1 leading-relaxed">
                Ao desativar uma opção, só o dono e os administradores da sala continuam podendo
                fazer aquilo.
              </p>
              {PERMISSION_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[#10141d] border border-[#242e42]"
                >
                  {row.icon}
                  <span className="text-xs font-semibold text-gray-100 flex-1 leading-snug">
                    {row.label}
                  </span>
                  <Toggle
                    on={settings.permissions[row.key]}
                    onClick={() => setPermission(row.key, !settings.permissions[row.key])}
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    permissions: {
                      mic: true,
                      screen: true,
                      camera: true,
                      videoSource: true,
                      chat: true,
                      gifs: true,
                      images: true,
                      proTheme: true,
                    },
                  })
                }
                className="w-full mt-1 py-2.5 rounded-xl bg-[#1c2333] hover:bg-[#243049] border border-[#2b354e] text-gray-200 text-xs font-semibold flex items-center justify-center gap-2 touch-manipulation"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                Liberar tudo de novo
              </button>
              <p className="text-[10px] text-gray-500 text-center">
                Você é {myName} (dono da sala) — as mudanças valem na hora para todos.
              </p>
            </>
          )}

          {view === 'bans' && guests.length > 0 && (
            <p className="text-[10px] text-gray-500 pt-1">
              Dica: banir também remove a pessoa e a tela dela da call agora.
            </p>
          )}

          {view === 'admins' && (
            <p className="text-[10px] text-gray-500 pt-1">
              Dica: o ícone 🚫 ao lado de cada participante continua funcionando para expulsar.
            </p>
          )}

          {view !== 'menu' && view !== 'permissions' && (
            <button
              onClick={() => setView('menu')}
              className="hidden"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="p-3 bg-[#0f121a] border-t border-[#1f2636] flex justify-between items-center shrink-0">
          <span className="text-[10px] text-gray-500">
            {view === 'menu' ? 'Sala privada' : 'Só dono e admins'}
          </span>
          <button
            onClick={() => {
              setView('menu');
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-[#1f2636] hover:bg-[#2a3449] text-gray-200 text-xs font-medium touch-manipulation"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

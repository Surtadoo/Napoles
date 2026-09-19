import React, { useState, useRef, useEffect } from 'react';
import { 
  MapPin, 
  X, 
  Bell, 
  Plus, 
  Send, 
  Smile, 
  Video, 
  Radio, 
  Coins
} from 'lucide-react';
import { ChatMessage } from '../types';

interface RightSidebarProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, gifUrl?: string) => void;
  userPoints: number;
  streamerMode: boolean;
  onToggleStreamerMode: () => void;
  onStartRecording: () => void;
  isRecording: boolean;
}

const SAMPLE_GIFS = [
  { id: '1', name: 'GG', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3h1bDRscnh1ZnRldjE3aXpvNm05ZjB5NXd2bzRhbzM3b3pnajdzdSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/BPJmthQ3YRwD6QqcVD/giphy.gif' },
  { id: '2', name: 'Clap', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjFqY3l6a2VvNzdobW42eGtxZXRmNWFmOW9zOXQ0dGpxc3N6dmd2dSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1236TCtX5dsHqw/giphy.gif' },
  { id: '3', name: 'Popcorn', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWU0YWl3eW4wMzgxeW9mbmQwd242bHpyNnJ1a3VzZTZ6bnI2Yzl3ZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/gl0mkIZOW6Nwc/giphy.gif' },
  { id: '4', name: 'Cat Dance', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3hzamx2MTRzMW4xbml0dGg2amE0c2E5aGgyZG4wNTRudnRxbnM2ZSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jpbnoe3UIa8TU8LM13/giphy.gif' },
];

const QUICK_EMOJIS = ['🔥', '🎮', '❤️', '👏', '😂', '🚀', '👀', '✨', '💯', '👑'];

export const RightSidebar: React.FC<RightSidebarProps> = ({
  messages,
  onSendMessage,
  userPoints,
  streamerMode,
  onToggleStreamerMode,
  onStartRecording,
  isRecording,
}) => {
  const [inputText, setInputText] = useState('');
  const [showRecordingTooltip, setShowRecordingTooltip] = useState(true);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
    setShowGifPicker(false);
    setShowEmojiPicker(false);
  };

  const handleSendGif = (url: string) => {
    onSendMessage('', url);
    setShowGifPicker(false);
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  return (
    <aside className="w-80 bg-[#12151b] border-l border-[#1f2533] flex flex-col justify-between shrink-0 h-full select-none z-10">
      {/* Top Header section */}
      <div className="border-b border-[#1f2533] relative">
        {/* Map button & recording tooltip */}
        <div className="p-2.5 pb-1.5 flex items-center justify-between">
          <button 
            onClick={() => alert('Localização da sala privada: Brasil (São Paulo, Edge SP-1) - Ping: 12ms')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[#1a2130] transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-medium">Definir no mapa</span>
          </button>
        </div>

        {/* Floating Tooltip Notice from screenshot */}
        {showRecordingTooltip && (
          <div className="mx-2.5 mb-2 p-2.5 rounded-lg bg-[#1e40af] text-white text-xs shadow-xl border border-blue-400/40 relative animate-in fade-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => setShowRecordingTooltip(false)}
              className="absolute top-1.5 right-1.5 text-blue-200 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="pr-4 leading-relaxed">
              <strong className="text-blue-100 font-bold block mb-0.5">Novo:</strong>
              ative a Gravação aqui para gravar qualquer tela ou câmera e baixar o vídeo.
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => {
                  onStartRecording();
                  setShowRecordingTooltip(false);
                }}
                className="px-2 py-1 rounded bg-white text-blue-900 font-bold text-[11px] hover:bg-blue-50 transition-colors flex items-center gap-1 shadow-sm"
              >
                <Video className="w-3 h-3 text-red-600" />
                <span>{isRecording ? 'Parar Gravação' : 'Testar Gravação'}</span>
              </button>
              <button
                onClick={() => setShowRecordingTooltip(false)}
                className="text-[11px] text-blue-200 hover:text-white underline"
              >
                Entendi
              </button>
            </div>
          </div>
        )}

        {/* Tab Title: Chat */}
        <div className="px-4 py-2 flex items-center justify-between bg-[#151922]">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Chat</h4>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </div>
          <button 
            title="Sons de notificação do chat"
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#1f2636] transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-xs px-4">
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Envie uma mensagem ou compartilhe sua tela para começar!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="group">
              {msg.isSystem ? (
                <div className="text-center my-2">
                  <span className="bg-[#1c2333] text-gray-400 text-[10px] px-2.5 py-1 rounded-full border border-[#2b354e]">
                    {msg.text}
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <img
                    src={msg.avatar}
                    alt={msg.sender}
                    className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xs font-semibold ${msg.color || 'text-emerald-400'}`}>
                        {msg.sender}
                      </span>
                      <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                    </div>

                    {msg.text && (
                      <p className="text-xs text-gray-200 mt-0.5 break-words leading-relaxed select-text">
                        {msg.text}
                      </p>
                    )}

                    {msg.mediaUrl && (
                      <div className="mt-1.5 rounded-lg overflow-hidden border border-[#263045] max-w-[200px]">
                        <img
                          src={msg.mediaUrl}
                          alt="GIF / Attachment"
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* GIF Picker Popup */}
      {showGifPicker && (
        <div className="p-2 bg-[#171c26] border-t border-[#252f44] grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
          {SAMPLE_GIFS.map((gif) => (
            <button
              key={gif.id}
              onClick={() => handleSendGif(gif.url)}
              className="rounded-lg overflow-hidden border border-[#2d3850] hover:border-emerald-500 transition-all group relative aspect-video"
            >
              <img src={gif.url} alt={gif.name} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 bg-black/70 text-[9px] px-1 py-0.5 rounded text-white font-medium">
                {gif.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="p-2 bg-[#171c26] border-t border-[#252f44] flex flex-wrap gap-1.5 justify-center">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleInsertEmoji(emoji)}
              className="w-8 h-8 rounded hover:bg-[#253045] flex items-center justify-center text-lg transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input Area */}
      <div className="p-2.5 bg-[#141820] border-t border-[#1f2636]">
        <form onSubmit={handleSend} className="flex items-center gap-1.5 bg-[#1a202c] rounded-xl px-2.5 py-1 border border-[#2b354a] focus-within:border-emerald-500/70 transition-colors">
          {/* Plus / Upload button */}
          <button
            type="button"
            onClick={() => {
              const dummyImg = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80';
              onSendMessage('Compartilhou uma captura 🎮', dummyImg);
            }}
            title="Enviar imagem/mídia"
            className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Input text */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-transparent text-xs text-gray-100 placeholder-gray-500 outline-none py-1.5 min-w-0"
          />

          {/* GIF button */}
          <button
            type="button"
            onClick={() => {
              setShowGifPicker(!showGifPicker);
              setShowEmojiPicker(false);
            }}
            className={`text-xs font-bold px-1.5 py-0.5 rounded transition-colors ${
              showGifPicker ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            GIF
          </button>

          {/* Emoji button */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowGifPicker(false);
            }}
            className={`p-1 rounded transition-colors ${
              showEmojiPicker ? 'text-yellow-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-1 text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* User Footer Profile & Streamer Mode */}
      <div className="p-3 bg-[#11141a] border-t border-[#1f2533] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face"
                alt="Surtado"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#11141a]"></span>
            </div>

            <div>
              <div className="text-xs font-bold text-gray-100 flex items-center gap-1">
                <span>Surtado</span>
                <span className="text-blue-400 text-[10px]">✔</span>
              </div>
              <span className="text-[11px] text-gray-400">@surtadoo</span>
            </div>
          </div>

          {/* User Points */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#181f2c] border border-[#26334a] text-xs">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-gray-300 text-[11px]">Pontos</span>
            <span className="font-bold text-amber-400 text-xs">{userPoints}</span>
          </div>
        </div>

        {/* Modo Streamer Toggle Button */}
        <div className="pt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <Radio className="w-3.5 h-3.5 text-red-400" />
            <span>Modo Streamer:</span>
          </div>

          <button
            onClick={onToggleStreamerMode}
            className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase transition-all ${
              streamerMode
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-[#1b212d] text-gray-400 border border-[#2b3548] hover:text-gray-300'
            }`}
          >
            {streamerMode ? 'ATIVADO' : 'DESATIVADO'}
          </button>
        </div>
      </div>
    </aside>
  );
};

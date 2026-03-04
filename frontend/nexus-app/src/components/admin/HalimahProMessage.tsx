import { User, Bot } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface HalimahProMessageProps {
  message: Message;
}

export default function HalimahProMessage({ message }: HalimahProMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${isUser ? 'bg-purple-600' : 'bg-gradient-to-br from-purple-500 to-pink-500'}
      `}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message bubble */}
      <div className={`
        max-w-[75%] rounded-2xl px-4 py-2.5
        ${isUser
          ? 'bg-purple-600 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-900 rounded-tl-sm'
        }
      `}>
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`text-[10px] mt-1 ${isUser ? 'text-purple-200' : 'text-gray-500'}`}>
          {message.timestamp.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}

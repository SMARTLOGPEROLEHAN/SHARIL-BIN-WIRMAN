import { Cpu, Send, X, MessageSquare, Bot, User, LifeBuoy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export default function AIButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Selamat datang ke Bantuan AI SMART LOG PEROLEHAN. Saya sedia membantu anda mengenai sistem pendaftaran tapak sebut harga RISDA. Ada apa-apa soalan?' }
  ]);
  const [loading, setLoading] = useState(false);
  const [sendingSupport, setSendingSupport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const requestSupport = async () => {
    if (!user) {
      toast.error('Sila log masuk untuk bantuan teknikal');
      return;
    }
    
    const path = 'notifications';
    setSendingSupport(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'technical_support',
        userId: user.uid,
        userName: user.displayName || 'Kakitangan',
        userEmail: user.email,
        message: 'Memohon bantuan teknikal segera melalui AI Chat.',
        status: 'pending',
        createdAt: Timestamp.now()
      });
      toast.success('Permintaan bantuan telah dihantar!');
      setMessages(prev => [...prev, { role: 'ai', text: 'Permintaan bantuan teknikal anda telah dihantar kepada pentadbir sistem. Sila tunggu maklum balas.' }]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setSendingSupport(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ralat pelayan");
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.text }]);
    } catch (error: any) {
      console.error('AI Error:', error);
      let errorMessage = 'Maaf, ralat teknikal berlaku. Sila cuba sebentar lagi.';
      
      if (error.message?.includes('configured') || error.message?.includes('403') || error.message?.includes('400')) {
        errorMessage = 'Sila pastikan API Key telah dikonfigurasi dalam tetapan sistem.';
      } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        errorMessage = 'Had penggunaan AI telah dicapai. Sila cuba sebentar lagi.';
      }
      
      setMessages(prev => [...prev, { role: 'ai', text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 sm:w-96 h-[500px] bg-risda-card border border-risda-border rounded-[32px] shadow-2xl flex flex-col overflow-hidden shadow-black/50"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-risda-gold to-risda-orange flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-risda-gold">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-black uppercase tracking-tight">AI HELP RISDA</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-black/60 rounded-full animate-pulse" />
                    <span className="text-[8px] font-bold text-black/60 uppercase">Sedia Membantu</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-black/10 rounded-full text-black transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-risda-dark/30">
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: msg.role === 'ai' ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-[11px] leading-relaxed font-medium shadow-sm
                    ${msg.role === 'ai' 
                      ? 'bg-risda-sidebar border border-risda-border text-white rounded-tl-none' 
                      : 'bg-risda-gold text-black rounded-tr-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              
              {user && messages.length > 0 && (
                <div className="pt-2 flex justify-center">
                  <button 
                    onClick={requestSupport}
                    disabled={sendingSupport}
                    className="flex items-center gap-2 px-6 py-3 bg-risda-gold/10 border border-risda-gold/30 rounded-2xl text-[10px] font-black text-risda-gold uppercase tracking-[2px] hover:bg-risda-gold transition-all hover:text-black shadow-lg"
                  >
                    <LifeBuoy size={14} className={sendingSupport ? "animate-spin" : ""} />
                    {sendingSupport ? 'Menghantar...' : 'Bantuan Teknikal'}
                  </button>
                </div>
              )}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-risda-sidebar border border-risda-border text-risda-muted p-3 rounded-2xl rounded-tl-none flex gap-1">
                    <span className="w-1 h-1 bg-risda-muted rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-risda-muted rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 bg-risda-muted rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-risda-sidebar border-t border-risda-border">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="relative"
              >
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tanya soalan mengenai sistem..."
                  className="w-full bg-black/40 border border-risda-border rounded-xl py-3 pl-4 pr-12 text-[11px] text-white focus:border-risda-orange/30 outline-none placeholder:text-risda-muted"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="absolute right-2 top-1.2 p-1.5 text-risda-gold hover:text-white transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative group">
        <motion.button 
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          animate={!isOpen ? {
            boxShadow: [
              "0 0 0px rgba(0, 229, 255, 0)",
              "0 0 30px rgba(0, 229, 255, 0.6)",
              "0 0 0px rgba(0, 229, 255, 0)"
            ],
            scale: [1, 1.05, 1]
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className={`w-[50px] h-[50px] rounded-[18px] flex items-center justify-center text-black shadow-2xl transition-all border-2
            ${isOpen ? 'bg-red-500 border-red-400 shadow-red-500/40 rotate-90' : 'bg-risda-gold border-white/30 shadow-risda-gold/60'}
          `}
        >
          {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </motion.button>
      </div>
    </div>
  );
}

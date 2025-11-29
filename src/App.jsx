import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, Move, User, MessageSquare, Heart, Info, Loader2, Sparkles, Zap, ShieldAlert } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';

// --- Firebase Configuration & Init ---
// Your specific keys:
const firebaseConfig = {
  apiKey: "AIzaSyALkynwzJPlONWQG8ltUCpymYEWDGHSUHg",
  authDomain: "ourownbulletinboard.firebaseapp.com",
  projectId: "ourownbulletinboard",
  storageBucket: "ourownbulletinboard.firebasestorage.app",
  messagingSenderId: "145902358292",
  appId: "1:145902358292:web:36643263d1696badc8bc01",
  measurementId: "G-WZQJS2HE2G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "ourownbulletinboard"; 

// --- Gemini API Helper ---
const callGemini = async (prompt) => {
  const apiKey = ""; // Provided by runtime environment
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) throw new Error('Gemini API Error');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Creative block! Try again.";
  } catch (error) {
    console.error("AI Error:", error);
    return "The muse is silent right now. Try again later!";
  }
};

// --- Constants & Styles ---
const CARD_WIDTH = 220;
const CARD_HEIGHT = 160;
const GRID_GAP = 40; // Margin between cards
const COLORS = [
  { bg: 'bg-[#FF0099]', text: 'text-white' }, // Hot Pink
  { bg: 'bg-[#FFFF00]', text: 'text-black' }, // Electric Yellow
  { bg: 'bg-[#00FFFF]', text: 'text-black' }, // Cyan
  { bg: 'bg-[#FF3300]', text: 'text-white' }, // Bright Red
  { bg: 'bg-[#FFFFFF]', text: 'text-black' }, // White
  { bg: 'bg-[#00FF00]', text: 'text-black' }, // Lime Green
];

// Helper to get random rotation for that "pinned" look
const getRandomRotation = (seed) => {
  const num = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (num % 10) - 5; // -5 to 5 degrees
};

// --- Components ---

const Button = ({ onClick, children, className = "", variant = "primary", disabled = false }) => {
  const baseStyle = "font-bold border-4 border-black transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-[#FFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
    secondary: "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    icon: "p-3 rounded-full bg-[#FF0099] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    magic: "bg-gradient-to-r from-purple-400 to-pink-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    close: "p-1 bg-white hover:bg-gray-100 rounded-full border-2 border-black"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ data, index, onClick }) => {
  const style = useMemo(() => {
    // Deterministic layout logic: Grid system
    const COLUMNS = 6; 
    const row = Math.floor(index / COLUMNS);
    const col = index % COLUMNS;
    
    // Add some random offsets for "messy board" vibe but constrained to grid cell
    const offsetX = (data.id.charCodeAt(0) % 20) - 10;
    const offsetY = (data.id.charCodeAt(1) % 20) - 10;

    const x = col * (CARD_WIDTH + GRID_GAP) + 100 + offsetX;
    const y = row * (CARD_HEIGHT + GRID_GAP) + 100 + offsetY;
    const rotation = getRandomRotation(data.id);
    const colorTheme = COLORS[index % COLORS.length];

    return { x, y, rotation, colorTheme };
  }, [data.id, index]);

  return (
    <div
      onClick={() => onClick(data, style.colorTheme)}
      className={`absolute cursor-pointer group select-none`}
      style={{
        transform: `translate(${style.x}px, ${style.y}px) rotate(${style.rotation}deg)`,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        touchAction: 'none'
      }}
    >
      <div className={`
        w-full h-full p-4 flex flex-col justify-between
        border-4 border-black 
        ${style.colorTheme.bg} ${style.colorTheme.text}
        shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]
        transition-all duration-200
        group-hover:-translate-y-1 group-hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]
      `}>
        {/* Tape effect */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-8 bg-white/40 border border-white/60 rotate-2 backdrop-blur-sm" />

        <div className="flex flex-col gap-1 overflow-hidden">
          <h3 className="font-black text-lg leading-tight uppercase truncate border-b-2 border-current pb-1 mb-1">
            {data.name}
          </h3>
          <p className="font-bold text-sm leading-snug line-clamp-3">
            {data.message}
          </p>
        </div>
        
        <div className="text-xs font-mono opacity-80 mt-2 flex justify-between items-center">
          <span>TAP TO READ</span>
          <Move size={12} />
        </div>
      </div>
    </div>
  );
};

// The 3D flip card modal
const PostcardModal = ({ post, colorTheme, onClose }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Auto flip animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsFlipped(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md aspect-[3/2] perspective-1000">
        
        {/* The Card Container with Transform */}
        <div 
          className={`relative w-full h-full transition-transform duration-700 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* FRONT (Cover) */}
          <div className={`
            absolute inset-0 backface-hidden
            border-4 border-black 
            ${colorTheme?.bg || 'bg-white'} ${colorTheme?.text || 'text-black'}
            shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]
            flex flex-col items-center justify-center p-8 text-center
          `}>
             <h2 className="text-4xl font-black uppercase mb-4 tracking-tighter transform -rotate-2">
               {post.name}
             </h2>
             <div className="w-16 h-2 bg-black mb-4" />
             <p className="text-xl font-bold">{post.message}</p>
             <div className="absolute bottom-4 right-4 text-xs font-mono animate-pulse">
               (Tap to open)
             </div>
          </div>

          {/* BACK (Details) */}
          <div className={`
            absolute inset-0 backface-hidden rotate-y-180
            bg-[#FFFBEB] text-black border-4 border-black
            shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]
            flex flex-col
          `}>
            {/* Postcard Lines */}
            <div className="flex-1 flex p-6 gap-6">
              <div className="flex-1 text-left">
                 <div className="uppercase text-xs font-bold text-gray-400 mb-1">More Details</div>
                 <p className="font-medium text-lg font-handwriting leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[200px] scrollbar-hide">
                   {post.details || "No extra details provided."}
                 </p>
              </div>
              <div className="w-px bg-gray-300 self-stretch mx-2" />
              <div className="w-1/3 flex flex-col items-center pt-2">
                 <div className="w-16 h-20 border-2 border-dashed border-gray-400 mb-4 flex items-center justify-center text-gray-300">
                   <User size={24} />
                 </div>
                 <div className="w-full h-px bg-gray-300 my-4" />
                 <div className="w-full h-px bg-gray-300 my-4" />
                 <div className="w-full h-px bg-gray-300 my-4" />
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="absolute -top-12 right-0 md:-right-12 text-white hover:scale-110 transition-transform"
        >
          <X size={32} className="drop-shadow-md" />
        </button>
      </div>
    </div>
  );
};

const AddModal = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({ name: '', message: '', details: '' });
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) setFormData({ name: '', message: '', details: '' });
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleMagicDraft = async () => {
    if (!formData.name && !formData.message) return;
    
    setIsMagicLoading(true);
    const prompt = `
      Write a fun, punchy, pop-art inspired short bio (max 3 sentences) for a community board. 
      The person's name is "${formData.name || 'Anonymous'}" and their headline message is "${formData.message || 'Hello world'}".
      Make it sound cool, artistic, and energetic. Do not use hashtags.
    `;
    
    const result = await callGemini(prompt);
    setFormData(prev => ({ ...prev, details: result }));
    setIsMagicLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <div className="bg-white w-full max-w-lg border-4 border-black shadow-[12px_12px_0px_0px_#00FF99] p-6 relative">
        <div className="absolute top-0 left-0 w-full h-4 bg-black" />
        
        <button onClick={onClose} className="absolute top-6 right-4 hover:rotate-90 transition-transform">
          <X size={28} />
        </button>

        <h2 className="text-3xl font-black mb-6 uppercase italic transform -rotate-1">
          Add Your Mark
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block font-bold text-sm uppercase mb-1">Who are you?</label>
            <input 
              name="name" 
              value={formData.name}
              onChange={handleChange}
              maxLength={20}
              placeholder="YOUR NAME"
              className="w-full bg-gray-100 border-2 border-black p-3 font-bold focus:bg-[#FFFF00] focus:outline-none transition-colors"
            />
          </div>
          
          <div>
            <label className="block font-bold text-sm uppercase mb-1">The Headline</label>
            <input 
              name="message" 
              value={formData.message}
              onChange={handleChange}
              maxLength={50}
              placeholder="Short & Punchy Message"
              className="w-full bg-gray-100 border-2 border-black p-3 font-bold focus:bg-[#00FFFF] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-sm uppercase">The Full Story</label>
              <button 
                type="button"
                onClick={handleMagicDraft}
                disabled={isMagicLoading || (!formData.name && !formData.message)}
                className="text-xs flex items-center gap-1 font-bold text-purple-600 hover:bg-purple-100 px-2 py-1 rounded disabled:opacity-50"
              >
                {isMagicLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isMagicLoading ? 'WRITING...' : 'MAGIC DRAFT'}
              </button>
            </div>
            <textarea 
              name="details" 
              value={formData.details}
              onChange={handleChange}
              rows={4}
              placeholder="Tell us more about you..."
              className="w-full bg-gray-100 border-2 border-black p-3 font-medium focus:bg-[#FF0099] focus:text-white focus:placeholder-white/70 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button 
              onClick={() => onSubmit(formData)} 
              variant="primary" 
              className="px-8 py-3 text-lg w-full md:w-auto"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : "POST IT!"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const VibeModal = ({ isOpen, onClose, vibe, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#FFFF00] w-full max-w-md border-4 border-black shadow-[12px_12px_0px_0px_#FF0099] p-8 text-center relative transform rotate-1">
                <button onClick={onClose} className="absolute top-2 right-2 p-1 border-2 border-black bg-white hover:bg-gray-100">
                    <X size={20} />
                </button>
                
                <div className="mb-4 flex justify-center">
                    <div className="bg-black text-white p-3 rounded-full">
                        {isLoading ? <Loader2 className="animate-spin" size={32} /> : <Zap size={32} />}
                    </div>
                </div>

                <h3 className="font-black text-2xl uppercase mb-4">Current Board Vibe</h3>
                
                {isLoading ? (
                    <p className="font-mono text-sm animate-pulse">Scanning the canvas...</p>
                ) : (
                    <div className="font-bold text-lg leading-tight italic">
                        "{vibe}"
                    </div>
                )}
            </div>
        </div>
    );
}

// New Modal for Permission Errors
const RulesErrorModal = ({ isOpen }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-red-900/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <div className="bg-white w-full max-w-lg border-4 border-black shadow-[12px_12px_0px_0px_#FF0000] p-6 text-center">
        <div className="flex justify-center mb-4 text-red-600">
          <ShieldAlert size={64} />
        </div>
        <h2 className="text-3xl font-black mb-4 uppercase">Access Denied!</h2>
        <p className="font-bold mb-4">
          Your Firebase Database is locked.
        </p>
        <div className="text-left bg-gray-100 p-4 border-2 border-black mb-6 text-sm font-mono">
          1. Go to Firebase Console &gt; Build &gt; Firestore Database.<br/>
          2. Click the "Rules" tab.<br/>
          3. Change "false" to "true":<br/>
          <span className="text-green-600 font-bold">allow read, write: if true;</span><br/>
          4. Click "Publish".
        </div>
        <p className="text-sm font-bold text-gray-500">Refresh this page after publishing.</p>
      </div>
    </div>
  );
};

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  // Vibe Check State
  const [isVibeModalOpen, setIsVibeModalOpen] = useState(false);
  const [boardVibe, setBoardVibe] = useState("");
  const [isVibeLoading, setIsVibeLoading] = useState(false);

  // Canvas State
  const [view, setView] = useState({ x: -100, y: -100, scale: 1 });
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastDist = useRef(null);
  
  // Inject Tailwind CSS for CodeSandbox
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(script);
  }, []);

  // 1. Auth Init
  useEffect(() => {
    const initAuth = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Login failed:", error);
        }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'board_posts'),
      orderBy('createdAt', 'asc') 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(loadedPosts);
      setPermissionError(false); // Clear error if successful
    }, (err) => {
      console.error("Data fetch error", err);
      if (err.code === 'permission-denied') {
        setPermissionError(true);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Handlers
  const handleAddPost = async (data) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'board_posts'), {
        ...data,
        createdAt: serverTimestamp(),
        authorId: user.uid
      });
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Error adding post", err);
      if (err.code === 'permission-denied') {
        setPermissionError(true);
      } else {
        alert("Failed to post message. Try again!");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVibeCheck = async () => {
    setIsVibeModalOpen(true);
    setIsVibeLoading(true);
    
    // Get recent posts text
    const recentPostsText = posts.slice(-10).map(p => `${p.name} says: ${p.message}`).join(". ");
    const prompt = `
        Analyze these community messages and describe the current 'vibe' of the board in 1 short, witty, pop-art inspired sentence. 
        Act like an art critic. 
        Messages: ${recentPostsText || "The board is empty and waiting for art."}
    `;

    const result = await callGemini(prompt);
    setBoardVibe(result);
    setIsVibeLoading(false);
  };

  // Canvas Logic
  const handlePointerDown = (e) => {
    if (e.target.closest('.card-interactive')) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    containerRef.current.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault(); 
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
    lastDist.current = null;
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      if (lastDist.current) {
        const delta = dist - lastDist.current;
        const zoomFactor = delta * 0.005;
        setView(prev => ({
          ...prev,
          scale: Math.min(Math.max(0.2, prev.scale + zoomFactor), 3)
        }));
      }
      lastDist.current = dist;
    }
  };

  const handleWheel = (e) => {
    if(e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        setView(prev => ({ ...prev, scale: Math.min(Math.max(0.2, prev.scale + delta), 3) }));
    } else {
        setView(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-[#e5e5e5] text-black font-sans select-none relative">
      
      {/* --- Background Pattern --- */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ 
             backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', 
             backgroundSize: '20px 20px' 
           }} 
      />

      {/* --- Infinite Canvas --- */}
      <div 
        ref={containerRef}
        className="w-full h-full cursor-grab touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
        <div 
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'absolute'
          }}
        >
          {posts.map((post, index) => (
            <Card 
              key={post.id} 
              index={index} 
              data={post} 
              onClick={(p, c) => setSelectedPost({ data: p, color: c })} 
            />
          ))}
          
          {posts.length === 0 && (
             <div className="absolute top-40 left-40 w-64 p-6 bg-white border-4 border-black text-center transform -rotate-3 shadow-[8px_8px_0px_0px_#ccc]">
                <h3 className="font-bold text-xl mb-2">It's quiet here...</h3>
                <p>Be the first to post on the community board!</p>
             </div>
          )}
        </div>
      </div>

      {/* --- HUD / Controls --- */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-4 z-40 items-end">
        
        {/* Vibe Check Button */}
        <Button 
            variant="secondary" 
            onClick={handleVibeCheck}
            className="px-4 py-2 rounded-full text-sm animate-bounce-slow"
        >
            <Sparkles size={16} className="text-[#FF0099]" />
            ✨ VIBE CHECK
        </Button>

        <div className="hidden md:flex flex-col bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg overflow-hidden">
            <button 
                onClick={() => setView(v => ({ ...v, scale: Math.min(v.scale + 0.2, 3) }))}
                className="p-3 hover:bg-gray-100 border-b border-gray-200"
            >
                <Plus size={20} />
            </button>
            <button 
                onClick={() => setView(v => ({ ...v, scale: Math.max(v.scale - 0.2, 0.2) }))}
                className="p-3 hover:bg-gray-100"
            >
                <div className="w-4 h-0.5 bg-black" />
            </button>
        </div>

        <Button 
          variant="icon" 
          onClick={() => setIsAddModalOpen(true)}
          className="w-16 h-16 rounded-full flex items-center justify-center animate-bounce-slow"
        >
          <Plus size={32} strokeWidth={3} />
        </Button>
      </div>

      {/* --- Top Bar --- */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex justify-between items-start z-30">
        <div className="bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_#00FFFF] pointer-events-auto transform rotate-1">
          <h1 className="font-black text-2xl tracking-tighter uppercase italic">
            Community<span className="text-[#FF0099]">Board</span>
          </h1>
          <div className="text-xs font-bold mt-1 flex gap-2">
             <span className="bg-black text-white px-1">{posts.length} POSTS</span>
             <span className="bg-[#FFFF00] text-black px-1">LIVE</span>
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      <AddModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={handleAddPost}
        isSubmitting={isSubmitting}
      />

      {selectedPost && (
        <PostcardModal 
          post={selectedPost.data} 
          colorTheme={selectedPost.color}
          onClose={() => setSelectedPost(null)} 
        />
      )}

      <VibeModal 
        isOpen={isVibeModalOpen}
        onClose={() => setIsVibeModalOpen(false)}
        vibe={boardVibe}
        isLoading={isVibeLoading}
      />

      <RulesErrorModal isOpen={permissionError} />

      {/* --- Instruction Overlay (fades out) --- */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-bold pointer-events-none animate-fade-out-delayed">
        Drag to move • Pinch to zoom • Tap cards
      </div>
      
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .animate-bounce-slow { animation: bounce 3s infinite; }
        @keyframes fadeOut {
            0% { opacity: 1; }
            80% { opacity: 1; }
            100% { opacity: 0; display: none; }
        }
        .animate-fade-out-delayed { animation: fadeOut 5s forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap');
        .font-handwriting { font-family: 'Permanent Marker', cursive; }
      `}</style>
    </div>
  );
}

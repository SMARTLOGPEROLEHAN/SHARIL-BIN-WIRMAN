import React from 'react';
import { motion } from 'motion/react';

export default function DecorationBackground() {
  const [logoSrc, setLogoSrc] = React.useState("https://www.risda.gov.my/images/logo_risda.png");

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Diagonals and Pills from the image */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        className="absolute top-[-10%] right-[-10%] w-[40%] h-[60%] border-[20px] border-risda-orange rounded-[100px] rotate-[-45deg]"
      />
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.05 }}
        className="absolute bottom-[10%] left-[-5%] w-[30%] h-[50%] border-[15px] border-risda-orange rounded-[80px] rotate-[30deg]"
      />

      {/* Dots grid like in the image */}
      <div className="absolute top-[20%] left-[5%] grid grid-cols-4 gap-4 opacity-10">
        {[...Array(16)].map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 bg-risda-orange rounded-full" />
        ))}
      </div>

      <div className="absolute bottom-[20%] right-[10%] grid grid-cols-4 gap-4 opacity-10">
        {[...Array(16)].map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 bg-risda-orange rounded-full" />
        ))}
      </div>

      {/* Floating lines */}
      <motion.div 
        animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute top-[40%] right-[30%] w-[150px] h-[4px] bg-risda-orange/10 rounded-full rotate-[-45deg]"
      />

      <motion.div 
        animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[40%] left-[20%] w-[200px] h-[4px] bg-risda-orange/10 rounded-full rotate-[45deg]"
      />

      <div className="absolute top-[10%] left-[40%] w-6 h-6 border-4 border-risda-orange/10 rounded-full" />
      <div className="absolute bottom-[5%] right-[30%] w-12 h-12 border-4 border-risda-orange/10 rounded-full" />

      {/* RISDA Logo Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.2] overflow-hidden">
        <motion.img 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2 }}
          src={logoSrc}
          onError={() => {
            if (logoSrc !== "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png") {
              setLogoSrc("https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png");
            }
          }}
          alt="RISDA BACKGROUND" 
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          className="w-[800px] h-[800px] object-contain select-none mix-blend-overlay"
        />
      </div>
    </div>
  );
}

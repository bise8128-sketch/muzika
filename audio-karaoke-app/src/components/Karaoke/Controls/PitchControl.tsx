import React from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Music2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PitchControlProps {
  pitch: number;
  onPitchChange: (pitch: number) => void;
  min?: number;
  max?: number;
}

export const PitchControl: React.FC<PitchControlProps> = ({ 
  pitch, 
  onPitchChange,
  min = -12,
  max = 12
}) => {
  const t = useTranslations('PlayerControls');

  const handleDecrease = () => {
    if (pitch > min) onPitchChange(pitch - 1);
  };

  const handleIncrease = () => {
    if (pitch < max) onPitchChange(pitch + 1);
  };

  const handleReset = () => {
    onPitchChange(0);
  };

  return (
    <motion.div 
      layout
      className="flex items-center gap-2 bg-black/20 backdrop-blur-md rounded-2xl p-1.5 border border-white/5"
    >
      <div className="flex items-center gap-2 px-2 border-r border-white/10">
        <Music2 className="w-3.5 h-3.5 text-primary" />
        <span className="text-[9px] font-black uppercase tracking-widest text-white/40 hidden sm:block">
          {t('key')}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={handleDecrease}
          disabled={pitch <= min}
          className="p-1.5 rounded-lg text-white/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </motion.button>

        <motion.div 
          key={pitch}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-12 text-center"
        >
          <span className={`text-xs font-black tabular-nums tracking-tight ${pitch !== 0 ? 'text-primary' : 'text-white/80'}`}>
            {pitch > 0 ? '+' : ''}{pitch}
          </span>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={handleIncrease}
          disabled={pitch >= max}
          className="p-1.5 rounded-lg text-white/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      {pitch !== 0 && (
        <motion.button
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleReset}
          className="p-1.5 ml-1 rounded-lg text-white/40 hover:text-red-400 transition-colors"
          title={t('resetPitch')}
        >
          <RotateCcw className="w-3 h-3" />
        </motion.button>
      )}
    </motion.div>
  );
};

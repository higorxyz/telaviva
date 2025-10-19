import React from 'react';

/**
 * Props:
 * - size: 'small' | 'medium' | 'large' | 'xlarge' (padrão: 'medium')
 * - showText: boolean (padrão: true)
 * - animated: boolean (padrão: true)
 * - className: string (classes adicionais)
 */

const Logo = ({ 
  size = 'medium', 
  showText = true, 
  animated = true,
  className = '' 
}) => {
  const sizeConfig = {
    small: {
      icon: 'w-10 h-10',
      layer: 'w-8 h-8 rounded-lg border-2',
      play: 'border-l-[10px] border-t-[6px] border-b-[6px]',
      text: 'text-xl',
      gap: 'gap-2'
    },
    medium: {
      icon: 'w-[60px] h-[60px]',
      layer: 'w-12 h-12 rounded-xl border-[3px]',
      play: 'border-l-[14px] border-t-[9px] border-b-[9px]',
      text: 'text-[2.2rem]',
      gap: 'gap-[15px]'
    },
    large: {
      icon: 'w-20 h-20',
      layer: 'w-16 h-16 rounded-2xl border-[4px]',
      play: 'border-l-[18px] border-t-[12px] border-b-[12px]',
      text: 'text-5xl',
      gap: 'gap-5'
    },
    xlarge: {
      icon: 'w-28 h-28',
      layer: 'w-[88px] h-[88px] rounded-3xl border-[5px]',
      play: 'border-l-[24px] border-t-[16px] border-b-[16px]',
      text: 'text-7xl',
      gap: 'gap-6'
    }
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex items-center ${config.gap} ${className}`} aria-label="TelaViva Logo">
      <div className={`relative ${config.icon}`}>
        <div 
          className={`
            absolute top-0 left-0 
            ${config.layer}
            border-white/20
            ${animated ? 'animate-float-1' : ''}
          `}
        />
        
        <div 
          className={`
            absolute 
            ${config.layer}
            border-white/40
            ${animated ? 'animate-float-2' : ''}
          `}
          style={{
            top: size === 'small' ? '4px' : size === 'medium' ? '6px' : size === 'large' ? '8px' : '10px',
            left: size === 'small' ? '4px' : size === 'medium' ? '6px' : size === 'large' ? '8px' : '10px'
          }}
        />
        
        <div 
          className={`
            absolute 
            ${config.layer}
            border-tv-accent
            bg-black
            flex items-center justify-center
            shadow-[0_0px_8px_rgba(239,68,68,0.7)]
            ${animated ? 'animate-float-3' : ''}
          `}
          style={{
            top: size === 'small' ? '8px' : size === 'medium' ? '12px' : size === 'large' ? '16px' : '20px',
            left: size === 'small' ? '8px' : size === 'medium' ? '12px' : size === 'large' ? '16px' : '20px'
          }}
        >
          <div 
            className={`
              w-0 h-0 ml-[3px]
              ${config.play}
              border-l-white
              border-t-transparent 
              border-b-transparent
            `}
          />
        </div>
      </div>

      {showText && (
        <div className={`${config.text} font-bold leading-none`}>
          <span className="text-tv-accent font-extrabold">Tela</span>
          <span className="text-white font-light">Viva</span>
        </div>
      )}
    </div>
  );
};

export default Logo;
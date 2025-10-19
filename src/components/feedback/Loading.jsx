import React from 'react';
import { waveform } from 'ldrs';

waveform.register();

const Loading = ({
  fullScreen = true,
  backgroundClass = 'bg-neutral-950',
  size = 35,
  color = 'red',
  label = 'Carregando',
  className = '',
}) => (
  <div
    className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'py-8'} ${backgroundClass} ${className}`.trim()}
    role="status"
    aria-label={label}
  >
    <l-waveform size={String(size)} stroke="3.5" speed="1" color={color} />
  </div>
);

export default Loading;



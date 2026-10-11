import React from 'react';

export interface HackverseLogoProps {
  className?: string;
  variant?: 'white' | 'dark' | 'original' | 'auto';
  alt?: string;
}

export function HackverseLogo({ 
  className = "w-8 h-8", 
  variant = 'auto', 
  alt = "Hackverse Logo" 
}: HackverseLogoProps) {
  const src = variant === 'white' 
    ? '/logo-white.png' 
    : variant === 'dark' 
      ? '/logo-transparent.png' 
      : '/logo.png';

  return (
    <img 
      src={src} 
      alt={alt} 
      className={`inline-block object-contain select-none transition-transform duration-200 ${className}`} 
    />
  );
}


import React, { useState } from 'react';
import { useThemeProvider } from '@/components/layout/ThemeProvider';

interface PlatformLogoProps {
  platform: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const platformLogos = {
  mercadolivre: 'https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png',
  'mercado livre': 'https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png',
  shopify: 'https://cdn.freebiesupply.com/logos/large/2x/shopify-logo-png-transparent.png',
  shopee: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/1442px-Shopee_logo.svg.png',
  amazon: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png',
  magento: '/logos/magento.svg',
  woocommerce: '/logos/woocommerce.svg',
  vtex: '/logos/vtex.svg',
};

const platformLogosDark = {
  amazon: 'https://www.pngmart.com/files/23/Amazon-Logo-White-PNG-Photos.png',
};

const platformDarkInvert = {
  // Logos específicas por tema não precisam de inversão
};

const platformFallbacks = {
  mercadolivre: '🛒',
  shopify: '🛍️',
  shopee: '🛒',
  amazon: '📦',
  magento: '🏪',
  woocommerce: '🛒',
  vtex: '🏬',
};

const platformColors = {
  mercadolivre: 'bg-yellow-500',
  shopify: 'bg-green-500',
  shopee: 'bg-orange-600',
  amazon: 'bg-orange-500',
  magento: 'bg-red-500',
  woocommerce: 'bg-purple-500',
  vtex: 'bg-blue-500',
};

export const PlatformLogo: React.FC<PlatformLogoProps> = ({
  platform,
  size = 'md',
  className = '',
}) => {
  const { theme } = useThemeProvider();
  const isDark = theme === 'dark';
  const [imageFailed, setImageFailed] = useState(false);
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const normalizedPlatform = platform.toLowerCase().replace(/\s+/g, '');
  
  // Check if there's a dark mode specific logo
  const darkLogo = isDark ? (platformLogosDark[normalizedPlatform as keyof typeof platformLogosDark] || platformLogosDark[platform as keyof typeof platformLogosDark]) : null;
  const logoUrl = darkLogo || platformLogos[normalizedPlatform as keyof typeof platformLogos] || platformLogos[platform as keyof typeof platformLogos];
  
  const fallback = platformFallbacks[normalizedPlatform as keyof typeof platformFallbacks] || platformFallbacks[platform as keyof typeof platformFallbacks] || '🔌';
  const colorClass = platformColors[normalizedPlatform as keyof typeof platformColors] || platformColors[platform as keyof typeof platformColors] || 'bg-gray-500';
  // Don't apply dark-invert if we're using a dark-specific logo
  const shouldInvert = !darkLogo && (platformDarkInvert[normalizedPlatform as keyof typeof platformDarkInvert] || platformDarkInvert[platform as keyof typeof platformDarkInvert] || false);

  // Amazon logo size adjustment: larger in light mode
  const isAmazon = normalizedPlatform === 'amazon';
  const adjustedSizeClasses = isAmazon && !isDark ? {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  } : sizeClasses;

  // If logo URL exists and hasn't failed, render the image
  if (logoUrl && !imageFailed) {
    return (
      <img
        src={logoUrl}
        alt={`${platform} logo`}
        className={`${adjustedSizeClasses[size]} ${className} object-contain transition-all duration-200 ${shouldInvert ? 'dark-invert' : ''}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  // Fallback to colored div with emoji (safe React rendering, no innerHTML)
  return (
    <div className={`${adjustedSizeClasses[size]} ${colorClass} rounded flex items-center justify-center text-white text-xs font-bold ${className}`}>
      {fallback}
    </div>
  );
};

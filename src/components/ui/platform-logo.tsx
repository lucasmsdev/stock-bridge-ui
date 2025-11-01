import React from 'react';

interface PlatformLogoProps {
  platform: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const platformLogos = {
  mercadolivre: 'https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png',
  'mercado livre': 'https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png',
  shopify: '/logos/shopify.svg',
  shopee: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/1442px-Shopee_logo.svg.png',
  amazon: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png',
  magento: '/logos/magento.svg',
  woocommerce: '/logos/woocommerce.svg',
  vtex: '/logos/vtex.svg',
};

const platformDarkInvert = {
  amazon: true,
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
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const normalizedPlatform = platform.toLowerCase().replace(/\s+/g, '');
  const logoUrl = platformLogos[normalizedPlatform as keyof typeof platformLogos] || platformLogos[platform as keyof typeof platformLogos];
  const fallback = platformFallbacks[normalizedPlatform as keyof typeof platformFallbacks] || platformFallbacks[platform as keyof typeof platformFallbacks] || '🔌';
  const colorClass = platformColors[normalizedPlatform as keyof typeof platformColors] || platformColors[platform as keyof typeof platformColors] || 'bg-gray-500';
  const shouldInvert = platformDarkInvert[normalizedPlatform as keyof typeof platformDarkInvert] || platformDarkInvert[platform as keyof typeof platformDarkInvert] || false;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${platform} logo`}
        className={`${sizeClasses[size]} ${className} object-contain transition-all duration-200 ${shouldInvert ? 'dark-invert' : ''}`}
        onError={(e) => {
          // Fallback to emoji/color background if image fails to load
          const target = e.target as HTMLImageElement;
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<div class="${sizeClasses[size]} ${colorClass} rounded flex items-center justify-center text-white text-xs font-bold ${className}">${fallback}</div>`;
          }
        }}
      />
    );
  }

  // Fallback to colored div with emoji
  return (
    <div className={`${sizeClasses[size]} ${colorClass} rounded flex items-center justify-center text-white text-xs font-bold ${className}`}>
      {fallback}
    </div>
  );
};
import React from 'react';

export const Avatar = ({ src, name = 'User', size = 'md', isOnline = false, showStatus = true }) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  const resolvedSrc = React.useMemo(() => {
    if (!src) return '';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }
    if (src.startsWith('/uploads')) {
      const envUrl = import.meta.env.VITE_API_URL;
      if (envUrl) {
        const origin = envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
        return `${origin}${src}`;
      }
    }
    return src;
  }, [src]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl'
  };

  const statusDotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5'
  };

  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.substring(0, 2).toUpperCase();
  };

  const showImage = Boolean(resolvedSrc && !hasError);

  return (
    <div className="relative inline-block flex-shrink-0">
      {showImage ? (
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={name}
          className={`${sizeClasses[size] || sizeClasses.md} rounded-full object-cover border border-white/10 bg-slate-800 shadow-sm`}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={`${sizeClasses[size] || sizeClasses.md} rounded-full bg-gradient-to-tr from-[#991b1b] to-[#d3121f] text-white font-semibold flex items-center justify-center border border-white/10 shadow-sm select-none`}
        >
          {getInitials(name)}
        </div>
      )}

      {showStatus && isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${statusDotSizes[size] || statusDotSizes.md} rounded-full bg-emerald-500 ring-2 ring-[#0b0e14] dark:ring-[#0b0e14]`}
          title="Online"
        />
      )}
    </div>
  );
};

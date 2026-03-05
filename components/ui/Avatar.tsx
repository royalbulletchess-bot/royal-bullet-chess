'use client';

interface AvatarProps {
  src: string | null | undefined;
  username: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

// Generate a deterministic gradient background for wallet addresses
function getWalletGradient(address: string): string {
  const hash = address.slice(-6);
  const color1 = `#${hash}`;
  const color2 = `#${address.slice(2, 8)}`;
  return `linear-gradient(135deg, ${color1}, ${color2})`;
}

export default function Avatar({ src, username, size = 'md' }: AvatarProps) {
  const isWallet = username.startsWith('0x') && username.length > 10;
  const initials = isWallet ? username.slice(-4).toUpperCase() : username.slice(0, 2).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={username}
        className={`${sizeMap[size]} rounded-full object-cover bg-[var(--border)]`}
      />
    );
  }

  if (isWallet) {
    return (
      <div
        className={`${sizeMap[size]} rounded-full flex items-center justify-center font-bold text-white`}
        style={{ background: getWalletGradient(username) }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-[var(--accent)] flex items-center justify-center font-bold text-black`}
    >
      {initials}
    </div>
  );
}

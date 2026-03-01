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

export default function Avatar({ src, username, size = 'md' }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={username}
        className={`${sizeMap[size]} rounded-full object-cover bg-[var(--border)]`}
      />
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

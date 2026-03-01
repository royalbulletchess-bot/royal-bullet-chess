'use client';

import Button from '@/components/ui/Button';

interface DrawOfferBannerProps {
  onAccept: () => void;
  onReject: () => void;
  isResponding: boolean;
}

/**
 * Banner shown when the opponent offers a draw.
 * Player can accept or decline.
 */
export default function DrawOfferBanner({
  onAccept,
  onReject,
  isResponding,
}: DrawOfferBannerProps) {
  return (
    <div className="rounded-xl bg-[var(--card)] border border-[var(--accent)]/30 p-3 flex items-center justify-between gap-2">
      <p className="text-sm font-medium">
        ½ Draw offered
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onAccept}
          loading={isResponding}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onReject}
          loading={isResponding}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

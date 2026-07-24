const FALLBACK_IMAGE = "/player-fallback.svg";

interface PlayerPortraitProps {
  className?: string;
  name: string;
  src: string;
}

export function PlayerPortrait({
  className,
  name,
  src,
}: PlayerPortraitProps): React.JSX.Element {
  return (
    <img
      alt={name}
      className={className}
      onError={(event) => {
        if (event.currentTarget.dataset.fallback === "true") return;
        event.currentTarget.dataset.fallback = "true";
        event.currentTarget.src = FALLBACK_IMAGE;
      }}
      src={src}
    />
  );
}

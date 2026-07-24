interface ArrowIconProps {
  direction?: "left" | "right";
}

export function ArrowIcon({
  direction = "right",
}: ArrowIconProps): React.JSX.Element {
  const transform = direction === "left" ? "rotate(180 8 8)" : undefined;
  return (
    <svg
      aria-hidden="true"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path
        d="M2 8h10M8.5 3.5 13 8l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="1.5"
        transform={transform}
      />
    </svg>
  );
}


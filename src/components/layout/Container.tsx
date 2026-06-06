type Width = "default" | "wide" | "full";

const widthMap: Record<Width, string> = {
  default: "max-w-7xl",
  wide: "max-w-[1600px]",
  full: "max-w-none",
};

export function Container({
  children,
  className = "",
  width = "wide",
}: {
  children: React.ReactNode;
  className?: string;
  width?: Width;
}) {
  return (
    <div className={`${widthMap[width]} mx-auto px-6 sm:px-10 lg:px-16 ${className}`}>
      {children}
    </div>
  );
}

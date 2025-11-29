export function Button({
  className = "",
  children,
  props,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  props?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl border shadow bg-gray-100 hover:bg-gray-200 transition ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

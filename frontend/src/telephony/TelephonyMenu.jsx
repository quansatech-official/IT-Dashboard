import { PhoneCall } from "lucide-react";

export default function TelephonyMenu({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left pl-4 pr-3 py-2.5 rounded-xl text-sm font-medium
        flex items-center gap-3 transition-colors duration-150
        ${active
          ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
          : "text-sand-700 hover:bg-sand-100 hover:text-sand-900"
        }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--nav-accent)]" />
      )}
      <PhoneCall size={16} className="shrink-0 opacity-80" />
      Telefonie
    </button>
  );
}

import { PhoneCall } from "lucide-react";

export default function TelephonyMenu({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-2xl border ${
        active
          ? "bg-sand-900 text-white border-sand-900"
          : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
      } flex items-center gap-3`}
    >
      <PhoneCall size={18} /> Telefonie
    </button>
  );
}

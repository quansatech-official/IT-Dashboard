import { statusStyles } from "../constants";

export default function StatusPicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {["Grün", "Gelb", "Rot"].map((status) => (
        <button
          key={status}
          onClick={() => onChange(status)}
          className={`px-3 py-1.5 rounded-full border text-sm ${
            statusStyles[status]
          } ${value === status ? "ring-2 ring-slate-900/20" : "opacity-70 hover:opacity-100"}`}
        >
          {status}
        </button>
      ))}
    </div>
  );
}

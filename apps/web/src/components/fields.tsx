import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export function Field({
  label, hint, children, htmlFor,
}: { label: string; hint?: string; children: (id: string) => ReactNode; htmlFor?: string }) {
  const auto = useId();
  const id = htmlFor ?? auto;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <p className="mt-1 text-[12px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}

export function TextInput({
  id, value, onChange, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input id={id} type="text" className="input" value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} />
  );
}

export function NumberInput({
  id, value, onChange, min, step = 1, suffix, allowEmpty = false, placeholder,
}: {
  id: string; value: number | null; onChange: (v: number | null) => void;
  min?: number; step?: number; suffix?: string; allowEmpty?: boolean; placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={`input num ${suffix ? "pr-14" : ""}`}
        value={value ?? ""}
        min={min}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(allowEmpty ? null : 0);
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : allowEmpty ? null : 0);
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center font-mono text-[12px] text-faint">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function DateInput({
  id, value, onChange,
}: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <input id={id} type="date" className="input num" value={value}
      onChange={(e) => onChange(e.target.value)} />
  );
}

export function Select({
  id, value, onChange, children, ...rest
}: { id: string; value: string; onChange: (v: string) => void; children: ReactNode }
  & Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "id">) {
  return (
    <div className="relative">
      <select id={id} className="input pr-9" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {children}
      </select>
      <ChevronDown size={15} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
              active ? "bg-accent text-accent-ink shadow-sm" : "text-mute hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-line-soft bg-surface px-3.5 py-3 text-left transition-colors hover:border-line"
    >
      <span>
        <span className="block text-[14px] text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-faint">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line"}`}
        style={{ height: 22, width: 38 }}
      >
        <span
          className="absolute top-[3px] size-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(19px)" : "translateX(3px)" }}
        />
      </span>
    </button>
  );
}

export function Advanced({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line-soft bg-surface open:pb-4">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-[13.5px] font-medium text-mute transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 px-3.5 pt-1">{children}</div>
    </details>
  );
}

import { FormEvent, useState } from "react";

interface ChatInputProps {
  disabled: boolean;
  onSend: (content: string) => void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const content = value.trim();

    if (!content || disabled) return;

    onSend(content);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200/80 p-3">
      <div className="flex items-end gap-2 rounded-2xl bg-slate-100 p-1.5 pl-3">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          placeholder="Tulis pesan..."
          className="max-h-24 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          aria-label="Pesan"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Kirim pesan"
        >
          <span aria-hidden="true">&uarr;</span>
        </button>
      </div>
    </form>
  );
}

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Globe2 } from "lucide-react";

export const flagRegions = [
  "PL",
  "GB",
  "US",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "SE",
  "UA",
  "CZ",
  "CA",
  "AU",
  "BR",
  "JP",
  "KR",
  "IN",
];

interface Choice {
  value: string;
  label: string;
  flag?: string;
  lang?: string;
}

function Flag({ region }: { region?: string }) {
  return region && flagRegions.includes(region) ? (
    <img
      className="locale-flag"
      src={`/flags/${region.toLowerCase()}.svg`}
      alt=""
    />
  ) : (
    <Globe2 className="locale-flag" aria-hidden="true" />
  );
}

export function FlagSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280,
  });
  const selected =
    options.find((option) => option.value === value) || options[0];

  function close() {
    typed.current = { text: "", time: 0 };
    setOpen(false);
    if (list.current?.matches(":popover-open")) list.current.hidePopover();
  }
  function show(
    index = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  ) {
    const box = trigger.current!.getBoundingClientRect();
    const height = Math.min(280, options.length * 44 + 16);
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    const downward = below >= height || below >= above;
    const maxHeight = Math.max(44, Math.min(height, downward ? below : above));
    setPosition({
      top: downward ? box.bottom + 4 : Math.max(8, box.top - maxHeight - 4),
      left: Math.max(8, Math.min(box.left, window.innerWidth - box.width - 8)),
      width: box.width,
      maxHeight,
    });
    setActive(index);
    setOpen(true);
    list.current!.showPopover();
  }
  function choose(option: Choice) {
    close();
    onChange(option.value);
    trigger.current?.focus();
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length;
      if (open) setActive(next);
      else show(event.key === "Home" || event.key === "End" ? next : undefined);
    } else if (open && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      choose(options[active]);
    } else if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    } else if (
      event.key.length === 1 &&
      event.key !== " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = performance.now();
      const text =
        (now - typed.current.time < 700 ? typed.current.text : "") + event.key;
      typed.current = { text: text.slice(-32), time: now };
      const index = options.findIndex((option) =>
        option.label
          .toLocaleLowerCase()
          .startsWith(typed.current.text.toLocaleLowerCase()),
      );
      if (index >= 0) {
        if (open) setActive(index);
        else show(index);
      }
    }
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = () => {
      if (list.current?.matches(":popover-open")) list.current.hidePopover();
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && !list.current?.contains(event.target))
        dismiss();
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id, open]);

  return (
    <div className="flag-select">
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={trigger}
        type="button"
        className="flag-select-trigger"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={keyboard}
      >
        <Flag region={selected.flag} />
        <span lang={selected.lang}>{selected.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div
        ref={list}
        id={id}
        popover="auto"
        className="flag-options"
        role="listbox"
        aria-labelledby={`${id}-label`}
        style={position}
        onToggle={(event) =>
          setOpen(event.currentTarget.matches(":popover-open"))
        }
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={option.value === value}
            data-active={index === active}
            lang={option.lang}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
          >
            <Flag region={option.flag} />
            <span>{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

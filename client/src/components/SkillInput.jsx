// Tag input with autocomplete from the skill catalog (/api/catalog/skills).
import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounce } from '../lib/hooks';

export default function SkillInput({ label, value = [], onChange, placeholder = 'Type a skill and press Enter', max = 30, hint }) {
  const id = useId();
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const q = useDebounce(text, 200);

  useEffect(() => {
    if (!q.trim()) { setSuggestions([]); return undefined; }
    const ctrl = new AbortController();
    api.get('/catalog/skills', { q, limit: 8 }, { signal: ctrl.signal })
      .then((d) => {
        setSuggestions(d.skills.filter((s) => !value.some((v) => v.toLowerCase() === s.name.toLowerCase())));
        setActive(0);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [q, value]);

  const add = (name) => {
    const clean = name.trim().slice(0, 60);
    if (!clean || value.length >= max || value.some((v) => v.toLowerCase() === clean.toLowerCase())) return;
    onChange([...value, clean]);
    setText('');
    setSuggestions([]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(open && suggestions[active] ? suggestions[active].name : text);
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {value.length > 0 && (
        <div className="chips" style={{ marginBottom: 6 }}>
          {value.map((s) => (
            <span className="chip" key={s}>
              {s}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="ac">
        <input
          id={id} className="input" value={text} placeholder={placeholder} autoComplete="off"
          role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls={`${id}-list`}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && suggestions.length > 0 && (
          <ul className="ac-list" id={`${id}-list`} role="listbox">
            {suggestions.map((s, i) => (
              <li key={s.name} role="option" aria-selected={i === active} onMouseDown={() => add(s.name)}>
                {s.name}<span className="subtle">{s.category}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

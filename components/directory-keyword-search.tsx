"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AppLocale } from '@/i18n/routing';
import type { SearchSuggestion } from '@/lib/directory-search';

export default function DirectoryKeywordSearch({ locale, defaultValue = '' }: { locale: AppLocale; defaultValue?: string }) {
  const t = useTranslations('Search');
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const form = input.current?.form;
    const changed = (event: Event) => { if (event.target !== input.current) { setItems([]); setActive(-1); setRevision(value => value + 1); } };
    form?.addEventListener('change', changed);
    return () => form?.removeEventListener('change', changed);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const form = input.current?.form;
      if (!form) return;
      const params = new URLSearchParams({ locale, q: query });
      const fields = new FormData(form);
      for (const key of ['sprache', 'branche', 'kanton', 'ort']) params.set(key, String(fields.get(key) || ''));
      try {
        const response = await fetch(`/api/directory-search?${params}`, { signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json() as { items: SearchSuggestion[] };
        if (!controller.signal.aborted) setItems(result.items);
      } catch { /* Submitting the normal search remains available. */ }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, locale, revision]);

  const visible = open && items.length > 0;
  function select(item: SearchSuggestion) {
    setQuery(item.name);
    setOpen(false);
    setActive(-1);
    // FormData must contain the chosen value before submitting the GET form.
    if (input.current) { input.current.value = item.name; input.current.form?.requestSubmit(); }
  }

  return <div className="directory-keyword field-group">
    <label className="field-label" htmlFor={id}>{t('keyword')}</label>
    <div className="directory-keyword-input">
    <input ref={input} id={id} name="q" type="search" maxLength={200} value={query}
      placeholder={t('keywordPlaceholder')} className="field-control" autoComplete="off"
      role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={`${id}-options`}
      aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined} aria-describedby={`${id}-help`}
      onChange={event => { setQuery(event.target.value); setItems([]); setActive(-1); setOpen(true); }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); setActive(-1); }
        if (items.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          setOpen(true);
          setActive(value => value < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (value + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
        }
        if (visible && event.key === 'Enter' && active >= 0) { event.preventDefault(); select(items[active]); }
      }} />
    <ul id={`${id}-options`} role="listbox" aria-label={t('suggestions')} className="directory-suggestions" hidden={!visible}>
      {items.map((item, index) => <li key={item.id} id={`${id}-${index}`} role="option" aria-selected={active === index}
        onMouseDown={event => event.preventDefault()} onClick={() => select(item)}>
        <span>{item.name}</span><small>{item.city}</small>
      </li>)}
    </ul>
    </div>
    <span id={`${id}-help`} className="directory-keyword-help">{t('keywordHelp')}</span>
  </div>;
}

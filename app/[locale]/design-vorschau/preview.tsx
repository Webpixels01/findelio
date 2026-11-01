"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./preview.module.css";

const companies = [
  { name: "Studio Forma", initials: "sf.", category: "Architektur", city: "Zürich", zip: "8001", canton: "ZH", languages: ["Deutsch", "Italienisch", "Englisch"], description: "Räume, die zu deinem Leben passen. Persönliche Begleitung vom ersten Entwurf bis zum Einzug.", tone: "sand" },
  { name: "Praxis am Park", initials: "p+", category: "Gesundheit", city: "Winterthur", zip: "8400", canton: "ZH", languages: ["Deutsch", "Englisch", "Portugiesisch"], description: "Zeit für deine Gesundheit. Verständliche Beratung und eine Betreuung, bei der du dich wohlfühlst.", tone: "green" },
  { name: "Garage Bellavista", initials: "gb", category: "Auto & Mobilität", city: "Baden", zip: "5400", canton: "AG", languages: ["Deutsch", "Italienisch"], description: "Dein Auto in guten Händen. Service, Reparaturen und ehrliche Beratung aus einer Hand.", tone: "blue" },
];
const languages = ["Deutsch", "Italienisch", "Englisch", "Portugiesisch"];

export default function DesignPreview() {
  const [language, setLanguage] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [canton, setCanton] = useState("");
  const [filters, setFilters] = useState({ language: "", industry: "", location: "", canton: "" });
  const [selected, setSelected] = useState<(typeof companies)[number] | null>(null);
  const filtered = companies.filter(c => (!filters.language || c.languages.includes(filters.language)) && (!filters.industry || c.category === filters.industry) && (!filters.canton || c.canton === filters.canton) && (!filters.location || `${c.city} ${c.zip}`.toLowerCase().includes(filters.location.toLowerCase().trim())));
  function search() {
    setFilters({ language, industry, location, canton });
    document.getElementById("entdecken")?.scrollIntoView({ behavior: "smooth" });
  }

  return <div className={styles.preview}>
    <div className={styles.previewBar}><span>DESIGNVORSCHAU <span className={styles.barNote}>· Interaktiv mit fiktiven Beispieldaten</span></span><a href="/de-ch">Original ansehen ↗</a></div>
    <header className={styles.header}>
      <a href="#" aria-label="Findelio Startseite"><Image src="/findelio-logo-horizontal.svg" alt="Findelio" width={145} height={44} unoptimized /></a>
      <nav aria-label="Vorschau-Navigation"><a href="#entdecken">Unternehmen entdecken</a><a href="#ablauf">So funktioniert’s</a></nav>
      <a className={styles.headerCta} href="/de-ch/firma-eintragen">Firma eintragen <span>↗</span></a>
    </header>
    <main>
      <section className={styles.hero}>
        <div className={styles.heroTop}><div><p className={styles.eyebrow}><span /> IN DER SCHWEIZ ZUHAUSE. IN DEINER SPRACHE.</p><h1>Finde Unternehmen,<br /><span>die deine Sprache sprechen.</span></h1><p className={styles.intro}>Finde Menschen vom Fach, die deine Sprache sprechen.<br className={styles.desktopBreak} /> In deiner Nähe. Für das, was du gerade brauchst.</p></div><div className={styles.languageArt} aria-hidden="true"><span>Ciao!</span><span>Grüezi.</span><span>Olá!</span><div>Verstehen verbindet.</div></div></div>
        <form className={styles.search} onSubmit={e => { e.preventDefault(); search(); }}>
          <div className={styles.searchRow}>
            <label><span>DEINE SPRACHE</span><select value={language} onChange={e => setLanguage(e.target.value)}><option value="">Sprache auswählen</option>{languages.map(l => <option key={l}>{l}</option>)}</select></label>
            <label><span>WAS SUCHST DU?</span><select value={industry} onChange={e => setIndustry(e.target.value)}><option value="">Alle Branchen</option>{companies.map(c => <option key={c.category}>{c.category}</option>)}</select></label>
            <label><span>WO SUCHST DU?</span><input placeholder="Ort oder PLZ" value={location} onChange={e => setLocation(e.target.value)} /></label>
            <button className={styles.button} type="submit">Unternehmen finden <span>→</span></button>
          </div>
          <details className={styles.more}><summary>Weitere Filter</summary><label>Kanton<select value={canton} onChange={e => setCanton(e.target.value)}><option value="">Alle Kantone</option><option value="ZH">Zürich</option><option value="AG">Aargau</option></select></label></details>
        </form>
        <div className={styles.quick}><span>Entdecke zum Beispiel</span>{companies.map(c => <button key={c.category} onClick={() => { setIndustry(c.category); setFilters({ language: "", industry: c.category, location: "", canton: "" }); setLanguage(""); setLocation(""); setCanton(""); document.getElementById("entdecken")?.scrollIntoView({ behavior: "smooth" }); }}>{c.category} ↗</button>)}</div>
      </section>
      <section className={styles.results} id="entdecken">
        <div className={styles.sectionHead}><div><p className={styles.eyebrow}>NAH. PERSÖNLICH. MEHRSPRACHIG.</p><h2>Hier beginnt eine gute Verbindung.</h2><p>Entdecke, wie dein nächster Kontakt aussehen könnte.</p></div><span className={styles.example}>Beispielprofile</span></div>
        <div className={styles.resultStatus} aria-live="polite">{filtered.length} Beispielunternehmen{filters.language && ` · Beratung auf ${filters.language}`}</div>
        <div className={styles.cards}>{filtered.map(c => <article key={c.name} className={styles.card}>
          <div className={styles.cardTop}><div className={`${styles.logo} ${styles[c.tone]}`}>{c.initials}</div><span>{c.category}</span></div>
          <h3>{c.name}</h3><p className={styles.place}>⌖ {c.zip} {c.city}</p><p className={styles.description}>{c.description}</p>
          <div className={styles.languages}>{c.languages.map(l => <span className={l === filters.language ? styles.activeLanguage : ""} key={l}>{l === filters.language ? "✓ " : ""}{l}</span>)}</div>
          <button className={styles.profileLink} onClick={() => setSelected(c)}>Beispielprofil ansehen <span>↗</span></button>
        </article>)}</div>
        {filtered.length === 0 && <div className={styles.empty}><h3>Hier passt noch kein Beispielprofil.</h3><p>Versuche es mit einer anderen Branche oder einem grösseren Suchgebiet.</p><button onClick={() => { setLocation(""); setCanton(""); setFilters({ ...filters, location: "", canton: "" }); }}>Ohne Ortsfilter suchen</button><button onClick={() => { setIndustry(""); setFilters({ ...filters, industry: "" }); }}>Alle Branchen anzeigen</button><button onClick={() => { setLanguage(""); setIndustry(""); setLocation(""); setCanton(""); setFilters({ language: "", industry: "", location: "", canton: "" }); }}>Alles zurücksetzen</button></div>}
      </section>
      <section className={styles.how} id="ablauf"><div><p className={styles.eyebrow}>EINFACH ZUM PASSENDEN KONTAKT</p><h2>Weniger suchen.<br />Besser verstehen.</h2></div><ol><li><span>01</span><div><h3>Sag uns, was du suchst.</h3><p>Wähle deine Sprache, eine Branche und deinen Ort.</p></div></li><li><span>02</span><div><h3>Finde ein gutes Gefühl.</h3><p>Lerne Unternehmen und ihre Angebote im Profil kennen.</p></div></li><li><span>03</span><div><h3>Komm ins Gespräch.</h3><p>Nimm direkt mit deinem passenden Unternehmen Kontakt auf.</p></div></li></ol></section>
      <section className={styles.business}><div><p>FÜR UNTERNEHMEN</p><h2>Deine Sprachen sind deine Stärke.</h2><span>Zeig, was du kannst. Und in welchen Sprachen du für deine Kundschaft da bist.</span></div><a href="/de-ch/firma-eintragen">Firma eintragen <span>↗</span></a></section>
    </main>
    {selected && <div className={styles.modalBackdrop} onClick={() => setSelected(null)}><dialog open aria-labelledby="demo-title" className={styles.modal} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") setSelected(null); }}><button autoFocus className={styles.close} onClick={() => setSelected(null)}>Schliessen ×</button><p className={styles.eyebrow}>FIKTIVES BEISPIELPROFIL</p><h2 id="demo-title">{selected.name}</h2><p>{selected.category} · {selected.city}</p><p>{selected.description}</p><p>Beratung auf {selected.languages.join(", ")}</p><p>Diese Karte dient der Designvorschau. Es werden keine Kontaktdaten übermittelt.</p></dialog></div>}
  </div>;
}

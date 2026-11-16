BEGIN;

-- Extend locale checks for six additional UI languages.
-- Keep all existing languages, spoken languages and translations.
ALTER TABLE organization_invitations DROP CONSTRAINT organization_invitations_locale_check;
ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_locale_check
  CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi', 'it', 'fr', 'uk', 'bs', 'sr', 'sl'));
ALTER TABLE deletion_requests DROP CONSTRAINT deletion_requests_locale_check;
ALTER TABLE deletion_requests ADD CONSTRAINT deletion_requests_locale_check
  CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi', 'it', 'fr', 'uk', 'bs', 'sr', 'sl'));
ALTER TABLE blog_posts DROP CONSTRAINT blog_posts_locale_check;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_locale_check
  CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi', 'it', 'fr', 'uk', 'bs', 'sr', 'sl'));

-- Preserve other Directus interface options and choices.
UPDATE directus_fields
SET options = jsonb_set(
  COALESCE(options::jsonb, '{}'::jsonb),
  '{choices}',
  COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    || '[{"text":"Italiano","value":"it"}]'::jsonb
)
WHERE collection IN ('organization_invitations', 'deletion_requests', 'blog_posts')
  AND field = 'locale'
  AND NOT COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    @> '[{"value":"it"}]'::jsonb;

UPDATE directus_fields
SET options = jsonb_set(
  COALESCE(options::jsonb, '{}'::jsonb),
  '{choices}',
  COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    || '[{"text":"Français","value":"fr"}]'::jsonb
)
WHERE collection IN ('organization_invitations', 'deletion_requests', 'blog_posts')
  AND field = 'locale'
  AND NOT COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    @> '[{"value":"fr"}]'::jsonb;

UPDATE directus_fields
SET options = jsonb_set(
  COALESCE(options::jsonb, '{}'::jsonb),
  '{choices}',
  COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    || '[{"text":"Українська","value":"uk"}]'::jsonb
)
WHERE collection IN ('organization_invitations', 'deletion_requests', 'blog_posts')
  AND field = 'locale'
  AND NOT COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    @> '[{"value":"uk"}]'::jsonb;

UPDATE directus_fields
SET options = jsonb_set(
  COALESCE(options::jsonb, '{}'::jsonb),
  '{choices}',
  COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    || '[{"text":"Bosanski","value":"bs"}]'::jsonb
)
WHERE collection IN ('organization_invitations', 'deletion_requests', 'blog_posts')
  AND field = 'locale'
  AND NOT COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    @> '[{"value":"bs"}]'::jsonb;

UPDATE directus_fields
SET options = jsonb_set(
  COALESCE(options::jsonb, '{}'::jsonb),
  '{choices}',
  COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    || '[{"text":"Srpski","value":"sr"}]'::jsonb
)
WHERE collection IN ('organization_invitations', 'deletion_requests', 'blog_posts')
  AND field = 'locale'
  AND NOT COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    @> '[{"value":"sr"}]'::jsonb;

UPDATE directus_fields
SET options = jsonb_set(
  COALESCE(options::jsonb, '{}'::jsonb),
  '{choices}',
  COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    || '[{"text":"Slovenščina","value":"sl"}]'::jsonb
)
WHERE collection IN ('organization_invitations', 'deletion_requests', 'blog_posts')
  AND field = 'locale'
  AND NOT COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    @> '[{"value":"sl"}]'::jsonb;

-- UI translation languages for industries and spoken languages.
INSERT INTO languages (code) VALUES ('it-IT') ON CONFLICT (code) DO NOTHING;
INSERT INTO languages (code) VALUES ('fr-FR') ON CONFLICT (code) DO NOTHING;
INSERT INTO languages (code) VALUES ('uk-UA') ON CONFLICT (code) DO NOTHING;
INSERT INTO languages (code) VALUES ('bs-BA') ON CONFLICT (code) DO NOTHING;
INSERT INTO languages (code) VALUES ('sr-Latn') ON CONFLICT (code) DO NOTHING;
INSERT INTO languages (code) VALUES ('sl-SI') ON CONFLICT (code) DO NOTHING;
INSERT INTO spoken_languages (id, code, name)
SELECT gen_random_uuid(), 'it', 'Italienisch'
WHERE NOT EXISTS (SELECT 1 FROM spoken_languages WHERE code = 'it');

INSERT INTO spoken_languages (id, code, name)
SELECT gen_random_uuid(), 'fr', 'Französisch'
WHERE NOT EXISTS (SELECT 1 FROM spoken_languages WHERE code = 'fr');

INSERT INTO spoken_languages (id, code, name)
SELECT gen_random_uuid(), 'uk', 'Ukrainisch'
WHERE NOT EXISTS (SELECT 1 FROM spoken_languages WHERE code = 'uk');

INSERT INTO spoken_languages (id, code, name)
SELECT gen_random_uuid(), 'bs', 'Bosnisch'
WHERE NOT EXISTS (SELECT 1 FROM spoken_languages WHERE code = 'bs');

INSERT INTO spoken_languages (id, code, name)
SELECT gen_random_uuid(), 'sr', 'Serbisch'
WHERE NOT EXISTS (SELECT 1 FROM spoken_languages WHERE code = 'sr');

INSERT INTO spoken_languages (id, code, name)
SELECT gen_random_uuid(), 'sl', 'Slowenisch'
WHERE NOT EXISTS (SELECT 1 FROM spoken_languages WHERE code = 'sl');

-- Industry names in it-IT
WITH names(code, name) AS (VALUES
  ('auto-mobilitaet', 'Auto e mobilità'),
  ('bau-handwerk', 'Edilizia e artigianato'),
  ('beauty-wellness', 'Bellezza e benessere'),
  ('beratung-coaching', 'Consulenza e coaching'),
  ('bildung-nachhilfe', 'Istruzione e ripetizioni'),
  ('computer-it', 'Informatica e IT'),
  ('detailhandel', 'Commercio al dettaglio'),
  ('druck-design-werbung', 'Stampa, design e pubblicità'),
  ('energie-umwelt', 'Energia e ambiente'),
  ('finanzen-versicherungen', 'Finanze e assicurazioni'),
  ('fotografie-video', 'Fotografia e video'),
  ('freizeit-kultur', 'Tempo libero e cultura'),
  ('gastronomie', 'Gastronomia'),
  ('gesundheit-medizin', 'Salute e medicina'),
  ('haustiere', 'Animali domestici'),
  ('hotel-unterkunft', 'Hotel e alloggio'),
  ('immobilien', 'Immobili'),
  ('industrie-produktion', 'Industria e produzione'),
  ('kinder-familie', 'Bambini e famiglia'),
  ('landwirtschaft', 'Agricoltura'),
  ('lebensmittel', 'Alimentari'),
  ('logistik-transport', 'Logistica e trasporti'),
  ('marketing-kommunikation', 'Marketing e comunicazione'),
  ('mode-textilien', 'Moda e tessili'),
  ('musik-veranstaltungen', 'Musica ed eventi'),
  ('personal-recruiting', 'Personale e recruiting'),
  ('pflege-betreuung', 'Assistenza e cura'),
  ('recht-steuern', 'Diritto e tasse'),
  ('reinigung-gebaeudeservice', 'Pulizie e servizi immobiliari'),
  ('reisen-tourismus', 'Viaggi e turismo'),
  ('sicherheit', 'Sicurezza'),
  ('sonstige-dienstleistungen', 'Altri servizi'),
  ('sport-fitness', 'Sport e fitness'),
  ('telekommunikation', 'Telecomunicazioni'),
  ('uebersetzung-dolmetschen', 'Traduzione e interpretariato'),
  ('umzug-entsorgung', 'Traslochi e smaltimento'),
  ('vereine-organisationen', 'Associazioni e organizzazioni'),
  ('verwaltung-behoerden', 'Amministrazione e autorità'),
  ('wohnen-einrichtung', 'Abitare e arredamento')
)
INSERT INTO industries_translations (industries_id, languages_code, name)
SELECT i.id, 'it-IT', names.name FROM names JOIN industries i USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM industries_translations t
  WHERE t.industries_id = i.id AND t.languages_code = 'it-IT'
);

-- Spoken language names in it-IT
WITH names(code, name) AS (VALUES
  ('ar', 'Arabo'),
  ('bg', 'Bulgaro'),
  ('bs', 'Bosniaco'),
  ('cs', 'Ceco'),
  ('de', 'Tedesco'),
  ('el', 'Greco'),
  ('en', 'Inglese'),
  ('es', 'Spagnolo'),
  ('fr', 'Francese'),
  ('gsw', 'Tedesco svizzero'),
  ('hr', 'Croato'),
  ('hu', 'Ungherese'),
  ('it', 'Italiano'),
  ('mk', 'Macedone'),
  ('nl', 'Olandese'),
  ('pl', 'Polacco'),
  ('pt', 'Portoghese'),
  ('rm', 'Romancio'),
  ('ro', 'Rumeno'),
  ('ru', 'Russo'),
  ('sk', 'Slovacco'),
  ('sl', 'Sloveno'),
  ('sq', 'Albanese'),
  ('sr', 'Serbo'),
  ('tr', 'Turco'),
  ('uk', 'Ucraino'),
  ('vi', 'Vietnamita')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, 'it-IT', names.name FROM names JOIN spoken_languages s USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = 'it-IT'
);

-- Industry names in fr-FR
WITH names(code, name) AS (VALUES
  ('auto-mobilitaet', 'Auto et mobilité'),
  ('bau-handwerk', 'Construction et artisanat'),
  ('beauty-wellness', 'Beauté et bien-être'),
  ('beratung-coaching', 'Conseil et coaching'),
  ('bildung-nachhilfe', 'Formation et soutien scolaire'),
  ('computer-it', 'Informatique et IT'),
  ('detailhandel', 'Commerce de détail'),
  ('druck-design-werbung', 'Impression, design et publicité'),
  ('energie-umwelt', 'Énergie et environnement'),
  ('finanzen-versicherungen', 'Finances et assurances'),
  ('fotografie-video', 'Photographie et vidéo'),
  ('freizeit-kultur', 'Loisirs et culture'),
  ('gastronomie', 'Gastronomie'),
  ('gesundheit-medizin', 'Santé et médecine'),
  ('haustiere', 'Animaux de compagnie'),
  ('hotel-unterkunft', 'Hôtellerie et hébergement'),
  ('immobilien', 'Immobilier'),
  ('industrie-produktion', 'Industrie et production'),
  ('kinder-familie', 'Enfants et famille'),
  ('landwirtschaft', 'Agriculture'),
  ('lebensmittel', 'Denrées alimentaires'),
  ('logistik-transport', 'Logistique et transport'),
  ('marketing-kommunikation', 'Marketing et communication'),
  ('mode-textilien', 'Mode et textiles'),
  ('musik-veranstaltungen', 'Musique et événements'),
  ('personal-recruiting', 'Personnel et recrutement'),
  ('pflege-betreuung', 'Soins et accompagnement'),
  ('recht-steuern', 'Droit et fiscalité'),
  ('reinigung-gebaeudeservice', 'Nettoyage et services aux bâtiments'),
  ('reisen-tourismus', 'Voyages et tourisme'),
  ('sicherheit', 'Sécurité'),
  ('sonstige-dienstleistungen', 'Autres services'),
  ('sport-fitness', 'Sport et fitness'),
  ('telekommunikation', 'Télécommunications'),
  ('uebersetzung-dolmetschen', 'Traduction et interprétation'),
  ('umzug-entsorgung', 'Déménagement et élimination'),
  ('vereine-organisationen', 'Associations et organisations'),
  ('verwaltung-behoerden', 'Administration et autorités'),
  ('wohnen-einrichtung', 'Habitat et ameublement')
)
INSERT INTO industries_translations (industries_id, languages_code, name)
SELECT i.id, 'fr-FR', names.name FROM names JOIN industries i USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM industries_translations t
  WHERE t.industries_id = i.id AND t.languages_code = 'fr-FR'
);

-- Spoken language names in fr-FR
WITH names(code, name) AS (VALUES
  ('ar', 'Arabe'),
  ('bg', 'Bulgare'),
  ('bs', 'Bosniaque'),
  ('cs', 'Tchèque'),
  ('de', 'Allemand'),
  ('el', 'Grec'),
  ('en', 'Anglais'),
  ('es', 'Espagnol'),
  ('fr', 'Français'),
  ('gsw', 'Allemand suisse'),
  ('hr', 'Croate'),
  ('hu', 'Hongrois'),
  ('it', 'Italien'),
  ('mk', 'Macédonien'),
  ('nl', 'Néerlandais'),
  ('pl', 'Polonais'),
  ('pt', 'Portugais'),
  ('rm', 'Romanche'),
  ('ro', 'Roumain'),
  ('ru', 'Russe'),
  ('sk', 'Slovaque'),
  ('sl', 'Slovène'),
  ('sq', 'Albanais'),
  ('sr', 'Serbe'),
  ('tr', 'Turc'),
  ('uk', 'Ukrainien'),
  ('vi', 'Vietnamien')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, 'fr-FR', names.name FROM names JOIN spoken_languages s USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = 'fr-FR'
);

-- Industry names in uk-UA
WITH names(code, name) AS (VALUES
  ('auto-mobilitaet', 'Авто та мобільність'),
  ('bau-handwerk', 'Будівництво та ремесла'),
  ('beauty-wellness', 'Краса та велнес'),
  ('beratung-coaching', 'Консалтинг і коучинг'),
  ('bildung-nachhilfe', 'Освіта та репетиторство'),
  ('computer-it', 'Комп’ютери та ІТ'),
  ('detailhandel', 'Роздрібна торгівля'),
  ('druck-design-werbung', 'Друк, дизайн і реклама'),
  ('energie-umwelt', 'Енергія та довкілля'),
  ('finanzen-versicherungen', 'Фінанси та страхування'),
  ('fotografie-video', 'Фотографія та відео'),
  ('freizeit-kultur', 'Дозвілля та культура'),
  ('gastronomie', 'Гастрономія'),
  ('gesundheit-medizin', 'Здоров’я та медицина'),
  ('haustiere', 'Домашні тварини'),
  ('hotel-unterkunft', 'Готелі та проживання'),
  ('immobilien', 'Нерухомість'),
  ('industrie-produktion', 'Промисловість і виробництво'),
  ('kinder-familie', 'Діти та сім’я'),
  ('landwirtschaft', 'Сільське господарство'),
  ('lebensmittel', 'Продукти харчування'),
  ('logistik-transport', 'Логістика та транспорт'),
  ('marketing-kommunikation', 'Маркетинг і комунікації'),
  ('mode-textilien', 'Мода та текстиль'),
  ('musik-veranstaltungen', 'Музика та події'),
  ('personal-recruiting', 'Персонал і рекрутинг'),
  ('pflege-betreuung', 'Догляд і опіка'),
  ('recht-steuern', 'Право та податки'),
  ('reinigung-gebaeudeservice', 'Прибирання та обслуговування будівель'),
  ('reisen-tourismus', 'Подорожі та туризм'),
  ('sicherheit', 'Безпека'),
  ('sonstige-dienstleistungen', 'Інші послуги'),
  ('sport-fitness', 'Спорт і фітнес'),
  ('telekommunikation', 'Телекомунікації'),
  ('uebersetzung-dolmetschen', 'Переклад і усний переклад'),
  ('umzug-entsorgung', 'Переїзд і утилізація'),
  ('vereine-organisationen', 'Асоціації та організації'),
  ('verwaltung-behoerden', 'Адміністрація та органи влади'),
  ('wohnen-einrichtung', 'Житло та облаштування')
)
INSERT INTO industries_translations (industries_id, languages_code, name)
SELECT i.id, 'uk-UA', names.name FROM names JOIN industries i USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM industries_translations t
  WHERE t.industries_id = i.id AND t.languages_code = 'uk-UA'
);

-- Spoken language names in uk-UA
WITH names(code, name) AS (VALUES
  ('ar', 'Арабська'),
  ('bg', 'Болгарська'),
  ('bs', 'Боснійська'),
  ('cs', 'Чеська'),
  ('de', 'Німецька'),
  ('el', 'Грецька'),
  ('en', 'Англійська'),
  ('es', 'Іспанська'),
  ('fr', 'Французька'),
  ('gsw', 'Швейцарська німецька'),
  ('hr', 'Хорватська'),
  ('hu', 'Угорська'),
  ('it', 'Італійська'),
  ('mk', 'Македонська'),
  ('nl', 'Нідерландська'),
  ('pl', 'Польська'),
  ('pt', 'Португальська'),
  ('rm', 'Ретороманська'),
  ('ro', 'Румунська'),
  ('ru', 'Російська'),
  ('sk', 'Словацька'),
  ('sl', 'Словенська'),
  ('sq', 'Албанська'),
  ('sr', 'Сербська'),
  ('tr', 'Турецька'),
  ('uk', 'Українська'),
  ('vi', 'В’єтнамська')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, 'uk-UA', names.name FROM names JOIN spoken_languages s USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = 'uk-UA'
);

-- Industry names in bs-BA
WITH names(code, name) AS (VALUES
  ('auto-mobilitaet', 'Auto i mobilnost'),
  ('bau-handwerk', 'Građevinarstvo i zanati'),
  ('beauty-wellness', 'Ljepota i wellness'),
  ('beratung-coaching', 'Savjetovanje i coaching'),
  ('bildung-nachhilfe', 'Obrazovanje i instrukcije'),
  ('computer-it', 'Računari i IT'),
  ('detailhandel', 'Maloprodaja'),
  ('druck-design-werbung', 'Štampa, dizajn i reklama'),
  ('energie-umwelt', 'Energija i okoliš'),
  ('finanzen-versicherungen', 'Finansije i osiguranje'),
  ('fotografie-video', 'Fotografija i video'),
  ('freizeit-kultur', 'Slobodno vrijeme i kultura'),
  ('gastronomie', 'Gastronomija'),
  ('gesundheit-medizin', 'Zdravlje i medicina'),
  ('haustiere', 'Kućni ljubimci'),
  ('hotel-unterkunft', 'Hotel i smještaj'),
  ('immobilien', 'Nekretnine'),
  ('industrie-produktion', 'Industrija i proizvodnja'),
  ('kinder-familie', 'Djeca i porodica'),
  ('landwirtschaft', 'Poljoprivreda'),
  ('lebensmittel', 'Prehrambeni proizvodi'),
  ('logistik-transport', 'Logistika i transport'),
  ('marketing-kommunikation', 'Marketing i komunikacije'),
  ('mode-textilien', 'Moda i tekstil'),
  ('musik-veranstaltungen', 'Muzika i događaji'),
  ('personal-recruiting', 'Kadrovi i recruiting'),
  ('pflege-betreuung', 'Njega i briga'),
  ('recht-steuern', 'Pravo i porezi'),
  ('reinigung-gebaeudeservice', 'Čišćenje i usluge zgrada'),
  ('reisen-tourismus', 'Putovanja i turizam'),
  ('sicherheit', 'Sigurnost'),
  ('sonstige-dienstleistungen', 'Ostale usluge'),
  ('sport-fitness', 'Sport i fitness'),
  ('telekommunikation', 'Telekomunikacije'),
  ('uebersetzung-dolmetschen', 'Prevođenje i tumačenje'),
  ('umzug-entsorgung', 'Selidba i odlaganje'),
  ('vereine-organisationen', 'Udruženja i organizacije'),
  ('verwaltung-behoerden', 'Uprava i institucije'),
  ('wohnen-einrichtung', 'Stanovanje i uređenje')
)
INSERT INTO industries_translations (industries_id, languages_code, name)
SELECT i.id, 'bs-BA', names.name FROM names JOIN industries i USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM industries_translations t
  WHERE t.industries_id = i.id AND t.languages_code = 'bs-BA'
);

-- Spoken language names in bs-BA
WITH names(code, name) AS (VALUES
  ('ar', 'Arapski'),
  ('bg', 'Bugarski'),
  ('bs', 'Bosanski'),
  ('cs', 'Češki'),
  ('de', 'Njemački'),
  ('el', 'Grčki'),
  ('en', 'Engleski'),
  ('es', 'Španski'),
  ('fr', 'Francuski'),
  ('gsw', 'Švicarski njemački'),
  ('hr', 'Hrvatski'),
  ('hu', 'Mađarski'),
  ('it', 'Italijanski'),
  ('mk', 'Makedonski'),
  ('nl', 'Holandski'),
  ('pl', 'Poljski'),
  ('pt', 'Portugalski'),
  ('rm', 'Retoromanski'),
  ('ro', 'Rumunski'),
  ('ru', 'Ruski'),
  ('sk', 'Slovački'),
  ('sl', 'Slovenski'),
  ('sq', 'Albanski'),
  ('sr', 'Srpski'),
  ('tr', 'Turski'),
  ('uk', 'Ukrajinski'),
  ('vi', 'Vijetnamski')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, 'bs-BA', names.name FROM names JOIN spoken_languages s USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = 'bs-BA'
);

-- Industry names in sr-Latn
WITH names(code, name) AS (VALUES
  ('auto-mobilitaet', 'Auto i mobilnost'),
  ('bau-handwerk', 'Građevinarstvo i zanati'),
  ('beauty-wellness', 'Lepota i wellness'),
  ('beratung-coaching', 'Savetovanje i koučing'),
  ('bildung-nachhilfe', 'Obrazovanje i instrukcije'),
  ('computer-it', 'Računari i IT'),
  ('detailhandel', 'Maloprodaja'),
  ('druck-design-werbung', 'Štampa, dizajn i reklama'),
  ('energie-umwelt', 'Energija i životna sredina'),
  ('finanzen-versicherungen', 'Finansije i osiguranje'),
  ('fotografie-video', 'Fotografija i video'),
  ('freizeit-kultur', 'Slobodno vreme i kultura'),
  ('gastronomie', 'Gastronomija'),
  ('gesundheit-medizin', 'Zdravlje i medicina'),
  ('haustiere', 'Kućni ljubimci'),
  ('hotel-unterkunft', 'Hotel i smeštaj'),
  ('immobilien', 'Nekretnine'),
  ('industrie-produktion', 'Industrija i proizvodnja'),
  ('kinder-familie', 'Deca i porodica'),
  ('landwirtschaft', 'Poljoprivreda'),
  ('lebensmittel', 'Prehrambeni proizvodi'),
  ('logistik-transport', 'Logistika i transport'),
  ('marketing-kommunikation', 'Marketing i komunikacije'),
  ('mode-textilien', 'Moda i tekstil'),
  ('musik-veranstaltungen', 'Muzika i događaji'),
  ('personal-recruiting', 'Kadrovi i recruiting'),
  ('pflege-betreuung', 'Nega i briga'),
  ('recht-steuern', 'Pravo i porezi'),
  ('reinigung-gebaeudeservice', 'Čišćenje i usluge zgrada'),
  ('reisen-tourismus', 'Putovanja i turizam'),
  ('sicherheit', 'Bezbednost'),
  ('sonstige-dienstleistungen', 'Ostale usluge'),
  ('sport-fitness', 'Sport i fitnes'),
  ('telekommunikation', 'Telekomunikacije'),
  ('uebersetzung-dolmetschen', 'Prevođenje i tumačenje'),
  ('umzug-entsorgung', 'Selidba i odlaganje'),
  ('vereine-organisationen', 'Udruženja i organizacije'),
  ('verwaltung-behoerden', 'Uprava i institucije'),
  ('wohnen-einrichtung', 'Stanovanje i uređenje')
)
INSERT INTO industries_translations (industries_id, languages_code, name)
SELECT i.id, 'sr-Latn', names.name FROM names JOIN industries i USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM industries_translations t
  WHERE t.industries_id = i.id AND t.languages_code = 'sr-Latn'
);

-- Spoken language names in sr-Latn
WITH names(code, name) AS (VALUES
  ('ar', 'Arapski'),
  ('bg', 'Bugarski'),
  ('bs', 'Bosanski'),
  ('cs', 'Češki'),
  ('de', 'Nemački'),
  ('el', 'Grčki'),
  ('en', 'Engleski'),
  ('es', 'Španski'),
  ('fr', 'Francuski'),
  ('gsw', 'Švajcarski nemački'),
  ('hr', 'Hrvatski'),
  ('hu', 'Mađarski'),
  ('it', 'Italijanski'),
  ('mk', 'Makedonski'),
  ('nl', 'Holandski'),
  ('pl', 'Poljski'),
  ('pt', 'Portugalski'),
  ('rm', 'Retoromanski'),
  ('ro', 'Rumunski'),
  ('ru', 'Ruski'),
  ('sk', 'Slovački'),
  ('sl', 'Slovenački'),
  ('sq', 'Albanski'),
  ('sr', 'Srpski'),
  ('tr', 'Turski'),
  ('uk', 'Ukrajinski'),
  ('vi', 'Vijetnamski')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, 'sr-Latn', names.name FROM names JOIN spoken_languages s USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = 'sr-Latn'
);

-- Industry names in sl-SI
WITH names(code, name) AS (VALUES
  ('auto-mobilitaet', 'Avto in mobilnost'),
  ('bau-handwerk', 'Gradbeništvo in obrt'),
  ('beauty-wellness', 'Lepota in wellness'),
  ('beratung-coaching', 'Svetovanje in coaching'),
  ('bildung-nachhilfe', 'Izobraževanje in inštrukcije'),
  ('computer-it', 'Računalništvo in IT'),
  ('detailhandel', 'Trgovina na drobno'),
  ('druck-design-werbung', 'Tisk, oblikovanje in oglaševanje'),
  ('energie-umwelt', 'Energija in okolje'),
  ('finanzen-versicherungen', 'Finance in zavarovanja'),
  ('fotografie-video', 'Fotografija in video'),
  ('freizeit-kultur', 'Prosti čas in kultura'),
  ('gastronomie', 'Gastronomija'),
  ('gesundheit-medizin', 'Zdravje in medicina'),
  ('haustiere', 'Domače živali'),
  ('hotel-unterkunft', 'Hotel in nastanitev'),
  ('immobilien', 'Nepremičnine'),
  ('industrie-produktion', 'Industrija in proizvodnja'),
  ('kinder-familie', 'Otroci in družina'),
  ('landwirtschaft', 'Kmetijstvo'),
  ('lebensmittel', 'Živila'),
  ('logistik-transport', 'Logistika in transport'),
  ('marketing-kommunikation', 'Marketing in komunikacije'),
  ('mode-textilien', 'Moda in tekstil'),
  ('musik-veranstaltungen', 'Glasba in dogodki'),
  ('personal-recruiting', 'Kadri in recruiting'),
  ('pflege-betreuung', 'Nega in oskrba'),
  ('recht-steuern', 'Pravo in davki'),
  ('reinigung-gebaeudeservice', 'Čiščenje in stavbne storitve'),
  ('reisen-tourismus', 'Potovanja in turizem'),
  ('sicherheit', 'Varnost'),
  ('sonstige-dienstleistungen', 'Druge storitve'),
  ('sport-fitness', 'Šport in fitnes'),
  ('telekommunikation', 'Telekomunikacije'),
  ('uebersetzung-dolmetschen', 'Prevajanje in tolmačenje'),
  ('umzug-entsorgung', 'Selitev in odpadki'),
  ('vereine-organisationen', 'Društva in organizacije'),
  ('verwaltung-behoerden', 'Uprava in organi'),
  ('wohnen-einrichtung', 'Bivanje in oprema')
)
INSERT INTO industries_translations (industries_id, languages_code, name)
SELECT i.id, 'sl-SI', names.name FROM names JOIN industries i USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM industries_translations t
  WHERE t.industries_id = i.id AND t.languages_code = 'sl-SI'
);

-- Spoken language names in sl-SI
WITH names(code, name) AS (VALUES
  ('ar', 'Arabščina'),
  ('bg', 'Bolgarščina'),
  ('bs', 'Boščina'),
  ('cs', 'Češčina'),
  ('de', 'Nemščina'),
  ('el', 'Grščina'),
  ('en', 'Angleščina'),
  ('es', 'Španščina'),
  ('fr', 'Francoščina'),
  ('gsw', 'Švicarska nemščina'),
  ('hr', 'Hrvaščina'),
  ('hu', 'Madžarščina'),
  ('it', 'Italijanščina'),
  ('mk', 'Makedonščina'),
  ('nl', 'Nizozemščina'),
  ('pl', 'Poljščina'),
  ('pt', 'Portugalščina'),
  ('rm', 'Retoromanščina'),
  ('ro', 'Romunščina'),
  ('ru', 'Ruščina'),
  ('sk', 'Slovaščina'),
  ('sl', 'Slovenščina'),
  ('sq', 'Albanščina'),
  ('sr', 'Srbščina'),
  ('tr', 'Turščina'),
  ('uk', 'Ukrajinščina'),
  ('vi', 'Vietnamščina')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, 'sl-SI', names.name FROM names JOIN spoken_languages s USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = 'sl-SI'
);

-- Fill missing spoken-language labels in existing UI languages if absent.
WITH names(code, name) AS (VALUES
  ('de-CH', 'Italienisch'),
  ('en-US', 'Italian'),
  ('sk-SK', 'Taliančina'),
  ('cs-CZ', 'Italština'),
  ('hu-HU', 'Olasz'),
  ('pl-PL', 'Włoski'),
  ('ru-RU', 'Итальянский'),
  ('pt-PT', 'Italiano'),
  ('ro-RO', 'Italiană'),
  ('vi-VN', 'Tiếng Ý')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, l.code, names.name
FROM names JOIN languages l USING (code)
CROSS JOIN spoken_languages s
WHERE s.code = 'it' AND NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = l.code
);

WITH names(code, name) AS (VALUES
  ('de-CH', 'Französisch'),
  ('en-US', 'French'),
  ('sk-SK', 'Francúzština'),
  ('cs-CZ', 'Francouzština'),
  ('hu-HU', 'Francia'),
  ('pl-PL', 'Francuski'),
  ('ru-RU', 'Французский'),
  ('pt-PT', 'Francês'),
  ('ro-RO', 'Franceză'),
  ('vi-VN', 'Tiếng Pháp')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, l.code, names.name
FROM names JOIN languages l USING (code)
CROSS JOIN spoken_languages s
WHERE s.code = 'fr' AND NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = l.code
);

WITH names(code, name) AS (VALUES
  ('de-CH', 'Ukrainisch'),
  ('en-US', 'Ukrainian'),
  ('sk-SK', 'Ukrajinčina'),
  ('cs-CZ', 'Ukrajinština'),
  ('hu-HU', 'Ukrán'),
  ('pl-PL', 'Ukraiński'),
  ('ru-RU', 'Украинский'),
  ('pt-PT', 'Ucraniano'),
  ('ro-RO', 'Ucraineană'),
  ('vi-VN', 'Tiếng Ukraina')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, l.code, names.name
FROM names JOIN languages l USING (code)
CROSS JOIN spoken_languages s
WHERE s.code = 'uk' AND NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = l.code
);

WITH names(code, name) AS (VALUES
  ('de-CH', 'Bosnisch'),
  ('en-US', 'Bosnian'),
  ('sk-SK', 'Bosniačtina'),
  ('cs-CZ', 'Bosenština'),
  ('hu-HU', 'Bosnyák'),
  ('pl-PL', 'Bośniacki'),
  ('ru-RU', 'Боснийский'),
  ('pt-PT', 'Bósnio'),
  ('ro-RO', 'Bosniacă'),
  ('vi-VN', 'Tiếng Bosnia')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, l.code, names.name
FROM names JOIN languages l USING (code)
CROSS JOIN spoken_languages s
WHERE s.code = 'bs' AND NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = l.code
);

WITH names(code, name) AS (VALUES
  ('de-CH', 'Serbisch'),
  ('en-US', 'Serbian'),
  ('sk-SK', 'Srbčina'),
  ('cs-CZ', 'Srbština'),
  ('hu-HU', 'Szerb'),
  ('pl-PL', 'Serbski'),
  ('ru-RU', 'Сербский'),
  ('pt-PT', 'Sérvio'),
  ('ro-RO', 'Sârbă'),
  ('vi-VN', 'Tiếng Serbia')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, l.code, names.name
FROM names JOIN languages l USING (code)
CROSS JOIN spoken_languages s
WHERE s.code = 'sr' AND NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = l.code
);

WITH names(code, name) AS (VALUES
  ('de-CH', 'Slowenisch'),
  ('en-US', 'Slovenian'),
  ('sk-SK', 'Slovinčina'),
  ('cs-CZ', 'Slovinština'),
  ('hu-HU', 'Szlovén'),
  ('pl-PL', 'Słoweński'),
  ('ru-RU', 'Словенский'),
  ('pt-PT', 'Esloveno'),
  ('ro-RO', 'Slovenă'),
  ('vi-VN', 'Tiếng Slovenia')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, l.code, names.name
FROM names JOIN languages l USING (code)
CROSS JOIN spoken_languages s
WHERE s.code = 'sl' AND NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = l.code
);

COMMIT;

BEGIN;

-- Keep all existing languages and records. Extend the three locale checks
-- created by the team-management, deletion-request and blog migrations.
ALTER TABLE organization_invitations DROP CONSTRAINT organization_invitations_locale_check;
ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_locale_check
  CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi'));
ALTER TABLE deletion_requests DROP CONSTRAINT deletion_requests_locale_check;
ALTER TABLE deletion_requests ADD CONSTRAINT deletion_requests_locale_check
  CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi'));
ALTER TABLE blog_posts DROP CONSTRAINT blog_posts_locale_check;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_locale_check
  CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi'));

-- Preserve other Directus interface options and choices, including custom ones.
UPDATE directus_fields
SET options = jsonb_set(
  COALESCE(options::jsonb, '{}'::jsonb),
  '{choices}',
  COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    || '[{"text":"Tiếng Việt","value":"vi"}]'::jsonb
)
WHERE collection IN ('organization_invitations', 'deletion_requests', 'blog_posts')
  AND field = 'locale'
  AND NOT COALESCE(options::jsonb -> 'choices', '[]'::jsonb)
    @> '[{"value":"vi"}]'::jsonb;

-- These translation collections and fields were checked read-only against
-- cms.findelio.ch on 2026-10-05. Never replace existing translations or IDs.
INSERT INTO languages (code) VALUES ('vi-VN') ON CONFLICT (code) DO NOTHING;

INSERT INTO spoken_languages (id, code, name)
SELECT gen_random_uuid(), 'vi', 'Vietnamesisch'
WHERE NOT EXISTS (SELECT 1 FROM spoken_languages WHERE code = 'vi');

WITH names(code, name) AS (VALUES
  ('auto-mobilitaet', 'Ô tô & di chuyển'),
  ('bau-handwerk', 'Xây dựng & nghề thủ công'),
  ('beauty-wellness', 'Làm đẹp & chăm sóc sức khỏe'),
  ('beratung-coaching', 'Tư vấn & huấn luyện'),
  ('bildung-nachhilfe', 'Giáo dục & gia sư'),
  ('computer-it', 'Máy tính & công nghệ thông tin'),
  ('detailhandel', 'Bán lẻ'),
  ('druck-design-werbung', 'In ấn, thiết kế & quảng cáo'),
  ('energie-umwelt', 'Năng lượng & môi trường'),
  ('finanzen-versicherungen', 'Tài chính & bảo hiểm'),
  ('fotografie-video', 'Nhiếp ảnh & video'),
  ('freizeit-kultur', 'Giải trí & văn hóa'),
  ('gastronomie', 'Ẩm thực'),
  ('gesundheit-medizin', 'Sức khỏe & y tế'),
  ('haustiere', 'Thú cưng'),
  ('hotel-unterkunft', 'Khách sạn & lưu trú'),
  ('immobilien', 'Bất động sản'),
  ('industrie-produktion', 'Công nghiệp & sản xuất'),
  ('kinder-familie', 'Trẻ em & gia đình'),
  ('landwirtschaft', 'Nông nghiệp'),
  ('lebensmittel', 'Thực phẩm'),
  ('logistik-transport', 'Logistics & vận tải'),
  ('marketing-kommunikation', 'Tiếp thị & truyền thông'),
  ('mode-textilien', 'Thời trang & dệt may'),
  ('musik-veranstaltungen', 'Âm nhạc & sự kiện'),
  ('personal-recruiting', 'Nhân sự & tuyển dụng'),
  ('pflege-betreuung', 'Điều dưỡng & chăm sóc'),
  ('recht-steuern', 'Pháp luật & thuế'),
  ('reinigung-gebaeudeservice', 'Vệ sinh & dịch vụ tòa nhà'),
  ('reisen-tourismus', 'Du lịch & lữ hành'),
  ('sicherheit', 'An ninh'),
  ('sonstige-dienstleistungen', 'Dịch vụ khác'),
  ('sport-fitness', 'Thể thao & thể hình'),
  ('telekommunikation', 'Viễn thông'),
  ('uebersetzung-dolmetschen', 'Biên dịch & phiên dịch'),
  ('umzug-entsorgung', 'Chuyển nhà & xử lý chất thải'),
  ('vereine-organisationen', 'Hiệp hội & tổ chức'),
  ('verwaltung-behoerden', 'Hành chính & cơ quan công quyền'),
  ('wohnen-einrichtung', 'Nhà ở & nội thất')
)
INSERT INTO industries_translations (industries_id, languages_code, name)
SELECT i.id, 'vi-VN', names.name FROM names JOIN industries i USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM industries_translations t
  WHERE t.industries_id = i.id AND t.languages_code = 'vi-VN'
);

WITH names(code, name) AS (VALUES
  ('ar', 'Tiếng Ả Rập'), ('bg', 'Tiếng Bulgaria'), ('bs', 'Tiếng Bosnia'),
  ('cs', 'Tiếng Séc'), ('de', 'Tiếng Đức'), ('el', 'Tiếng Hy Lạp'),
  ('en', 'Tiếng Anh'), ('es', 'Tiếng Tây Ban Nha'), ('fr', 'Tiếng Pháp'),
  ('gsw', 'Tiếng Đức Thụy Sĩ'), ('hr', 'Tiếng Croatia'), ('hu', 'Tiếng Hungary'),
  ('it', 'Tiếng Ý'), ('mk', 'Tiếng Macedonia'), ('nl', 'Tiếng Hà Lan'),
  ('pl', 'Tiếng Ba Lan'), ('pt', 'Tiếng Bồ Đào Nha'), ('rm', 'Tiếng Romansh'),
  ('ro', 'Tiếng Romania'), ('ru', 'Tiếng Nga'), ('sk', 'Tiếng Slovak'),
  ('sl', 'Tiếng Slovenia'), ('sq', 'Tiếng Albania'), ('sr', 'Tiếng Serbia'),
  ('tr', 'Tiếng Thổ Nhĩ Kỳ'), ('uk', 'Tiếng Ukraina'), ('vi', 'Tiếng Việt')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, 'vi-VN', names.name FROM names JOIN spoken_languages s USING (code)
WHERE NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = 'vi-VN'
);

-- Label the new spoken language in the other existing UI languages as well.
WITH names(code, name) AS (VALUES
  ('de-CH', 'Vietnamesisch'), ('en-US', 'Vietnamese'), ('sk-SK', 'Vietnamčina'),
  ('cs-CZ', 'Vietnamština'), ('hu-HU', 'Vietnámi'), ('pl-PL', 'Wietnamski'),
  ('ru-RU', 'Вьетнамский'), ('pt-PT', 'Vietnamita'), ('ro-RO', 'Vietnameză')
)
INSERT INTO spoken_languages_translations (spoken_languages_id, languages_code, name)
SELECT s.id, l.code, names.name
FROM names JOIN languages l USING (code)
CROSS JOIN spoken_languages s
WHERE s.code = 'vi' AND NOT EXISTS (
  SELECT 1 FROM spoken_languages_translations t
  WHERE t.spoken_languages_id = s.id AND t.languages_code = l.code
);

COMMIT;

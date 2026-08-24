CREATE TYPE public.market_item_status AS ENUM ('active','reserved','sold','disabled','deleted');
CREATE TYPE public.market_item_condition AS ENUM ('new','like_new','good','used');
CREATE TYPE public.market_delivery AS ENUM ('pickup','shipping','both');
CREATE TYPE public.market_offer_status AS ENUM ('open','accepted','declined','withdrawn');

-- ---------- Kategorien ----------
CREATE TABLE public.market_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.market_categories(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  name_en text,
  name_el text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_categories TO authenticated;
GRANT ALL ON public.market_categories TO service_role;
ALTER TABLE public.market_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_categories_read" ON public.market_categories
  FOR SELECT TO authenticated USING (active);

-- ---------- Artikel ----------
CREATE TABLE public.market_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  negotiable boolean NOT NULL DEFAULT true,
  category_id uuid REFERENCES public.market_categories(id) ON DELETE SET NULL,
  condition public.market_item_condition NOT NULL DEFAULT 'good',
  delivery public.market_delivery NOT NULL DEFAULT 'pickup',
  status public.market_item_status NOT NULL DEFAULT 'active',
  postal_code text,
  place text,
  lat double precision,
  lon double precision,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  views_count integer NOT NULL DEFAULT 0,
  favorites_count integer NOT NULL DEFAULT 0,
  promoted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(place,''))
  ) STORED
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_items TO authenticated;
GRANT ALL ON public.market_items TO service_role;
ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_items_read_public" ON public.market_items
  FOR SELECT TO authenticated
  USING (status IN ('active','reserved','sold') OR seller_id = auth.uid());
CREATE POLICY "market_items_insert_own" ON public.market_items
  FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "market_items_update_own" ON public.market_items
  FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "market_items_delete_own" ON public.market_items
  FOR DELETE TO authenticated USING (seller_id = auth.uid());
CREATE INDEX market_items_search_idx ON public.market_items USING gin (search_tsv);
CREATE INDEX market_items_feed_idx ON public.market_items (status, created_at DESC, id DESC);
CREATE INDEX market_items_category_idx ON public.market_items (category_id, status);
CREATE INDEX market_items_geo_idx ON public.market_items (lat, lon);
CREATE INDEX market_items_seller_idx ON public.market_items (seller_id, created_at DESC);
CREATE TRIGGER market_items_updated_at BEFORE UPDATE ON public.market_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Bilder ----------
CREATE TABLE public.market_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.market_items(id) ON DELETE CASCADE,
  path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_images TO authenticated;
GRANT ALL ON public.market_images TO service_role;
ALTER TABLE public.market_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_images_read" ON public.market_images
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id
            AND (i.status IN ('active','reserved','sold') OR i.seller_id = auth.uid()))
  );
CREATE POLICY "market_images_write_own" ON public.market_images
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id AND i.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id AND i.seller_id = auth.uid()));
CREATE INDEX market_images_item_idx ON public.market_images (item_id, sort_order);

-- ---------- Verknüpfungen ----------
CREATE TABLE public.market_item_slang_tags (
  item_id uuid NOT NULL REFERENCES public.market_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_item_slang_tags TO authenticated;
GRANT ALL ON public.market_item_slang_tags TO service_role;
ALTER TABLE public.market_item_slang_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_item_tags_read" ON public.market_item_slang_tags
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id
            AND (i.status IN ('active','reserved','sold') OR i.seller_id = auth.uid()))
  );
CREATE POLICY "market_item_tags_write_own" ON public.market_item_slang_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id AND i.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id AND i.seller_id = auth.uid()));

CREATE TABLE public.market_item_channels (
  item_id uuid NOT NULL REFERENCES public.market_items(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, channel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_item_channels TO authenticated;
GRANT ALL ON public.market_item_channels TO service_role;
ALTER TABLE public.market_item_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_item_channels_read" ON public.market_item_channels
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id
            AND (i.status IN ('active','reserved','sold') OR i.seller_id = auth.uid()))
  );
CREATE POLICY "market_item_channels_write_own" ON public.market_item_channels
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id AND i.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id AND i.seller_id = auth.uid()));

-- ---------- Favoriten ----------
CREATE TABLE public.market_favorites (
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.market_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_favorites TO authenticated;
GRANT ALL ON public.market_favorites TO service_role;
ALTER TABLE public.market_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_favorites_own" ON public.market_favorites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX market_favorites_item_idx ON public.market_favorites (item_id);

-- ---------- Angebote ----------
CREATE TABLE public.market_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.market_items(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  status public.market_offer_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.market_offers TO authenticated;
GRANT ALL ON public.market_offers TO service_role;
ALTER TABLE public.market_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_offers_read_parties" ON public.market_offers
  FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "market_offers_insert_buyer" ON public.market_offers
  FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid() AND buyer_id <> seller_id);
CREATE POLICY "market_offers_update_parties" ON public.market_offers
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE INDEX market_offers_item_idx ON public.market_offers (item_id, created_at DESC);
CREATE TRIGGER market_offers_updated_at BEFORE UPDATE ON public.market_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Gespeicherte Suchen ----------
CREATE TABLE public.market_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_searches TO authenticated;
GRANT ALL ON public.market_searches TO service_role;
ALTER TABLE public.market_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_searches_own" ON public.market_searches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- Startkategorien ----------
INSERT INTO public.market_categories (slug, name, name_en, name_el, icon, sort_order) VALUES
  ('elektronik','Elektronik','Electronics','Ηλεκτρονικά','Cpu',10),
  ('handys','Handys','Phones','Κινητά','Smartphone',20),
  ('computer','Computer','Computers','Υπολογιστές','Laptop',30),
  ('gaming','Gaming','Gaming','Gaming','Gamepad2',40),
  ('kleidung','Kleidung','Clothing','Ρούχα','Shirt',50),
  ('schuhe','Schuhe','Shoes','Παπούτσια','Footprints',60),
  ('moebel','Möbel','Furniture','Έπιπλα','Armchair',70),
  ('haushalt','Haushalt','Household','Σπίτι','Home',80),
  ('fahrraeder','Fahrräder','Bikes','Ποδήλατα','Bike',90),
  ('auto-teile','Auto & Teile','Cars & Parts','Αυτοκίνητα','Car',100),
  ('kinder','Kinder','Kids','Παιδικά','Baby',110),
  ('hobby','Hobby','Hobby','Χόμπι','Palette',120),
  ('sammler','Sammler','Collectibles','Συλλεκτικά','Gem',130),
  ('dienstleistungen','Dienstleistungen','Services','Υπηρεσίες','Wrench',140),
  ('sonstiges','Sonstiges','Other','Άλλα','Package',150);
-- Named one-time Penpal ladder (250 / 500 / 1000 characters) plus Custom above the top price.
-- one_time_price_cents remains the 250-character tier.

ALTER TABLE creators
    ADD COLUMN price_500_cents BIGINT NOT NULL DEFAULT 1000 CHECK (price_500_cents > 0),
    ADD COLUMN price_1000_cents BIGINT NOT NULL DEFAULT 1500 CHECK (price_1000_cents > 0);

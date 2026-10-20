-- A paid checkout can sign its guest in once, shortly after payment. After that the
-- guest gets back in through the email recovery link.

ALTER TABLE checkouts
    ADD COLUMN claimed_at TIMESTAMPTZ;

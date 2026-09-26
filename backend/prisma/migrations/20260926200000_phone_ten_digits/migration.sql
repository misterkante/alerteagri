-- Benin moved to 10-digit numbers on 1 January 2025: 01 followed by the former 8 digits (ARCEP).
-- Stored numbers follow the same rule; nothing else changes.
UPDATE "User" SET "phone" = '+22901' || substr("phone", 5) WHERE "phone" ~ '^\+229[0-9]{8}$';

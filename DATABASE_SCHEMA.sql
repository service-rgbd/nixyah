DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'order_status'
	) THEN
		ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'courier_profiles'
	) THEN
		ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS rejection_reason text;
		ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS rejection_reason_updated_at timestamp;
	END IF;
END $$;

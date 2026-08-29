-- Track whether the welcome/thank-you email has been sent for a profile,
-- so the callback route sends it exactly once per user.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

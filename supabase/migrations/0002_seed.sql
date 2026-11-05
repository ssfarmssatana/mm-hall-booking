-- =====================================================================
-- Migration 0002: initial settings, halls and counters.
-- Edit the values below before running if you already know them;
-- everything here can also be changed later from the Settings screen.
-- =====================================================================

insert into settings (key, value) values
  ('org_name',        '"Maratha Mandal Mulund"'),
  ('org_name_mr',     '"मराठा मंडळ मुलुंड"'),
  ('org_address',     '"Mulund (East), Mumbai – 400081"'),
  ('org_phone',       '""'),
  ('org_email',       '""'),
  ('gstin',           '""'),
  ('gst_rate',        '18'),
  ('buffer_minutes',  '60'),
  ('tentative_hold_days', '3'),
  ('terms',           '"1. Hall timing as per booking; overtime will be charged extra.\n2. Refundable security deposit is returned within 7 days after the event, after deductions for damages if any.\n3. GST at the applicable rate is payable on hall charges.\n4. Cancellation charges apply as per Mandal rules."'),
  ('terms_mr',        '"१. हॉलची वेळ बुकिंगप्रमाणे; अतिरिक्त वेळेसाठी वेगळे शुल्क आकारले जाईल.\n२. अनामत रक्कम कार्यक्रमानंतर ७ दिवसांत (नुकसान असल्यास वजावट करून) परत केली जाईल.\n३. हॉल भाड्यावर लागू दराने जीएसटी भरावा लागेल.\n४. रद्द केल्यास मंडळाच्या नियमानुसार शुल्क आकारले जाईल."')
on conflict (key) do nothing;

-- Numbers continue from the physical register.
insert into counters (name, value) values
  ('booking', 34),      -- last booking no. in the register
  ('receipt', 1230),    -- last receipt no. in the register
  ('enquiry', 0)
on conflict (name) do nothing;

insert into halls (name, name_mr, floor, capacity, is_ac, base_rate, deposit_default, color, sort_order) values
  ('First Floor Hall',  'पहिला मजला',  'First floor',  300, false, 25000, 5000, '#0f766e', 1),
  ('Second Floor Hall (AC)', 'दुसरा मजला (AC)', 'Second floor', 250, true, 25000, 5000, '#7c3aed', 2);

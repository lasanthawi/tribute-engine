ALTER TABLE challenges ADD COLUMN category TEXT NOT NULL DEFAULT 'general';

UPDATE challenges SET category = CASE id
  WHEN 1 THEN 'wellness'
  WHEN 2 THEN 'fitness'
  WHEN 3 THEN 'finance'
  WHEN 4 THEN 'learning'
  WHEN 5 THEN 'digital_wellness'
  WHEN 6 THEN 'creator'
  ELSE category
END;

INSERT INTO public.users (display_name, email, handle, cognito_user_id)
VALUES
  ('Awa DIAGNE','awa94.diagne@gmail.com' , 'Awa' ,'MOCK'),
  ('Eva DIAGNE','lalihevah@gmail.com' , 'Eva' ,'MOCK');

INSERT INTO public.activities (user_uuid, message, expires_at)
VALUES
  (
    (SELECT uuid from public.users WHERE users.handle = 'Awa' LIMIT 1),
    'This was imported as seed data!',
    current_timestamp + interval '10 day'
  )
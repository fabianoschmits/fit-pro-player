begin;

select plan(6);

select has_column('public', 'professional_profiles', 'state_uf', 'professional profiles store Brazilian state');
select has_column('public', 'professional_profiles', 'city_name', 'professional profiles store city');
select has_column('public', 'professional_profiles', 'neighborhood', 'professional profiles store neighborhood');
select ok(public.valid_professional_specialties(array['força', 'lecionar pilates']), 'practice and teaching specialties are valid');
select has_function('public', 'provision_professional_profile', array['text', 'text', 'text[]', 'text', 'text', 'text', 'text', 'text', 'text'], 'signup stores specialties and location');
select has_function('public', 'save_professional_profile', array['uuid', 'text', 'text', 'text[]', 'text', 'text', 'text', 'text', 'text', 'text'], 'profile edits store specialties and location');

select finish();
rollback;

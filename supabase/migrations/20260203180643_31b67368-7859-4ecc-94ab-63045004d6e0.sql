-- Create a function to auto-assign recruiter role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'recruiter')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign role when profile is created
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Also grant recruiter role to all existing users who don't have one
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'recruiter'::app_role
FROM public.profiles
WHERE user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'recruiter')
ON CONFLICT (user_id, role) DO NOTHING;
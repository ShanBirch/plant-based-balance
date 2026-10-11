-- Match the existing admin read access for users and workout history.
-- Members retain their existing owner-only policy; this grants no writes.
CREATE POLICY "Admins can view workout replacements"
ON public.workout_replacements FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = (SELECT auth.uid())
));

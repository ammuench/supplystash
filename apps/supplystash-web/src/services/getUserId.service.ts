import { supabase } from "@/utils/supabase";

export const getUserId = async () => {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  return userId;
};

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/state/query-keys";
import { useSession } from "@/state/session";

// The five roles `user_homes.role` allows (a CHECK constraint, not an enum, so
// the generated types only say `string`). Ordered from most to least access.
export const HOME_ROLES = ["owner", "admin", "member", "contributor", "viewer"] as const;

export type HomeRole = (typeof HOME_ROLES)[number];

/** A home the signed-in user belongs to. */
export type Home = {
  id: string;
  name: string;
  description: string | null;
  /** How many people belong to the home, the signed-in user included. */
  memberCount: number;
  /** The signed-in user's own role in this home. */
  role: HomeRole;
};

const isHomeRole = (role: string | undefined): role is HomeRole =>
  HOME_ROLES.includes(role as HomeRole);

// One request. RLS returns only homes the caller belongs to, and lets a member
// read every membership row of those homes. So the embedded `user_homes` rows
// give both numbers at once: their count is the member count, and the row with
// the caller's id carries the caller's role.
const fetchHomes = async (userId: string): Promise<Home[]> => {
  // `.throwOnError()` so a failure rejects with the PostgrestError itself;
  // the "Can't reach the server" bar reads its code (lib/postgrest-error.ts).
  const { data } = await supabase
    .from("homes")
    .select("id, name, description, user_homes(user_id, role)")
    .order("name")
    .throwOnError();

  return data.map((home) => {
    const ownRole = home.user_homes.find((membership) => membership.user_id === userId)?.role;

    return {
      id: home.id,
      name: home.name,
      description: home.description,
      memberCount: home.user_homes.length,
      // RLS means the caller's row is always there and the CHECK constraint
      // means the role is always one of the five. If either ever fails, fall
      // back to the role with the least access, never to one with more.
      role: isHomeRole(ownRole) ? ownRole : "viewer",
    };
  });
};

// Shared by both hooks so they read and write the same cache entry. The key
// has no user id in it (docs/query-keys.md rule 4); the sign-out wipe is what
// keeps one user's homes from showing for the next (docs/persistence.md).
const homesQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: queryKeys.homes(),
    queryFn: () => fetchHomes(userId as string),
    enabled: !!userId,
  });

/** Every home the signed-in user belongs to, sorted by name. */
export const useHomes = () => {
  const { user } = useSession();

  return useQuery(homesQueryOptions(user?.id));
};

/**
 * One home by id, read from the same cached list as `useHomes`, so the two can
 * never disagree. `data` is `null` once the list has loaded and the id is not
 * in it: the home was deleted, or the user is not a member.
 */
export const useHome = (homeId: string) => {
  const { user } = useSession();

  return useQuery({
    ...homesQueryOptions(user?.id),
    select: (homes) => homes.find((home) => home.id === homeId) ?? null,
  });
};

/**
 * Creates a home with the signed-in user as its owner. `mutateAsync(name)`
 * resolves with the new home's id as soon as the server has created it. By
 * then the home is already in the cached list, so a screen opened with that id
 * finds it in `useHome` without waiting for a refetch.
 */
export const useCreateHome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // `.throwOnError()` so a failure rejects with the PostgrestError itself
      // and the screen can branch on its code (lib/postgrest-error.ts).
      const { data } = await supabase.rpc("create_home", { p_name: name }).throwOnError();

      return data;
    },
    // Home management is online-only. The default mode pauses a mutation
    // started while offline: it would be saved to the paused queue with no
    // registered `mutationFn` to replay it (docs/persistence.md), and the
    // form's submit would never settle. "always" sends it regardless, so it
    // fails at once and the form shows the error.
    networkMode: "always",
    onSuccess: (homeId, name) => {
      // Every field of a new home is known without asking the server: the
      // caller is its only member and its owner. Writing it into the cached
      // list here means the mutation does not wait on the refetch below. That
      // refetch retries, and a retry waits for the network, so awaiting it
      // could leave a form stuck on "Creating…" for a home that already exists.
      const created: Home = {
        id: homeId,
        // `create_home` trims the name before it stores it.
        name: name.trim(),
        description: null,
        memberCount: 1,
        role: "owner",
      };
      // No cached list yet: leave it. The first `useHomes` fetches it whole.
      queryClient.setQueryData<Home[]>(queryKeys.homes(), (homes) =>
        homes && !homes.some((home) => home.id === homeId)
          ? [...homes, created].sort((a, b) => a.name.localeCompare(b.name))
          : homes,
      );
      // Not returned: it runs in the background and replaces the list with
      // the server's copy, in the server's sort order.
      void queryClient.invalidateQueries({ queryKey: queryKeys.homes() });
    },
  });
};

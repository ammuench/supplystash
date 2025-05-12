import type { NavIconNames } from "@/types/NavIconNames.type";

export type NavLink = {
  display: string;
  link: string;
  icon: NavIconNames;
  external: boolean;
};

export const NAV_LINKS: NavLink[] = [
  {
    display: "Home",
    link: "/",
    icon: "home",
    external: false,
  },
  {
    display: "Settings",
    link: "/settings",
    icon: "settings",
    external: false,
  },
];

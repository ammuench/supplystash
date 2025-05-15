import {
  Cog6ToothIcon,
  HomeIcon,
  ListBulletIcon,
} from "@heroicons/vue/24/outline";

export type NavLink = {
  display: string;
  link: string;
  icon: typeof HomeIcon | typeof Cog6ToothIcon | typeof ListBulletIcon;
  external: boolean;
};

export const NAV_LINKS: NavLink[] = [
  {
    display: "Home",
    link: "/",
    icon: HomeIcon,
    external: false,
  },
  {
    display: "Supply List",
    link: "/list",
    icon: ListBulletIcon,
    external: false,
  },

  {
    display: "Settings",
    link: "/settings",
    icon: Cog6ToothIcon,
    external: false,
  },
];

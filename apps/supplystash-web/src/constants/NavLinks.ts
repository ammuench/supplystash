import {
  ArrowLeftStartOnRectangleIcon,
  Cog6ToothIcon,
  HomeIcon,
  ListBulletIcon,
  UserPlusIcon,
} from "@heroicons/vue/24/outline";

export type NavLink = {
  display: string;
  link: string;
  icon:
    | typeof HomeIcon
    | typeof Cog6ToothIcon
    | typeof ListBulletIcon
    | typeof UserPlusIcon
    | typeof ArrowLeftStartOnRectangleIcon;
  external: boolean;
};

export const NAV_LINKS_AUTH: NavLink[] = [
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

export const NAV_LINKS_UNAUTH: NavLink[] = [
  {
    display: "Home",
    link: "/",
    icon: HomeIcon,
    external: false,
  },
  {
    display: "Sign-in",
    link: "/sign-in",
    icon: ArrowLeftStartOnRectangleIcon,
    external: false,
  },

  {
    display: "Sign-up",
    link: "/sign-up",
    icon: UserPlusIcon,
    external: false,
  },
];

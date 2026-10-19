"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Headline" },
  { href: "/contributors", label: "Contributors" },
  { href: "/basket", label: "Basket" },
  { href: "/replay", label: "Replay" },
  { href: "/stripes", label: "Stripes" },
  { href: "/lifetime", label: "Lifetime" },
  { href: "/pound", label: "£100" },
  { href: "/food", label: "Food" },
  { href: "/methodology", label: "Methodology" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

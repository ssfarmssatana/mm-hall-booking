"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SearchBox({ placeholder }: { placeholder: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [v, setV] = useState(sp.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(sp.toString());
      if (v) p.set("q", v); else p.delete("q");
      if (p.toString() !== sp.toString()) router.replace(`${pathname}?${p.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  return (
    <div className="relative ml-auto w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="field h-9 pl-8" />
    </div>
  );
}

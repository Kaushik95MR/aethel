import Image from "next/image";
import { SITE } from "@/lib/site";

/** The Aethel trip wordmark: heavy cream letters with an orange dot on the i, transparent, made for the dark ground. */
export function Logo({ className = "h-14" }: { className?: string }) {
  return <Image src="/brand/logo.png" alt={SITE.name} width={840} height={513} priority className={`w-auto ${className}`} />;
}

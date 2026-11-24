import Image from "next/image";

/** The Aethel trip logo (cream letters, orange dot), made for the dark ground. */
export function Brand({ className = "h-10" }: { className?: string }) {
  return <Image src="/brand/logo.png" alt="Aethel trip" width={840} height={513} priority className={`w-auto ${className}`} />;
}

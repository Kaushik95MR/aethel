import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";

/** The footer on every page: columns of links, the legal pages, and the name set very large. */
export function SiteFooter() {
  return (
    <footer id="foot" className="sf pb-24 md:pb-6">
      <div className="cols">
        <div>
          <Logo className="h-14" />
          <br />
          {SITE.city}, India
        </div>
        <div>
          <span className="h">Explore</span>
          <Link href="/packages">Trips</Link>
          <br />
          <Link href="/hosts">Hosts</Link>
          <br />
          <Link href="/gallery">Gallery</Link>
          <br />
          <Link href="/#how">How it works</Link>
        </div>
        <div>
          <span className="h">Company</span>
          <Link href="/about">About</Link>
          <br />
          <Link href="/contact">Contact</Link>
        </div>
        <div>
          <span className="h">Account</span>
          <Link href="/login">Log in</Link>
          <br />
          <Link href="/join">Join</Link>
        </div>
        <div>
          <span className="h">Legal</span>
          <Link href="/terms">Terms and conditions</Link>
          <br />
          <Link href="/privacy">Privacy policy</Link>
          <br />
          <Link href="/cancellation">Cancellation and refunds</Link>
        </div>
      </div>
      <span />
      <div>
        <div className="name d">
          Aethel
          <br />
          trip
        </div>
        <p className="legal">&copy; {SITE.name}</p>
      </div>
    </footer>
  );
}

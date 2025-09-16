"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Italic } from "lucide-react";
import { Clover, Calendar, MapPin, ArrowUpRight } from 'lucide-react';

const shell = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

export default function HomePage() {
  const images = [
    "/images/sis_image_1.jpg",
    "/images/sis_image_4.jpg",
    "/images/sis_image_3.jpg",
    "/images/sis_image_2.jpg",
    "/images/sis_image_5.jpg",
  ];
  const [current, setCurrent] = useState(0);

  /* For Jumbotron */
  const prevImage = () => setCurrent(p => (p === 0 ? images.length - 1 : p - 1));
  const nextImage = () => setCurrent(p => (p === images.length - 1 ? 0 : p + 1));

  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Swipe threshold
    if (diff > 50) {
      // swipe left → next
      nextImage();
    } else if (diff < -50) {
      // swipe right → prev
      prevImage();
    }
    setTouchStart(null);
  };

  return (
    <div className="min-h-svh flex flex-col bg-earthy-light text-earthy-dark">
      {/* Navigation (GREEN) */}
      <header className="border-b bg-earthy-green text-white">
        <nav className={`${shell} flex h-14 items-center justify-between`}>
          {/* Logo + Title */}
          <a
            href="/"
            className="flex items-center gap-2 pr-20 text-sm font-semibold sm:text-base lg:text-xl"
          >
            <img
              src="/images/SIS_logo_transp.png"
              alt="Logo"
              className="h-10 w-10 sm:h-12 sm:w-12"
            />
            Pasar Malam 2025: Celebration of Friendship
          </a>

          {/* About link — always visible */}
          <div className="flex gap-6 text-sm sm:text-sm lg:text-lg">
            <a href="/about" className="hover:underline">
              About
            </a>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className={`${shell} grow py-10 sm:py-14`}>
      {/* Welcome */}
            <div className="mx-auto max-w-xl text-center">
              <h1 className="flex items-center justify-center gap-2 text-3xl font-bold sm:text-4xl">
                <Clover className="h-8 w-8 text-earthy-green" />
                Välkomna!
                <Clover className="h-8 w-8 text-earthy-green" />
              </h1>
            </div>

            {/* Event info (wide) */}
            <div className="mt-8">
              <div className="mx-auto text-center w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="space-y-4 text-earthy-dark/90 text-base sm:text-lg md:text-xl">
                  <p className="text-earthy-dark/80">
                    Pasar Malam is an annual event organized by the Swedish-Indonesian
                    Society or{" "}
                    <span className="italic">Svensk-Indonesiska Sällskapet</span> (SIS) to
                    celebrate and promote Indonesian culture in Sweden.
                    To celebrate 75 years of friendship between Indonesia and Sweden
                    this year, our theme is Bhinneka Tunggal Ika /{" "}
                    <span className="italic">Enhet i mångfald</span> (Unity in Diversity).
                    This theme reflects the rich cultural diversity of Indonesia and the
                    importance of unity among different cultures.
                  </p>

                  <p className="flex flex-col items-center sm:flex-row sm:justify-center gap-1 sm:gap-2">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-earthy-green" />
                      <span className="font-semibold">When:</span>
                    </span>
                    <span className="text-center sm:text-left">
                      Saturday, 4th of October 2025,
                      <br className="block sm:hidden" />
                      <span className="sm:ml-1">11:00 – 17:00</span>
                    </span>
                  </p>

                  <p className="flex flex-col items-center sm:flex-row sm:justify-center gap-1 sm:gap-2">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-earthy-green" />
                      <span className="font-semibold">Where:</span>
                    </span>
                    <a
                      href="https://maps.app.goo.gl/pene8t187aXF8E8K8"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center sm:text-left text-earthy-green hover:text-earthy-brown"
                    >
                      Botanical Garden Uppsala,
                      <br className="block sm:hidden" />
                      <span className="sm:ml-1">Villavägen 6–8</span>
                    </a>
                  </p>

                </div>
              </div>
            </div>

        {/* Jumbotron (white card) — optional GREEN border */}
        <section className="relative mt-10 mb-10">
          <div className="relative overflow-hidden rounded-3xl border border-earthy-green/40 bg-white shadow"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={images[current]}
              alt={`Event ${current + 1}`}
              className="h-[250px] w-full object-cover sm:h-[400px] lg:h-[550px]"
            />

            {/* Arrows (BROWN) */}
            <button
              onClick={prevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-earthy-brown/90 p-2 text-earthy-dark hover:bg-earthy-brown focus:outline-none"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-earthy-brown/90 p-2 text-earthy-dark hover:bg-earthy-brown focus:outline-none"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Dots (BROWN primary) */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 w-6 rounded-full transition ${
                    i === current ? "bg-earthy-brown" : "bg-earthy-brown/50"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* CTA (BROWN primary; hover to GREEN) */}
        <div className="mt-12 flex justify-center">
          <a
            href="/register"
            className="rounded-xl bg-earthy-brown px-6 py-3 text-sm font-semibold text-earthy-dark shadow hover:bg-earthy-green hover:text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-earthy-green"
          >
            Click to register
          </a>
        </div>
      </main>

      {/* Footer (GREEN) */}
      <footer className="mt-6 border-t bg-earthy-green text-white">
        <div className={`${shell} py-4 text-center text-xs`}>
          <span>© 2025 SIS.</span>
          <br className="sm:hidden" />
          <span> All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}

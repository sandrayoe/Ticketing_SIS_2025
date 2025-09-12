"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Clover } from 'lucide-react';

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

  const prevImage = () => setCurrent(p => (p === 0 ? images.length - 1 : p - 1));
  const nextImage = () => setCurrent(p => (p === images.length - 1 ? 0 : p + 1));

  return (
    <div className="min-h-svh flex flex-col bg-earthy-light text-earthy-dark">
      {/* Navigation (GREEN) */}
      <header className="border-b bg-earthy-green text-white">
        <nav className={`${shell} flex h-14 items-center justify-between`}>
          <a href="/" className="flex items-center gap-2 text-xl font-semibold">
            {/* Logo image */}
            <img
              src="/images/SIS_logo_transp.png" 
              alt="Logo"
              className="h-12 w-12"
            />
            Pasar Malam SIS 2025: Celebration of Friendship
          </a>
          <div className="hidden sm:flex gap-6 text-xl">
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
            Welcome!
            <Clover className="h-8 w-8 text-earthy-green" />
          </h1>
          <p className="mt-3 text-earthy-dark/80 sm:text-lg">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </div>

        {/* Jumbotron (white card) — optional GREEN border */}
        <section className="relative mt-10 mb-10">
          <div className="relative overflow-hidden rounded-3xl border border-earthy-green/40 bg-white shadow">
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
          © 2025 sandrayoe. All pictures and documentations belong to SIS archive. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

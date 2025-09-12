"use client";

import { useState } from "react";

const shell = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

export default function aboutPage() {

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
          <h1 className="text-3xl font-bold sm:text-4xl">Welcome!</h1>
          <p className="mt-3 text-earthy-dark/80 sm:text-lg">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </div>
        <div className="mx-auto max-w-xl text-center">   
          <p className="mt-3 text-earthy-dark/80 sm:text-lg"> To know more about SIS, visit <a href="https://svensk-indonesiska.se/" className="hover:underline" target="_blank">here.</a></p>
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

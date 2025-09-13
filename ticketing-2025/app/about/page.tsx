"use client";

import { useState } from "react";

const shell = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

export default function aboutPage() {

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
        {/* About Us */}
        <div className="mx-auto text-center w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold sm:text-4xl text-center">About Us</h1>

          <p className="mt-6 text-earthy-dark/80 text-base sm:text-lg">
            'Pasar Malam' by its literal sense
             means 'night market', a place full of evening entertainment,
            For SIS, it’s an annual event which usually
            features a variety of activities, including traditional Indonesian performances,
            food stalls offering authentic Indonesian cuisine, and cultural
            exhibitions. It serves as a platform for cultural exchange and fosters
            friendship between the Swedish and Indonesian communities.
            Last year, we brought the theme of "West Sumatra: Land of Minangkabau" with more than 
            400 attendees joining us in the celebration.
          </p>

          <p className="mt-4 text-earthy-dark/80 text-base sm:text-lg">
            Svensk-Indonesiska Sällskapet (Swedish-Indonesian Society, Asosiasi Swedia Indonesia) is an independent, 
            non-political and non-profit organization with the mission to strengthen the bilateral relationship between Indonesia and Sweden. 
            We are dedicated to fostering friendship and understanding between our countries, and in the same way deepen the relationship between 
            Indonesia and Sweden and their people. Members include Indonesians living in Sweden, 
            and also people who have worked, studied, traveled or found their love of their life in Indonesia.
          </p>

          <p className="mt-4 text-earthy-dark/80 text-base sm:text-lg">
            To know more about SIS, visit{" "}
            <a 
              href="https://svensk-indonesiska.se/" 
              className="text-earthy-green hover:underline" 
              target="_blank"
            >
              here
            </a>.
          </p>
        </div>
      </main>


      {/* Footer (GREEN) */}
      <footer className="mt-6 border-t bg-earthy-green text-white">
        <div className={`${shell} py-4 text-center text-xs`}>
          <span>© 2025 sandrayoe.</span>
          <br className="sm:hidden" />
          <span> All pictures and documentations belong to SIS archive.</span>
        </div>
      </footer>

    </div>
  );
}

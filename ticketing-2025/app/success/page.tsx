// app/success/page.tsx
import Link from "next/link";

const shell = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

export default function SuccessPage() {
  return (
    <div className="min-h-svh flex flex-col bg-earthy-light text-earthy-dark">
      <main className={`${shell} grow flex items-center justify-center py-10 sm:py-14`}>
        <div className="w-full max-w-xl rounded-3xl border border-earthy-green/40 bg-white p-6 shadow sm:p-8">
          <h1 className="text-2xl font-bold">We are processing your order</h1>

          <p className="mt-4 text-earthy-dark/80 leading-relaxed">
            Thank you for registering. Your invoice has been sent to your email.
            Please allow up to <strong>48 hours</strong> for the payment to be verified
            before we send your tickets.
          </p>

          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="rounded-xl bg-earthy-brown px-6 py-3 text-sm font-semibold text-earthy-dark shadow hover:bg-earthy-green hover:text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-earthy-green"
            >
              Back to Home
            </Link>
          </div>

          <p className="mt-6 text-xs text-earthy-dark/60">
            If you don’t see the email, check your spam folder or contact us.
          </p>
        </div>
      </main>
    </div>
  );
}

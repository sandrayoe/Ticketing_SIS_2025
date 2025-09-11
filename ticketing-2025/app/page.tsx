export default function HomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome to Ticketing</h1>
      <p className="mb-4">Register now for our event.</p>
      <a href="/public/register" className="text-blue-600 underline">
        Go to Registration →
      </a>
    </div>
  )
}

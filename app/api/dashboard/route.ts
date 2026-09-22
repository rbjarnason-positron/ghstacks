export async function GET() {
  return Response.json(
    {
      error:
        "GitHub connection is available in the local dashboard. Run npm run dev on your computer, or npm run build followed by npm start.",
    },
    { status: 503 },
  );
}
